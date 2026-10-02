CREATE TYPE public.app_role AS ENUM ('admin','member');
CREATE TYPE public.work_type AS ENUM ('book','notebook');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by members" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by members" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.member_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  passcode_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.member_credentials TO service_role;
ALTER TABLE public.member_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  subtype text,
  work_type public.work_type NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_subject_valid CHECK (subject IN ('English','Hindi','Maths','Science','SST','French','Reasoning','GK')),
  CONSTRAINT work_subtype_valid CHECK (
    (subject IN ('English','Hindi') AND subtype IN ('Literature','Language'))
    OR (subject NOT IN ('English','Hindi') AND subtype IS NULL)
  ),
  CONSTRAINT work_type_valid CHECK (
    subject NOT IN ('Reasoning','GK') OR work_type = 'book'
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.works TO authenticated;
GRANT ALL ON public.works TO service_role;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "works readable by members" ON public.works FOR SELECT TO authenticated USING (true);
CREATE POLICY "members upload own works" ON public.works FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "members update own works" ON public.works FOR UPDATE TO authenticated USING (auth.uid() = uploader_id) WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "members delete own works" ON public.works FOR DELETE TO authenticated USING (auth.uid() = uploader_id);
CREATE INDEX works_subject_idx ON public.works (subject, work_type, created_at DESC);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable by members" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "members write own comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "members update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "members delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE INDEX comments_work_idx ON public.comments (work_id, created_at);