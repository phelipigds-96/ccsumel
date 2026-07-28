CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  data_inicial date,
  data_final date,
  status text NOT NULL DEFAULT 'Rascunho',
  filiais jsonb NOT NULL DEFAULT '[]'::jsonb,
  clube_sumel boolean NOT NULL DEFAULT false,
  materiais jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas TO anon, authenticated;
GRANT ALL ON public.campanhas TO service_role;
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY campanhas_all ON public.campanhas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  codigo text NOT NULL DEFAULT '',
  gtin text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  fornecedor text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  preco_normal numeric NOT NULL DEFAULT 0,
  custo numeric NOT NULL DEFAULT 0,
  preco_promocional numeric NOT NULL DEFAULT 0,
  clube_sumel boolean NOT NULL DEFAULT false,
  data_inicial date,
  data_final date,
  filiais jsonb NOT NULL DEFAULT '[]'::jsonb,
  corredor text NOT NULL DEFAULT '',
  estoque numeric NOT NULL DEFAULT 0,
  margem numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Rascunho',
  sellout_tem_verba boolean NOT NULL DEFAULT false,
  sellout_fornecedor text NOT NULL DEFAULT '',
  sellout_valor numeric NOT NULL DEFAULT 0,
  sellout_obs text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ofertas_campanha_id_idx ON public.ofertas (campanha_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ofertas TO anon, authenticated;
GRANT ALL ON public.ofertas TO service_role;
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY ofertas_all ON public.ofertas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.acertos (
  oferta_id uuid PRIMARY KEY REFERENCES public.ofertas(id) ON DELETE CASCADE,
  quantidade_vendida numeric NOT NULL DEFAULT 0,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acertos TO anon, authenticated;
GRANT ALL ON public.acertos TO service_role;
ALTER TABLE public.acertos ENABLE ROW LEVEL SECURITY;
CREATE POLICY acertos_all ON public.acertos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER campanhas_set_updated_at BEFORE UPDATE ON public.campanhas FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();
CREATE TRIGGER ofertas_set_updated_at BEFORE UPDATE ON public.ofertas FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();
CREATE TRIGGER acertos_set_updated_at BEFORE UPDATE ON public.acertos FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();