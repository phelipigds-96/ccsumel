WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY gtin ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.produtos
  WHERE gtin IS NOT NULL
)
DELETE FROM public.produtos p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS public.produtos_gtin_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS produtos_gtin_unique_idx
ON public.produtos (gtin);