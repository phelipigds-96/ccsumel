-- ============================================================================
-- MIGRATION: Correções Críticas de Integridade e Auditoria — Módulo Degustações
-- Central de Campanhas Sumel
-- Data: 2026-10-16
-- Versão: 20261016091500_correcoes_integridade_degustacoes.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUDITORIA PERMANENTE (CASCADE -> SET NULL, PRESERVAÇÃO DE DADOS E ANTI-DELETE)
-- ----------------------------------------------------------------------------

-- 1.1 Remove constraint ON DELETE CASCADE da chave estrangeira de histórico
ALTER TABLE public.degustacoes_historico 
  DROP CONSTRAINT IF EXISTS degustacoes_historico_degustacao_id_fkey;

-- 1.2 Torna degustacao_id anulável para permitir ON DELETE SET NULL
ALTER TABLE public.degustacoes_historico 
  ALTER COLUMN degustacao_id DROP NOT NULL;

-- 1.3 Recria a foreign key com ON DELETE SET NULL (histórico não é apagado na exclusão)
ALTER TABLE public.degustacoes_historico 
  ADD CONSTRAINT degustacoes_historico_degustacao_id_fkey 
  FOREIGN KEY (degustacao_id) REFERENCES public.degustacoes(id) ON DELETE SET NULL;

-- 1.4 Adiciona colunas para preservação imutável de identificação e produto participante
ALTER TABLE public.degustacoes_historico 
  ADD COLUMN IF NOT EXISTS degustacao_id_original uuid,
  ADD COLUMN IF NOT EXISTS degustacao_nome text,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produto_descricao text;

-- 1.5 Backfill seguro de registros históricos existentes (garante retrocompatibilidade)
UPDATE public.degustacoes_historico h
SET degustacao_id_original = h.degustacao_id,
    degustacao_nome = COALESCE(d.nome, 'Degustação ID ' || h.degustacao_id::text)
FROM public.degustacoes d
WHERE h.degustacao_id = d.id 
  AND (h.degustacao_id_original IS NULL OR h.degustacao_nome IS NULL);

UPDATE public.degustacoes_historico
SET degustacao_id_original = COALESCE(degustacao_id_original, degustacao_id, gen_random_uuid()),
    degustacao_nome = COALESCE(degustacao_nome, 'Degustação Histórica')
WHERE degustacao_id_original IS NULL OR degustacao_nome IS NULL;

ALTER TABLE public.degustacoes_historico 
  ALTER COLUMN degustacao_id_original SET NOT NULL,
  ALTER COLUMN degustacao_nome SET NOT NULL;

-- 1.6 Índice para consultas pelo identificador imutável
CREATE INDEX IF NOT EXISTS idx_degustacoes_historico_degustacao_original 
  ON public.degustacoes_historico(degustacao_id_original, created_at DESC);

-- 1.7 Bloqueio de exclusão física em degustações com vendas ou em andamento (força soft-delete / status 'Cancelada')
CREATE OR REPLACE FUNCTION public.fn_degustacoes_prevent_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('Ativa', 'Aguardando Resultados', 'Concluída') THEN
    RAISE EXCEPTION 'Não é permitido excluir fisicamente uma degustação com status "%". A ação deve ser cancelada em vez de excluída para preservar o histórico.', OLD.status;
  END IF;

  IF OLD.faturamento_total_calculado > 0 OR OLD.quantidade_total_vendida > 0 THEN
    RAISE EXCEPTION 'Não é permitido excluir fisicamente uma degustação com resultados financeiros registrados. Cancele a degustação com justificativa.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_degustacoes_prevent_delete ON public.degustacoes;
CREATE TRIGGER trg_degustacoes_prevent_delete
  BEFORE DELETE ON public.degustacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacoes_prevent_delete();


-- ----------------------------------------------------------------------------
-- 2. TRATAMENTO TRANSIENTE DE JUSTIFICATIVA (PREVENÇÃO DE REUTILIZAÇÃO)
-- ----------------------------------------------------------------------------

-- 2.1 Permite NULL na coluna do cabeçalho e reseta o padrão
ALTER TABLE public.degustacoes 
  ALTER COLUMN justificativa_alteracao DROP NOT NULL,
  ALTER COLUMN justificativa_alteracao SET DEFAULT NULL;

UPDATE public.degustacoes SET justificativa_alteracao = NULL;

-- 2.2 Adiciona coluna de justificativa transiente nos produtos participantes
ALTER TABLE public.degustacao_produtos 
  ADD COLUMN IF NOT EXISTS justificativa_alteracao text DEFAULT NULL;


-- ----------------------------------------------------------------------------
-- 3. TOTAIS FINANCEIROS E INTEGRIDADE DE TRANSFERÊNCIA DE ITENS
-- ----------------------------------------------------------------------------

-- 3.1 Impede transferência de produto diretamente para outra degustação
CREATE OR REPLACE FUNCTION public.fn_degustacao_produtos_prevent_transfer()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.degustacao_id IS DISTINCT FROM NEW.degustacao_id THEN
    RAISE EXCEPTION 'Não é permitido transferir um produto diretamente para outra degustação. Remova o item e adicione-o na degustação de destino.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_degustacao_produtos_prevent_transfer ON public.degustacao_produtos;
CREATE TRIGGER trg_degustacao_produtos_prevent_transfer
  BEFORE UPDATE ON public.degustacao_produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacao_produtos_prevent_transfer();

-- 3.2 Sincronização atômica de totais tratando explicitamente OLD e NEW caso houvesse troca de pai
CREATE OR REPLACE FUNCTION public.fn_sync_degustacao_totais()
RETURNS TRIGGER AS $$
DECLARE
  v_degustacao_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.degustacao_id IS DISTINCT FROM NEW.degustacao_id THEN
    UPDATE public.degustacoes
    SET faturamento_total_calculado = COALESCE((
          SELECT SUM(faturamento_total) FROM public.degustacao_produtos WHERE degustacao_id = OLD.degustacao_id
        ), 0.00),
        quantidade_total_vendida = COALESCE((
          SELECT SUM(quantidade_vendida) FROM public.degustacao_produtos WHERE degustacao_id = OLD.degustacao_id
        ), 0.000),
        updated_at = now()
    WHERE id = OLD.degustacao_id;
  END IF;

  v_degustacao_id := COALESCE(NEW.degustacao_id, OLD.degustacao_id);

  UPDATE public.degustacoes
  SET faturamento_total_calculado = COALESCE((
        SELECT SUM(faturamento_total) FROM public.degustacao_produtos WHERE degustacao_id = v_degustacao_id
      ), 0.00),
      quantidade_total_vendida = COALESCE((
        SELECT SUM(quantidade_vendida) FROM public.degustacao_produtos WHERE degustacao_id = v_degustacao_id
      ), 0.000),
      updated_at = now()
  WHERE id = v_degustacao_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_degustacao_totais ON public.degustacao_produtos;
CREATE TRIGGER trg_sync_degustacao_totais
  AFTER INSERT OR UPDATE OR DELETE ON public.degustacao_produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_degustacao_totais();


-- ----------------------------------------------------------------------------
-- 4. CONSTRAINTS CHECK DE VALORES NÃO NEGATIVOS E COERÊNCIA TEMPORAL
-- ----------------------------------------------------------------------------

-- 4.1 Constraints no cabeçalho (degustacoes)
ALTER TABLE public.degustacoes
  DROP CONSTRAINT IF EXISTS chk_degustacoes_faturamento_total,
  DROP CONSTRAINT IF EXISTS chk_degustacoes_quantidade_total,
  DROP CONSTRAINT IF EXISTS chk_degustacoes_horarios;

ALTER TABLE public.degustacoes
  ADD CONSTRAINT chk_degustacoes_faturamento_total CHECK (faturamento_total_calculado >= 0),
  ADD CONSTRAINT chk_degustacoes_quantidade_total CHECK (quantidade_total_vendida >= 0),
  ADD CONSTRAINT chk_degustacoes_horarios CHECK (horario_inicio IS NULL OR horario_fim IS NULL OR horario_fim > horario_inicio);

-- 4.2 Constraints nos produtos participantes (degustacao_produtos)
ALTER TABLE public.degustacao_produtos
  DROP CONSTRAINT IF EXISTS chk_degustacao_produtos_preco_base,
  DROP CONSTRAINT IF EXISTS chk_degustacao_produtos_preco_praticado,
  DROP CONSTRAINT IF EXISTS chk_degustacao_produtos_quantidade_vendida,
  DROP CONSTRAINT IF EXISTS chk_degustacao_produtos_faturamento_total;

ALTER TABLE public.degustacao_produtos
  ADD CONSTRAINT chk_degustacao_produtos_preco_base CHECK (preco_base >= 0),
  ADD CONSTRAINT chk_degustacao_produtos_preco_praticado CHECK (preco_praticado >= 0),
  ADD CONSTRAINT chk_degustacao_produtos_quantidade_vendida CHECK (quantidade_vendida >= 0),
  ADD CONSTRAINT chk_degustacao_produtos_faturamento_total CHECK (faturamento_total >= 0);


-- ----------------------------------------------------------------------------
-- 5. TRANSIÇÕES DE STATUS E VALIDAÇÕES DE FECHAMENTO (TRIGGERS DE AUDITORIA)
-- ----------------------------------------------------------------------------

-- 5.1 Trigger principal de degustações com captura de justificativa única e validações
CREATE OR REPLACE FUNCTION public.fn_degustacoes_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_acao text;
  v_status_ant public.degustacao_status;
  v_status_novo public.degustacao_status;
  v_obs text;
  v_user_name text;
  v_justificativa text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT COALESCE(NULLIF(name, ''), username, 'Master') INTO v_user_name
    FROM public.profiles
    WHERE id = auth.uid();
  ELSE
    v_user_name := 'Sistema';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.id := COALESCE(NEW.id, gen_random_uuid());
    v_justificativa := NULLIF(TRIM(NEW.justificativa_alteracao), '');
    v_acao := 'Criação';
    v_status_ant := NULL;
    v_status_novo := NEW.status;
    v_obs := COALESCE(v_justificativa, NULLIF(NEW.observacoes, ''), 'Agendamento inicial da degustação');

    INSERT INTO public.degustacoes_historico (
      degustacao_id,
      degustacao_id_original,
      degustacao_nome,
      produto_id,
      produto_descricao,
      status_anterior,
      status_novo,
      acao,
      justificativa,
      observacao,
      changed_by,
      changed_by_name,
      dados_anteriores,
      dados_novos,
      created_at
    ) VALUES (
      NEW.id,
      NEW.id,
      NEW.nome,
      NULL,
      NULL,
      v_status_ant,
      v_status_novo,
      v_acao,
      v_justificativa,
      v_obs,
      auth.uid(),
      v_user_name,
      NULL,
      to_jsonb(NEW),
      now()
    );

    NEW.justificativa_alteracao := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.degustacoes_historico (
      degustacao_id,
      degustacao_id_original,
      degustacao_nome,
      produto_id,
      produto_descricao,
      status_anterior,
      status_novo,
      acao,
      justificativa,
      observacao,
      changed_by,
      changed_by_name,
      dados_anteriores,
      dados_novos,
      created_at
    ) VALUES (
      OLD.id,
      OLD.id,
      OLD.nome,
      NULL,
      NULL,
      OLD.status,
      'Cancelada',
      'Exclusão',
      NULLIF(TRIM(OLD.justificativa_alteracao), ''),
      'Exclusão física do registro da degustação',
      auth.uid(),
      v_user_name,
      to_jsonb(OLD),
      NULL,
      now()
    );
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Ignora auditoria duplicada quando a mutação é unicamente recálculo interno disparado por itens
    IF OLD.status = NEW.status 
       AND OLD.nome = NEW.nome 
       AND OLD.loja = NEW.loja 
       AND OLD.fornecedor_id = NEW.fornecedor_id 
       AND OLD.data = NEW.data 
       AND OLD.horario_inicio IS NOT DISTINCT FROM NEW.horario_inicio 
       AND OLD.horario_fim IS NOT DISTINCT FROM NEW.horario_fim 
       AND OLD.responsavel_nome = NEW.responsavel_nome 
       AND OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id 
       AND OLD.campanha_id IS NOT DISTINCT FROM NEW.campanha_id 
       AND OLD.observacoes = NEW.observacoes 
       AND OLD.observacoes_resultados = NEW.observacoes_resultados 
       AND NEW.justificativa_alteracao IS NULL THEN
      NEW.updated_at := now();
      RETURN NEW;
    END IF;

    v_justificativa := NULLIF(TRIM(NEW.justificativa_alteracao), '');
    v_status_ant := OLD.status;
    v_status_novo := NEW.status;

    -- Validação de regras de transição de status
    IF OLD.status != NEW.status THEN
      IF OLD.status = 'Cancelada' THEN
        RAISE EXCEPTION 'Não é permitido alterar ou reabrir uma degustação cancelada.';
      END IF;

      IF OLD.status = 'Programada' AND NEW.status = 'Concluída' THEN
        RAISE EXCEPTION 'Não é permitido concluir uma degustação diretamente do estado "Programada". A ação deve ocorrer ou avançar para "Aguardando Resultados".';
      END IF;

      IF OLD.status = 'Ativa' AND NEW.status = 'Concluída' THEN
        RAISE EXCEPTION 'Não é permitido concluir uma degustação diretamente do estado "Ativa". Mude para "Aguardando Resultados" para registrar e conferir os resultados.';
      END IF;

      IF NEW.status = 'Cancelada' THEN
        IF v_justificativa IS NULL THEN
          RAISE EXCEPTION 'É obrigatório fornecer uma justificativa para cancelar uma degustação.';
        END IF;
        v_acao := 'Cancelamento';
        v_obs := v_justificativa;

      ELSIF NEW.status = 'Concluída' THEN
        -- Exigência: deve possuir pelo menos 1 produto participante
        IF NOT EXISTS (SELECT 1 FROM public.degustacao_produtos WHERE degustacao_id = NEW.id) THEN
          RAISE EXCEPTION 'Não é permitido concluir uma degustação sem nenhum produto participante cadastrado.';
        END IF;

        v_acao := 'Lançamento de Resultados';
        v_obs := COALESCE(v_justificativa, NULLIF(NEW.observacoes_resultados, ''), 'Fechamento e conclusão de resultados');

        IF NEW.resultado_registrado_em IS NULL THEN
          NEW.resultado_registrado_em := now();
        END IF;
        IF NEW.resultado_registrado_por IS NULL THEN
          NEW.resultado_registrado_por := auth.uid();
        END IF;
        IF NEW.resultado_registrado_por_nome IS NULL THEN
          NEW.resultado_registrado_por_nome := v_user_name;
        END IF;

      ELSIF OLD.status = 'Concluída' AND NEW.status = 'Aguardando Resultados' THEN
        IF v_justificativa IS NULL THEN
          RAISE EXCEPTION 'É obrigatório fornecer uma justificativa para reabrir uma degustação concluída.';
        END IF;
        v_acao := 'Reabertura';
        v_obs := v_justificativa;

      ELSE
        v_acao := 'Mudança de Status';
        v_obs := COALESCE(v_justificativa, 'Status alterado de ' || OLD.status::text || ' para ' || NEW.status::text);
      END IF;

    ELSE
      -- O status não mudou
      IF OLD.status = 'Concluída' THEN
        IF v_justificativa IS NULL THEN
          RAISE EXCEPTION 'É obrigatório fornecer uma justificativa para alterar dados de uma degustação já concluída.';
        END IF;
        v_acao := 'Correção de Resultados';
        v_obs := v_justificativa;
      ELSE
        v_acao := 'Alteração';
        v_obs := COALESCE(v_justificativa, 'Alteração nos dados do agendamento');
      END IF;
    END IF;

    -- Gravação na auditoria permanente
    INSERT INTO public.degustacoes_historico (
      degustacao_id,
      degustacao_id_original,
      degustacao_nome,
      produto_id,
      produto_descricao,
      status_anterior,
      status_novo,
      acao,
      justificativa,
      observacao,
      changed_by,
      changed_by_name,
      dados_anteriores,
      dados_novos,
      created_at
    ) VALUES (
      NEW.id,
      NEW.id,
      NEW.nome,
      NULL,
      NULL,
      v_status_ant,
      v_status_novo,
      v_acao,
      v_justificativa,
      v_obs,
      auth.uid(),
      v_user_name,
      to_jsonb(OLD),
      to_jsonb(NEW),
      now()
    );

    -- Limpa a justificativa do registro principal para não vazar para atualizações posteriores
    NEW.justificativa_alteracao := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_degustacoes_audit ON public.degustacoes;
CREATE TRIGGER trg_degustacoes_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.degustacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacoes_audit();

-- 5.2 Trigger de auditoria de itens participantes com justificativa transiente
CREATE OR REPLACE FUNCTION public.fn_degustacao_produtos_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_degustacao_id uuid;
  v_degustacao_status public.degustacao_status;
  v_degustacao_nome text;
  v_acao text;
  v_obs text;
  v_user_name text;
  v_justificativa text;
BEGIN
  v_degustacao_id := COALESCE(NEW.degustacao_id, OLD.degustacao_id);

  SELECT status, nome INTO v_degustacao_status, v_degustacao_nome 
  FROM public.degustacoes 
  WHERE id = v_degustacao_id;

  IF v_degustacao_nome IS NULL THEN
    v_degustacao_nome := 'Degustação ' || v_degustacao_id::text;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT COALESCE(NULLIF(name, ''), username, 'Master') INTO v_user_name
    FROM public.profiles
    WHERE id = auth.uid();
  ELSE
    v_user_name := 'Sistema';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_degustacao_status = 'Cancelada' THEN
      RAISE EXCEPTION 'Não é permitido adicionar produtos a uma degustação cancelada.';
    END IF;

    v_justificativa := NULLIF(TRIM(NEW.justificativa_alteracao), '');

    IF v_degustacao_status = 'Concluída' THEN
      IF v_justificativa IS NULL THEN
        RAISE EXCEPTION 'É obrigatório fornecer uma justificativa para adicionar produtos a uma degustação concluída.';
      END IF;
      v_acao := 'Inclusão de Produto (Pós-Conclusão)';
    ELSE
      v_acao := 'Inclusão de Produto';
    END IF;

    v_obs := 'Produto adicionado: ' || NEW.descricao || ' (Código: ' || COALESCE(NEW.codigo, 'N/A') || ')';

    INSERT INTO public.degustacoes_historico (
      degustacao_id,
      degustacao_id_original,
      degustacao_nome,
      produto_id,
      produto_descricao,
      status_anterior,
      status_novo,
      acao,
      justificativa,
      observacao,
      changed_by,
      changed_by_name,
      dados_anteriores,
      dados_novos,
      created_at
    ) VALUES (
      NEW.degustacao_id,
      NEW.degustacao_id,
      v_degustacao_nome,
      NEW.produto_id,
      NEW.descricao,
      v_degustacao_status,
      COALESCE(v_degustacao_status, 'Programada'),
      v_acao,
      v_justificativa,
      v_obs,
      auth.uid(),
      v_user_name,
      NULL,
      to_jsonb(NEW),
      now()
    );

    NEW.justificativa_alteracao := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_degustacao_status = 'Concluída' THEN
      RAISE EXCEPTION 'Não é permitido remover produtos de uma degustação já concluída. Reabra a degustação com justificativa para efetuar a remoção.';
    END IF;

    v_justificativa := NULLIF(TRIM(OLD.justificativa_alteracao), '');
    v_acao := 'Remoção de Produto';
    v_obs := 'Produto removido: ' || OLD.descricao || ' (Código: ' || COALESCE(OLD.codigo, 'N/A') || ')';

    INSERT INTO public.degustacoes_historico (
      degustacao_id,
      degustacao_id_original,
      degustacao_nome,
      produto_id,
      produto_descricao,
      status_anterior,
      status_novo,
      acao,
      justificativa,
      observacao,
      changed_by,
      changed_by_name,
      dados_anteriores,
      dados_novos,
      created_at
    ) VALUES (
      OLD.degustacao_id,
      OLD.degustacao_id,
      v_degustacao_nome,
      OLD.produto_id,
      OLD.descricao,
      v_degustacao_status,
      COALESCE(v_degustacao_status, 'Programada'),
      v_acao,
      v_justificativa,
      v_obs,
      auth.uid(),
      v_user_name,
      to_jsonb(OLD),
      NULL,
      now()
    );

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_justificativa := NULLIF(TRIM(NEW.justificativa_alteracao), '');

    IF v_degustacao_status = 'Concluída' THEN
      IF (OLD.quantidade_vendida != NEW.quantidade_vendida OR OLD.preco_praticado != NEW.preco_praticado OR OLD.descricao != NEW.descricao) THEN
        IF v_justificativa IS NULL THEN
          RAISE EXCEPTION 'É obrigatório fornecer uma justificativa para corrigir quantidades ou preços de uma degustação concluída.';
        END IF;
      END IF;
    END IF;

    IF OLD.quantidade_vendida != NEW.quantidade_vendida OR OLD.preco_praticado != NEW.preco_praticado THEN
      v_acao := CASE WHEN v_degustacao_status = 'Concluída' THEN 'Correção de Resultados (Item)' ELSE 'Ajuste de Vendas do Item' END;
      v_obs := 'Produto "' || NEW.descricao || '": Qtd de ' || OLD.quantidade_vendida::text || ' para ' || NEW.quantidade_vendida::text || ', Preço de R$ ' || OLD.preco_praticado::text || ' para R$ ' || NEW.preco_praticado::text;
    ELSE
      v_acao := 'Alteração de Item';
      v_obs := 'Atualização de dados do produto participante "' || NEW.descricao || '"';
    END IF;

    INSERT INTO public.degustacoes_historico (
      degustacao_id,
      degustacao_id_original,
      degustacao_nome,
      produto_id,
      produto_descricao,
      status_anterior,
      status_novo,
      acao,
      justificativa,
      observacao,
      changed_by,
      changed_by_name,
      dados_anteriores,
      dados_novos,
      created_at
    ) VALUES (
      NEW.degustacao_id,
      NEW.degustacao_id,
      v_degustacao_nome,
      NEW.produto_id,
      NEW.descricao,
      v_degustacao_status,
      COALESCE(v_degustacao_status, 'Programada'),
      v_acao,
      v_justificativa,
      v_obs,
      auth.uid(),
      v_user_name,
      to_jsonb(OLD),
      to_jsonb(NEW),
      now()
    );

    NEW.justificativa_alteracao := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_degustacao_produtos_audit ON public.degustacao_produtos;
CREATE TRIGGER trg_degustacao_produtos_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.degustacao_produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacao_produtos_audit();


-- ----------------------------------------------------------------------------
-- 6. TIMESTAMPS NATIVOS E SUPORTE AO FUSO HORÁRIO DAS LOJAS SUMEL
-- ----------------------------------------------------------------------------

-- 6.1 Defaults diretos com now() sem conversão redundante
ALTER TABLE public.degustacoes 
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.degustacao_produtos 
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.degustacoes_historico 
  ALTER COLUMN created_at SET DEFAULT now();

-- 6.2 Data corrente oficial das Lojas Sumel (fuso America/Sao_Paulo)
CREATE OR REPLACE FUNCTION public.data_atual_lojas_sumel()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

COMMENT ON FUNCTION public.data_atual_lojas_sumel() IS 'Retorna a data civil corrente no fuso horário oficial das lojas Sumel (America/Sao_Paulo), prevenindo distorções UTC pós-18h.';

-- 6.3 Função utilitária para avaliação dinâmica de situação da ação no horário de Brasília/RS
CREATE OR REPLACE FUNCTION public.calcular_status_operacional_degustacao(
  p_data date,
  p_horario_inicio time without time zone,
  p_horario_fim time without time zone,
  p_status_atual public.degustacao_status
)
RETURNS public.degustacao_status
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_agora_sumel timestamp without time zone;
  v_data_sumel date;
  v_hora_sumel time without time zone;
BEGIN
  IF p_status_atual IN ('Concluída', 'Cancelada', 'Aguardando Resultados') THEN
    RETURN p_status_atual;
  END IF;

  v_agora_sumel := now() AT TIME ZONE 'America/Sao_Paulo';
  v_data_sumel := v_agora_sumel::date;
  v_hora_sumel := v_agora_sumel::time;

  IF p_data > v_data_sumel THEN
    RETURN 'Programada';
  END IF;

  IF p_data < v_data_sumel THEN
    RETURN 'Aguardando Resultados';
  END IF;

  IF p_horario_inicio IS NOT NULL AND v_hora_sumel < p_horario_inicio THEN
    RETURN 'Programada';
  ELSIF p_horario_fim IS NOT NULL AND v_hora_sumel > p_horario_fim THEN
    RETURN 'Aguardando Resultados';
  ELSE
    RETURN 'Ativa';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calcular_status_operacional_degustacao IS 'Determina em tempo real a situação operacional no fuso America/Sao_Paulo sem sobrescrever estados concluídos ou cancelados.';
