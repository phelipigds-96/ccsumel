CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gtin text UNIQUE,
  codigo text,
  descricao text NOT NULL,
  preco_venda numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO anon, authenticated;
GRANT ALL ON public.produtos TO service_role;

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_select_all" ON public.produtos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "produtos_insert_all" ON public.produtos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "produtos_update_all" ON public.produtos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "produtos_delete_all" ON public.produtos FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_produtos_gtin ON public.produtos(gtin);
CREATE INDEX idx_produtos_descricao ON public.produtos USING gin(to_tsvector('portuguese', descricao));

CREATE OR REPLACE FUNCTION public.produtos_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_produtos_updated_at BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();