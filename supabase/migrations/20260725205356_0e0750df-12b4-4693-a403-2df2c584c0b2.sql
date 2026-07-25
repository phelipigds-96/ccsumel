
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS custo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_key ON public.produtos (codigo) WHERE codigo IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.produto_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario text,
  arquivo text,
  processados integer NOT NULL DEFAULT 0,
  novos integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  sem_barras integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  duracao_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.produto_importacoes TO anon, authenticated;
GRANT ALL ON public.produto_importacoes TO service_role;

ALTER TABLE public.produto_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "importacoes_select_all" ON public.produto_importacoes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "importacoes_insert_all" ON public.produto_importacoes
  FOR INSERT TO anon, authenticated WITH CHECK (true);
