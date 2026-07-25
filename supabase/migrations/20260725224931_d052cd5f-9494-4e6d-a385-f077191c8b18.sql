CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_produtos_descricao_trgm ON public.produtos USING gin (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_trgm ON public.produtos USING gin (codigo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produtos_gtin_trgm ON public.produtos USING gin (gtin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON public.produtos (ativo);