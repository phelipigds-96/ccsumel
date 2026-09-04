-- 1) Regras de bloqueio por situação
CREATE TABLE public.falta_status_regras (
  status falta_status PRIMARY KEY,
  bloqueia_novo_lancamento boolean NOT NULL DEFAULT false,
  bloqueio_permanente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.falta_status_regras TO authenticated;
GRANT ALL ON public.falta_status_regras TO service_role;
ALTER TABLE public.falta_status_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY falta_status_regras_select ON public.falta_status_regras FOR SELECT TO authenticated USING (true);
CREATE POLICY falta_status_regras_insert_admin ON public.falta_status_regras FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY falta_status_regras_update_admin ON public.falta_status_regras FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER falta_status_regras_set_updated_at BEFORE UPDATE ON public.falta_status_regras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.falta_status_regras (status, bloqueia_novo_lancamento, bloqueio_permanente) VALUES
  ('Pendente', false, false),
  ('Em análise', true, false),
  ('Comprar', true, false),
  ('Pedido realizado', true, false),
  ('Aguardando recebimento', true, false),
  ('Estoque disponível / verificar loja', false, false),
  ('Falta no fornecedor', true, false),
  ('Produto descontinuado', true, true),
  ('Resolvido', false, false),
  ('Não é ruptura', false, false);

-- 2) Bloqueios por produto + loja
CREATE TABLE public.produto_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  store_id text NOT NULL,
  status falta_status NOT NULL,
  permanente boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  motivo text NOT NULL DEFAULT '',
  falta_id uuid REFERENCES public.produtos_em_falta(id) ON DELETE SET NULL,
  tratado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, store_id)
);
GRANT SELECT ON public.produto_bloqueios TO authenticated;
GRANT ALL ON public.produto_bloqueios TO service_role;
ALTER TABLE public.produto_bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY produto_bloqueios_select ON public.produto_bloqueios FOR SELECT TO authenticated USING (true);
CREATE TRIGGER produto_bloqueios_set_updated_at BEFORE UPDATE ON public.produto_bloqueios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX produto_bloqueios_ativo_idx ON public.produto_bloqueios (product_id, store_id) WHERE ativo;

-- 3) Histórico dos bloqueios
CREATE TABLE public.produto_bloqueios_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  store_id text NOT NULL,
  status_anterior falta_status,
  status_novo falta_status,
  ativo_anterior boolean,
  ativo_novo boolean,
  changed_by uuid,
  changed_by_name text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.produto_bloqueios_historico TO authenticated;
GRANT ALL ON public.produto_bloqueios_historico TO service_role;
ALTER TABLE public.produto_bloqueios_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY produto_bloqueios_historico_select ON public.produto_bloqueios_historico FOR SELECT TO authenticated USING (true);

-- 4) Sincroniza bloqueio quando a situação da falta muda
CREATE OR REPLACE FUNCTION public.sync_produto_bloqueio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bloqueia boolean;
  _permanente boolean;
  _atual public.produto_bloqueios%ROWTYPE;
BEGIN
  SELECT bloqueia_novo_lancamento, bloqueio_permanente
    INTO _bloqueia, _permanente
    FROM public.falta_status_regras WHERE status = NEW.status;

  -- situação nova ainda não cadastrada nas regras: bloqueia por padrão (exceto Pendente)
  IF _bloqueia IS NULL THEN
    _bloqueia := NEW.status <> 'Pendente'::falta_status;
    _permanente := false;
  END IF;

  SELECT * INTO _atual FROM public.produto_bloqueios
   WHERE product_id = NEW.product_id AND store_id = NEW.store_id;

  IF _bloqueia THEN
    INSERT INTO public.produto_bloqueios
      (product_id, store_id, status, permanente, ativo, motivo, falta_id, tratado_em)
    VALUES
      (NEW.product_id, NEW.store_id, NEW.status, _permanente, true,
       coalesce(NEW.management_observation, ''), NEW.id, now())
    ON CONFLICT (product_id, store_id) DO UPDATE
      SET status = EXCLUDED.status,
          permanente = EXCLUDED.permanente OR public.produto_bloqueios.permanente,
          ativo = true,
          motivo = EXCLUDED.motivo,
          falta_id = EXCLUDED.falta_id,
          tratado_em = now();

    INSERT INTO public.produto_bloqueios_historico
      (product_id, store_id, status_anterior, status_novo, ativo_anterior, ativo_novo,
       changed_by, changed_by_name, motivo)
    VALUES
      (NEW.product_id, NEW.store_id, _atual.status, NEW.status,
       coalesce(_atual.ativo, false), true, auth.uid(), '',
       coalesce(NEW.management_observation, ''));

  ELSIF _atual.id IS NOT NULL AND _atual.ativo AND NOT _atual.permanente THEN
    UPDATE public.produto_bloqueios
       SET ativo = false, status = NEW.status, motivo = coalesce(NEW.management_observation, '')
     WHERE id = _atual.id;

    INSERT INTO public.produto_bloqueios_historico
      (product_id, store_id, status_anterior, status_novo, ativo_anterior, ativo_novo,
       changed_by, changed_by_name, motivo)
    VALUES
      (NEW.product_id, NEW.store_id, _atual.status, NEW.status, true, false,
       auth.uid(), '', coalesce(NEW.management_observation, ''));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER produtos_em_falta_sync_bloqueio
AFTER UPDATE OF status ON public.produtos_em_falta
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_produto_bloqueio();

-- 5) Impede novo lançamento bloqueado ou duplicado
CREATE OR REPLACE FUNCTION public.validar_novo_lancamento_falta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.produto_bloqueios%ROWTYPE;
BEGIN
  SELECT * INTO _b FROM public.produto_bloqueios
   WHERE product_id = NEW.product_id AND store_id = NEW.store_id AND ativo;

  IF _b.id IS NOT NULL THEN
    RAISE EXCEPTION 'PRODUTO_BLOQUEADO|%|%', _b.status, to_char(_b.tratado_em, 'DD/MM/YYYY');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.produtos_em_falta
     WHERE product_id = NEW.product_id AND store_id = NEW.store_id
       AND status = 'Pendente'::falta_status
  ) THEN
    RAISE EXCEPTION 'PRODUTO_JA_SOLICITADO';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER produtos_em_falta_validar_lancamento
BEFORE INSERT ON public.produtos_em_falta
FOR EACH ROW EXECUTE FUNCTION public.validar_novo_lancamento_falta();

-- 6) Liberação administrativa
CREATE OR REPLACE FUNCTION public.liberar_produto_bloqueado(_bloqueio_id uuid, _nome text, _motivo text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.produto_bloqueios%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para liberar produtos bloqueados';
  END IF;

  SELECT * INTO _b FROM public.produto_bloqueios WHERE id = _bloqueio_id;
  IF _b.id IS NULL THEN
    RAISE EXCEPTION 'Bloqueio não encontrado';
  END IF;

  UPDATE public.produto_bloqueios
     SET ativo = false, permanente = false, motivo = coalesce(nullif(btrim(_motivo), ''), motivo)
   WHERE id = _bloqueio_id;

  INSERT INTO public.produto_bloqueios_historico
    (product_id, store_id, status_anterior, status_novo, ativo_anterior, ativo_novo,
     changed_by, changed_by_name, motivo)
  VALUES
    (_b.product_id, _b.store_id, _b.status, NULL, _b.ativo, false,
     auth.uid(), coalesce(nullif(btrim(_nome), ''), 'Administração'),
     coalesce(nullif(btrim(_motivo), ''), 'Produto liberado para novos lançamentos'));
END;
$$;

-- 7) Popula bloqueios a partir das faltas já tratadas
INSERT INTO public.produto_bloqueios (product_id, store_id, status, permanente, ativo, motivo, falta_id, tratado_em)
SELECT DISTINCT ON (f.product_id, f.store_id)
       f.product_id, f.store_id, f.status,
       coalesce(r.bloqueio_permanente, false), true,
       coalesce(f.management_observation, ''), f.id,
       coalesce(f.managed_at, f.updated_at)
  FROM public.produtos_em_falta f
  JOIN public.falta_status_regras r ON r.status = f.status
 WHERE r.bloqueia_novo_lancamento
 ORDER BY f.product_id, f.store_id, coalesce(f.managed_at, f.updated_at) DESC
ON CONFLICT (product_id, store_id) DO NOTHING;