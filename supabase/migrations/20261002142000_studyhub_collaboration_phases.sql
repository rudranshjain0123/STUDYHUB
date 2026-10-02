ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_color text NOT NULL DEFAULT 'teal',
  ADD COLUMN IF NOT EXISTS class_section text,
  ADD COLUMN IF NOT EXISTS roll_number text;
GRANT UPDATE (display_name, avatar_color, class_section, roll_number) ON public.profiles TO authenticated;
CREATE POLICY "members update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE public.bookmarks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage own bookmarks" ON public.bookmarks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.note_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  details text NOT NULL CHECK (char_length(details) BETWEEN 3 AND 1200),
  subject text NOT NULL CHECK (subject IN ('English','Hindi','Maths','Science','SST','French','Reasoning','GK')),
  subtype text CHECK (
    (subject IN ('English','Hindi') AND subtype IN ('Literature','Language'))
    OR (subject NOT IN ('English','Hindi') AND subtype IS NULL)
  ),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled')),
  fulfilled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fulfilled_work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_requests TO authenticated;
GRANT ALL ON public.note_requests TO service_role;
ALTER TABLE public.note_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read note requests" ON public.note_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create own note requests" ON public.note_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "members update own or fulfill open note requests" ON public.note_requests
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR status = 'open'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR fulfilled_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "members delete own note requests" ON public.note_requests
  FOR DELETE TO authenticated USING (requester_id = auth.uid());
CREATE POLICY "admins delete any note request" ON public.note_requests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX note_requests_status_created_idx ON public.note_requests (status, created_at DESC);

CREATE TABLE public.doubt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (subject IN ('English','Hindi','Maths','Science','SST','French','Reasoning','GK')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 3000),
  attachment_path text,
  attachment_name text,
  best_answer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.doubt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.doubt_questions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doubt_questions
  ADD CONSTRAINT doubt_questions_best_answer_id_fkey
  FOREIGN KEY (best_answer_id) REFERENCES public.doubt_answers(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doubt_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doubt_answers TO authenticated;
GRANT ALL ON public.doubt_questions TO service_role;
GRANT ALL ON public.doubt_answers TO service_role;

ALTER TABLE public.doubt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read doubt questions" ON public.doubt_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members ask own doubt questions" ON public.doubt_questions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "members update own doubt questions" ON public.doubt_questions
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members delete own doubt questions" ON public.doubt_questions
  FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "admins delete any doubt question" ON public.doubt_questions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "members read doubt answers" ON public.doubt_answers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members answer doubts" ON public.doubt_answers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "members update own doubt answers" ON public.doubt_answers
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members delete own doubt answers" ON public.doubt_answers
  FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "admins delete any doubt answer" ON public.doubt_answers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX doubt_questions_subject_created_idx ON public.doubt_questions (subject, created_at DESC);
CREATE INDEX doubt_answers_question_created_idx ON public.doubt_answers (question_id, created_at);

CREATE POLICY "members upload doubt attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = 'doubts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
CREATE POLICY "members update own doubt attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = 'doubts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
CREATE POLICY "members delete own doubt attachments" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = 'doubts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
