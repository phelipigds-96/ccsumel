-- Substitui o índice UNIQUE parcial em codigo por uma CONSTRAINT UNIQUE completa,
-- necessária para que o upsert via ON CONFLICT (codigo) funcione.
DROP INDEX IF EXISTS public.produtos_codigo_key;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_codigo_unique UNIQUE (codigo);