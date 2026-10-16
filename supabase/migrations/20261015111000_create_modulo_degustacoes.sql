-- ============================================================================
-- MIGRATION: Módulo Degustações — Estrutura de Banco, RLS, Cálculos e Auditoria por Trigger
-- Central de Campanhas Sumel
-- Data: 2026-10-15
-- ============================================================================

-- 1. ENUM DE STATUS DA DEGUSTAÇÃO
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'degustacao_status') THEN
    CREATE TYPE public.degustacao_status AS ENUM (
      'Programada',
      'Ativa',
      'Aguardando Resultados',
      'Concluída',
      'Cancelada'
    );
  END IF;
END $$;

-- 2. FUNÇÃO SECURITY DEFINER: is_master()
-- Valida no banco se o usuário é administrador ativo e não read_only
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(), 'admin'::public.app_role)
     AND COALESCE((
       SELECT (status = 'ativo' AND NOT read_only)
       FROM public.profiles 
       WHERE id = auth.uid()
     ), false);
$$;

REVOKE ALL ON FUNCTION public.is_master() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated, service_role;

-- 3. TABELA PRINCIPAL: DEGUSTAÇÕES (CABEÇALHO)
CREATE TABLE IF NOT EXISTS public.degustacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  loja text NOT NULL,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  fornecedor_nome text NOT NULL,
  data date NOT NULL,
  horario_inicio time without time zone,
  horario_fim time without time zone,
  responsavel_nome text NOT NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  campanha_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL,
  campanha_nome text,                                       -- Preserva o nome da campanha caso o registro seja desvinculado
  status public.degustacao_status NOT NULL DEFAULT 'Programada',
  observacoes text NOT NULL DEFAULT '',
  
  -- Fechamento de resultados (gerido exclusivamente pelo Master)
  observacoes_resultados text NOT NULL DEFAULT '',
  justificativa_alteracao text NOT NULL DEFAULT '',         -- Recebe a justificativa de correções/cancelamentos para a auditoria
  faturamento_total_calculado numeric(12,2) NOT NULL DEFAULT 0.00,
  quantidade_total_vendida numeric(12,3) NOT NULL DEFAULT 0.000,
  resultado_registrado_em timestamptz,
  resultado_registrado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resultado_registrado_por_nome text,

  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABELA DE PRODUTOS DA DEGUSTAÇÃO
CREATE TABLE IF NOT EXISTS public.degustacao_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  degustacao_id uuid NOT NULL REFERENCES public.degustacoes(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  oferta_id uuid REFERENCES public.ofertas(id) ON DELETE SET NULL,
  codigo text,                                              -- Preserva o código interno da loja
  gtin text,                                                -- Preserva o código EAN-13
  descricao text NOT NULL,                                  -- Preserva a descrição histórica do item
  preco_base numeric(12,2) NOT NULL DEFAULT 0.00,
  preco_praticado numeric(12,2) NOT NULL DEFAULT 0.00,
  quantidade_vendida numeric(12,3) NOT NULL DEFAULT 0.000,
  faturamento_total numeric(12,2) NOT NULL DEFAULT 0.00,   -- Calculado automaticamente (quantidade_vendida * preco_praticado)
  observacoes text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_degustacao_produto UNIQUE (degustacao_id, produto_id)
);

-- 5. TABELA DE AUDITORIA: HISTÓRICO DE DEGUSTAÇÕES (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.degustacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  degustacao_id uuid NOT NULL REFERENCES public.degustacoes(id) ON DELETE CASCADE,
  status_anterior public.degustacao_status,
  status_novo public.degustacao_status NOT NULL,
  acao text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text NOT NULL,
  observacao text NOT NULL DEFAULT '',
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_degustacoes_data ON public.degustacoes(data);
CREATE INDEX IF NOT EXISTS idx_degustacoes_loja_data ON public.degustacoes(loja, data);
CREATE INDEX IF NOT EXISTS idx_degustacoes_status ON public.degustacoes(status);
CREATE INDEX IF NOT EXISTS idx_degustacoes_fornecedor ON public.degustacoes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_degustacoes_campanha ON public.degustacoes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_degustacao_produtos_degustacao ON public.degustacao_produtos(degustacao_id);
CREATE INDEX IF NOT EXISTS idx_degustacao_produtos_produto ON public.degustacao_produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_degustacoes_historico_degustacao ON public.degustacoes_historico(degustacao_id, created_at DESC);

-- 7. PRIVILÉGIOS SQL (GRANT / REVOKE)
REVOKE ALL ON public.degustacoes, public.degustacao_produtos, public.degustacoes_historico FROM anon;
REVOKE ALL ON public.degustacoes, public.degustacao_produtos, public.degustacoes_historico FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.degustacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.degustacao_produtos TO authenticated;

-- Histórico de auditoria: estritamente SELECT para authenticated (mutações via trigger SECURITY DEFINER)
GRANT SELECT ON public.degustacoes_historico TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.degustacoes_historico FROM authenticated;

GRANT ALL ON public.degustacoes, public.degustacao_produtos, public.degustacoes_historico TO service_role;

-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.degustacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degustacao_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degustacoes_historico ENABLE ROW LEVEL SECURITY;

-- Limpeza preventiva de políticas anteriores se existirem
DROP POLICY IF EXISTS "degustacoes_select_global" ON public.degustacoes;
DROP POLICY IF EXISTS "degustacoes_insert_master" ON public.degustacoes;
DROP POLICY IF EXISTS "degustacoes_update_master" ON public.degustacoes;
DROP POLICY IF EXISTS "degustacoes_delete_master" ON public.degustacoes;

DROP POLICY IF EXISTS "degustacao_produtos_select_global" ON public.degustacao_produtos;
DROP POLICY IF EXISTS "degustacao_produtos_insert_master" ON public.degustacao_produtos;
DROP POLICY IF EXISTS "degustacao_produtos_update_master" ON public.degustacao_produtos;
DROP POLICY IF EXISTS "degustacao_produtos_delete_master" ON public.degustacao_produtos;

DROP POLICY IF EXISTS "degustacoes_historico_select_global" ON public.degustacoes_historico;
DROP POLICY IF EXISTS "degustacoes_historico_insert_master" ON public.degustacoes_historico;
DROP POLICY IF EXISTS "degustacoes_historico_no_update" ON public.degustacoes_historico;
DROP POLICY IF EXISTS "degustacoes_historico_no_delete" ON public.degustacoes_historico;

-- 8.1 Leitura Global Irrestrita para Usuários Autenticados
CREATE POLICY "degustacoes_select_global" ON public.degustacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "degustacao_produtos_select_global" ON public.degustacao_produtos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "degustacoes_historico_select_global" ON public.degustacoes_historico
  FOR SELECT TO authenticated USING (true);

-- 8.2 Escrita Exclusiva do Usuário Master (admin ativo e não read_only)
CREATE POLICY "degustacoes_insert_master" ON public.degustacoes
  FOR INSERT TO authenticated WITH CHECK (public.is_master());

CREATE POLICY "degustacoes_update_master" ON public.degustacoes
  FOR UPDATE TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "degustacoes_delete_master" ON public.degustacoes
  FOR DELETE TO authenticated USING (public.is_master());

CREATE POLICY "degustacao_produtos_insert_master" ON public.degustacao_produtos
  FOR INSERT TO authenticated WITH CHECK (public.is_master());

CREATE POLICY "degustacao_produtos_update_master" ON public.degustacao_produtos
  FOR UPDATE TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "degustacao_produtos_delete_master" ON public.degustacao_produtos
  FOR DELETE TO authenticated USING (public.is_master());

-- Bloqueio absoluto de UPDATE e DELETE na trilha de auditoria para qualquer usuário
CREATE POLICY "degustacoes_historico_no_update" ON public.degustacoes_historico
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "degustacoes_historico_no_delete" ON public.degustacoes_historico
  FOR DELETE TO authenticated USING (false);

-- 9. TRIGGERS: CÁLCULO CONSISTENTE DE FATURAMENTO E TOTALIZADORES
CREATE OR REPLACE FUNCTION public.fn_degustacao_produtos_calc()
RETURNS TRIGGER AS $$
BEGIN
  -- Garante o cálculo correto de faturamento por item
  NEW.faturamento_total := ROUND((COALESCE(NEW.quantidade_vendida, 0) * COALESCE(NEW.preco_praticado, 0)), 2);
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_degustacao_produtos_calc ON public.degustacao_produtos;
CREATE TRIGGER trg_degustacao_produtos_calc
  BEFORE INSERT OR UPDATE ON public.degustacao_produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacao_produtos_calc();

CREATE OR REPLACE FUNCTION public.fn_sync_degustacao_totais()
RETURNS TRIGGER AS $$
DECLARE
  v_degustacao_id uuid;
BEGIN
  v_degustacao_id := COALESCE(NEW.degustacao_id, OLD.degustacao_id);
  
  UPDATE public.degustacoes
  SET faturamento_total_calculado = COALESCE((
        SELECT SUM(faturamento_total) 
        FROM public.degustacao_produtos 
        WHERE degustacao_id = v_degustacao_id
      ), 0.00),
      quantidade_total_vendida = COALESCE((
        SELECT SUM(quantidade_vendida) 
        FROM public.degustacao_produtos 
        WHERE degustacao_id = v_degustacao_id
      ), 0.000),
      updated_at = timezone('utc'::text, now())
  WHERE id = v_degustacao_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_degustacao_totais ON public.degustacao_produtos;
CREATE TRIGGER trg_sync_degustacao_totais
  AFTER INSERT OR UPDATE OR DELETE ON public.degustacao_produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_degustacao_totais();

-- 10. TRIGGERS: AUDITORIA TRANSACIONAL AUTOMÁTICA EM DEGUSTAÇÕES_HISTORICO
CREATE OR REPLACE FUNCTION public.fn_degustacoes_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_acao text;
  v_status_ant public.degustacao_status;
  v_status_novo public.degustacao_status;
  v_obs text;
  v_user_name text;
BEGIN
  -- Busca nome do autor no profiles usando o auth.uid() da sessão
  IF auth.uid() IS NOT NULL THEN
    SELECT COALESCE(NULLIF(name, ''), username, 'Master') INTO v_user_name
    FROM public.profiles
    WHERE id = auth.uid();
  ELSE
    v_user_name := 'Sistema';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'Criação';
    v_status_ant := NULL;
    v_status_novo := NEW.status;
    v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), NEW.observacoes, 'Agendamento inicial da degustação');
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'Exclusão';
    v_status_ant := OLD.status;
    v_status_novo := 'Cancelada';
    v_obs := 'Exclusão física do agendamento';
  ELSIF TG_OP = 'UPDATE' THEN
    v_status_ant := OLD.status;
    v_status_novo := NEW.status;

    IF OLD.status != NEW.status THEN
      IF NEW.status = 'Cancelada' THEN
        v_acao := 'Cancelamento';
        v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), 'Cancelamento de degustação');
      ELSIF NEW.status = 'Concluída' THEN
        v_acao := 'Lançamento de Resultados';
        v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), NULLIF(NEW.observacoes_resultados, ''), 'Fechamento de resultados de vendas');
      ELSIF OLD.status = 'Concluída' AND NEW.status = 'Aguardando Resultados' THEN
        v_acao := 'Reabertura';
        v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), 'Reabertura de degustação para correção');
      ELSE
        v_acao := 'Mudança de Status';
        v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), 'Status alterado de ' || OLD.status::text || ' para ' || NEW.status::text);
      END IF;
    ELSE
      -- O status não mudou
      IF OLD.status = 'Concluída' THEN
        v_acao := 'Correção de Resultados';
        v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), 'Correção de dados/valores de degustação concluída');
      ELSE
        v_acao := 'Alteração';
        v_obs := COALESCE(NULLIF(NEW.justificativa_alteracao, ''), 'Alteração de dados do agendamento');
      END IF;
    END IF;
  END IF;

  -- Grava o histórico atomicamente na mesma transação
  INSERT INTO public.degustacoes_historico (
    degustacao_id,
    status_anterior,
    status_novo,
    acao,
    changed_by,
    changed_by_name,
    observacao,
    dados_anteriores,
    dados_novos,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    v_status_ant,
    v_status_novo,
    v_acao,
    auth.uid(),
    COALESCE(v_user_name, 'Sistema'),
    COALESCE(v_obs, ''),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    timezone('utc'::text, now())
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_degustacoes_audit ON public.degustacoes;
CREATE TRIGGER trg_degustacoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.degustacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacoes_audit();

-- 11. TRIGGER: AUDITORIA ATÔMICA DE ITENS / PRODUTOS PARTICIPANTES
CREATE OR REPLACE FUNCTION public.fn_degustacao_produtos_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_degustacao_id uuid;
  v_degustacao_status public.degustacao_status;
  v_acao text;
  v_obs text;
  v_user_name text;
BEGIN
  v_degustacao_id := COALESCE(NEW.degustacao_id, OLD.degustacao_id);

  -- Recupera o status atual da degustação pai
  SELECT status INTO v_degustacao_status FROM public.degustacoes WHERE id = v_degustacao_id;

  IF auth.uid() IS NOT NULL THEN
    SELECT COALESCE(NULLIF(name, ''), username, 'Master') INTO v_user_name
    FROM public.profiles
    WHERE id = auth.uid();
  ELSE
    v_user_name := 'Sistema';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'Adição de Produto';
    v_obs := 'Produto adicionado: ' || NEW.descricao;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'Remoção de Produto';
    v_obs := 'Produto removido: ' || OLD.descricao;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.quantidade_vendida != NEW.quantidade_vendida OR OLD.preco_praticado != NEW.preco_praticado THEN
      v_acao := 'Ajuste de Vendas do Item';
      v_obs := 'Produto "' || NEW.descricao || '": Qtd alterada de ' || OLD.quantidade_vendida::text || ' para ' || NEW.quantidade_vendida::text || ', Preço de R$' || OLD.preco_praticado::text || ' para R$' || NEW.preco_praticado::text;
    ELSE
      v_acao := 'Alteração de Item';
      v_obs := 'Produto alterado: ' || NEW.descricao;
    END IF;
  END IF;

  INSERT INTO public.degustacoes_historico (
    degustacao_id,
    status_anterior,
    status_novo,
    acao,
    changed_by,
    changed_by_name,
    observacao,
    dados_anteriores,
    dados_novos,
    created_at
  ) VALUES (
    v_degustacao_id,
    v_degustacao_status,
    COALESCE(v_degustacao_status, 'Programada'),
    v_acao,
    auth.uid(),
    COALESCE(v_user_name, 'Sistema'),
    v_obs,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    timezone('utc'::text, now())
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_degustacao_produtos_audit ON public.degustacao_produtos;
CREATE TRIGGER trg_degustacao_produtos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.degustacao_produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_degustacao_produtos_audit();

-- 12. TRIGGER DE UPDATED_AT DO CABEÇALHO
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_degustacoes_updated_at ON public.degustacoes;
CREATE TRIGGER trg_degustacoes_updated_at
  BEFORE UPDATE ON public.degustacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();
