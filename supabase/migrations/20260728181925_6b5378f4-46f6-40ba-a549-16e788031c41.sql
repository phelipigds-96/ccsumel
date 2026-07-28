ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fornecedor text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  observacoes text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_nome_key ON public.fornecedores (nome);
CREATE INDEX IF NOT EXISTS produtos_fornecedor_idx ON public.produtos (fornecedor);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY fornecedores_select ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY fornecedores_insert ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (can_write());
CREATE POLICY fornecedores_update ON public.fornecedores FOR UPDATE TO authenticated USING (can_write()) WITH CHECK (can_write());
CREATE POLICY fornecedores_delete ON public.fornecedores FOR DELETE TO authenticated USING (can_write());

CREATE TRIGGER fornecedores_set_updated_at BEFORE UPDATE ON public.fornecedores
FOR EACH ROW EXECUTE FUNCTION public.produtos_set_updated_at();