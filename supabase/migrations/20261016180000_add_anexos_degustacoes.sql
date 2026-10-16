-- ============================================================================
-- MIGRATION: SUPORTE A ANEXOS E MATERIAIS DE IMPRESSÃO/DECORAÇÃO EM DEGUSTAÇÕES
-- Central de Campanhas Sumel
-- ============================================================================

-- Adiciona a coluna 'anexos' na tabela public.degustacoes (JSONB)
ALTER TABLE public.degustacoes 
ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.degustacoes.anexos IS 'Lista de anexos e materiais de apoio para impressão e decoração do espaço (PDF, JPG, PNG)';
