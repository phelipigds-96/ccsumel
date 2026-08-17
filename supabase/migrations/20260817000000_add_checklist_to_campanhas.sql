-- Add checklist column to campanhas table
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

-- Update existing campanhas to have the default checklist if it's currently empty/null
UPDATE public.campanhas
SET checklist = '[
  {"id": "c1", "task": "Coletar produtos", "status": "Pendente"},
  {"id": "c2", "task": "Precificar ofertas", "status": "Pendente"},
  {"id": "c3", "task": "Cadastrar no Sistema", "status": "Pendente"},
  {"id": "c4", "task": "Fazer cartazes para impressão", "status": "Pendente"},
  {"id": "c5", "task": "Criar encarte digital", "status": "Pendente"}
]'::jsonb
WHERE checklist IS NULL OR checklist = '[]'::jsonb;
