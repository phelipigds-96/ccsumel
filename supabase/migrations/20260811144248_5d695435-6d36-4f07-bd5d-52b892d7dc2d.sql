ALTER TABLE public.acertos
  ADD COLUMN IF NOT EXISTS baixado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS baixado_em timestamp with time zone;