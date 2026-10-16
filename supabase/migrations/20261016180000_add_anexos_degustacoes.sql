-- ============================================================================
-- MIGRATION: SUPORTE A ANEXOS E MATERIAIS DE IMPRESSÃO/DECORAÇÃO EM DEGUSTAÇÕES
-- Central de Campanhas Sumel
-- ============================================================================

-- 1. Adiciona coluna anexos na tabela public.degustacoes (JSONB)
ALTER TABLE public.degustacoes 
ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.degustacoes.anexos IS 'Lista de anexos e materiais de apoio para impressão e decoração do espaço (PDF, JPG, PNG)';

-- 2. Criação do Bucket de Storage no Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('degustacao-materiais', 'degustacao-materiais', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Garante que RLS está habilitado em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acesso ao Bucket degustacao-materiais
DROP POLICY IF EXISTS "degustacao_materiais_read" ON storage.objects;
DROP POLICY IF EXISTS "degustacao_materiais_insert" ON storage.objects;
DROP POLICY IF EXISTS "degustacao_materiais_update" ON storage.objects;
DROP POLICY IF EXISTS "degustacao_materiais_delete" ON storage.objects;

-- Leitura pública / autenticada
CREATE POLICY "degustacao_materiais_read" ON storage.objects 
FOR SELECT TO anon, authenticated 
USING (bucket_id = 'degustacao-materiais');

-- Inserção de materiais por usuários autenticados e anônimos (consistente com campanha-materiais)
CREATE POLICY "degustacao_materiais_insert" ON storage.objects 
FOR INSERT TO anon, authenticated 
WITH CHECK (bucket_id = 'degustacao-materiais');

-- Atualização de materiais
CREATE POLICY "degustacao_materiais_update" ON storage.objects 
FOR UPDATE TO anon, authenticated 
USING (bucket_id = 'degustacao-materiais');

-- Exclusão de materiais
CREATE POLICY "degustacao_materiais_delete" ON storage.objects 
FOR DELETE TO anon, authenticated 
USING (bucket_id = 'degustacao-materiais');
