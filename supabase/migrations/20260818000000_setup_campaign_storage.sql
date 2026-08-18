-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('campanha-materiais', 'campanha-materiais', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "campanha_materiais_read" ON storage.objects;
DROP POLICY IF EXISTS "campanha_materiais_insert" ON storage.objects;
DROP POLICY IF EXISTS "campanha_materiais_update" ON storage.objects;
DROP POLICY IF EXISTS "campanha_materiais_delete" ON storage.objects;

-- Re-create policies with proper grants
CREATE POLICY "campanha_materiais_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'campanha-materiais');
CREATE POLICY "campanha_materiais_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'campanha-materiais');
CREATE POLICY "campanha_materiais_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'campanha-materiais');
CREATE POLICY "campanha_materiais_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'campanha-materiais');
