CREATE POLICY "members read work files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'work-files');
CREATE POLICY "members upload own work files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "members update own work files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'work-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "members delete own work files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'work-files' AND (storage.foldername(name))[1] = auth.uid()::text);