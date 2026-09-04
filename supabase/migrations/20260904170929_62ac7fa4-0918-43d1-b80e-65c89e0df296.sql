CREATE TYPE public.falta_status AS ENUM (
  'Pendente','Em análise','Comprar','Pedido realizado','Aguardando recebimento',
  'Estoque disponível / verificar loja','Falta no fornecedor','Produto descontinuado',
  'Resolvido','Não é ruptura'
);

CREATE TABLE public.produtos_em_falta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  store_id text NOT NULL,
  reported_by_name text NOT NULL,
  reported_by_user_id uuid,
  reported_by_username text NOT NULL DEFAULT '',
  reported_at timestamptz NOT NULL DEFAULT now(),
  observation text NOT NULL DEFAULT '',
  status public.falta_status NOT NULL DEFAULT 'Pendente',
  management_observation text NOT NULL DEFAULT '',
  managed_by uuid,
  managed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produtos_em_falta_reported_by_name_check CHECK (char_length(btrim(reported_by_name)) > 0),
  CONSTRAINT produtos_em_falta_store_id_check CHECK (char_length(btrim(store_id)) > 0)
);

CREATE INDEX produtos_em_falta_status_idx ON public.produtos_em_falta (status);
CREATE INDEX produtos_em_falta_store_idx ON public.produtos_em_falta (store_id);
CREATE INDEX produtos_em_falta_product_idx ON public.produtos_em_falta (product_id);
CREATE INDEX produtos_em_falta_reported_at_idx ON public.produtos_em_falta (reported_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_em_falta TO authenticated;
GRANT ALL ON public.produtos_em_falta TO service_role;

ALTER TABLE public.produtos_em_falta ENABLE ROW LEVEL SECURITY;

CREATE POLICY produtos_em_falta_select ON public.produtos_em_falta
  FOR SELECT TO authenticated USING (true);
CREATE POLICY produtos_em_falta_insert ON public.produtos_em_falta
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY produtos_em_falta_update ON public.produtos_em_falta
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY produtos_em_falta_delete ON public.produtos_em_falta
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER produtos_em_falta_set_updated_at
  BEFORE UPDATE ON public.produtos_em_falta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.produtos_em_falta_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  falta_id uuid NOT NULL REFERENCES public.produtos_em_falta(id) ON DELETE CASCADE,
  status_anterior public.falta_status,
  status_novo public.falta_status NOT NULL,
  changed_by uuid,
  changed_by_name text NOT NULL DEFAULT '',
  observation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX produtos_em_falta_historico_falta_idx ON public.produtos_em_falta_historico (falta_id, created_at DESC);

GRANT SELECT, INSERT ON public.produtos_em_falta_historico TO authenticated;
GRANT ALL ON public.produtos_em_falta_historico TO service_role;

ALTER TABLE public.produtos_em_falta_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY produtos_em_falta_historico_select ON public.produtos_em_falta_historico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY produtos_em_falta_historico_insert ON public.produtos_em_falta_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);