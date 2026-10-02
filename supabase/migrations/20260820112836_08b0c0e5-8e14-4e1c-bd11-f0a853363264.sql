-- Admin moderation on works
CREATE POLICY "admins update any work"
ON public.works FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete any work"
ON public.works FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin moderation on comments
CREATE POLICY "admins delete any comment"
ON public.comments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can remove any stored file in the library bucket
CREATE POLICY "admins delete any work file"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'work-files' AND public.has_role(auth.uid(), 'admin'));