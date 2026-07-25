
CREATE POLICY "campanha_materiais_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'campanha-materiais');
CREATE POLICY "campanha_materiais_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'campanha-materiais');
CREATE POLICY "campanha_materiais_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'campanha-materiais');
CREATE POLICY "campanha_materiais_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'campanha-materiais');
