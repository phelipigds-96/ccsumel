GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS produtos_gtin_unique_idx
ON public.produtos (gtin)
WHERE gtin IS NOT NULL;