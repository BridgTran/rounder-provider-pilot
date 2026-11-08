-- Provider profiles (auto-created on signup)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_name text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Providers update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Per-provider match credit balance (mutated only via security-definer functions)
CREATE TABLE public.provider_credits (
  provider_id uuid PRIMARY KEY,
  balance int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.provider_credits TO authenticated;
GRANT ALL ON public.provider_credits TO service_role;
ALTER TABLE public.provider_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own credits" ON public.provider_credits FOR SELECT TO authenticated USING (auth.uid() = provider_id);

-- Anonymized student records (no PII here)
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code text NOT NULL UNIQUE,
  degree_title text NOT NULL,
  degree text NOT NULL,
  discipline text NOT NULL,
  year_label text NOT NULL,
  uni text NOT NULL,
  raw_gpa numeric NOT NULL,
  weekly_hours numeric NOT NULL,
  work_sector text NOT NULL,
  visa_status text NOT NULL,
  year_level int NOT NULL,
  study_mode text NOT NULL,
  study_load int NOT NULL,
  birth_year int NOT NULL,
  equity_tags text[] NOT NULL DEFAULT '{}',
  verified_centrelink boolean NOT NULL DEFAULT false,
  verified_low_ses boolean NOT NULL DEFAULT false,
  client_empathy int NOT NULL,
  pressure_resilience int NOT NULL,
  crisis_management int NOT NULL,
  adaptability int NOT NULL,
  endorsement text NOT NULL DEFAULT '',
  endorser text NOT NULL DEFAULT '',
  traits text[] NOT NULL DEFAULT '{}',
  program text NOT NULL DEFAULT '',
  org_mask text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in providers read anonymized students" ON public.students FOR SELECT TO authenticated USING (true);

-- Student PII: readable only by a provider whose match was accepted (RLS-enforced reveal)
CREATE TABLE public.student_identities (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  transcript_url text NOT NULL
);
GRANT SELECT ON public.student_identities TO authenticated;
GRANT ALL ON public.student_identities TO service_role;
ALTER TABLE public.student_identities ENABLE ROW LEVEL SECURITY;

-- Match requests (insert via request_match(); accept via accept_match())
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (provider_id, student_id)
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() = provider_id);

-- Identity reveal policy (references matches, so created after it)
CREATE POLICY "Providers read identity after accepted match" ON public.student_identities
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.student_id = student_identities.student_id
      AND m.provider_id = auth.uid()
      AND m.status = 'accepted'
  ));

-- Provider-owned scholarship funds
CREATE TABLE public.scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  title text NOT NULL,
  org_class text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  stipend_aud int,
  finalist_requirements text[] NOT NULL DEFAULT '{}',
  life_load text[] NOT NULL DEFAULT '{}',
  min_empathy int NOT NULL DEFAULT 0,
  min_resilience int NOT NULL DEFAULT 0,
  discipline text NOT NULL DEFAULT 'All Disciplines',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarships TO authenticated;
GRANT ALL ON public.scholarships TO service_role;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own funds" ON public.scholarships FOR SELECT TO authenticated USING (auth.uid() = provider_id);
CREATE POLICY "Providers create own funds" ON public.scholarships FOR INSERT TO authenticated WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Providers update own funds" ON public.scholarships FOR UPDATE TO authenticated USING (auth.uid() = provider_id);
CREATE POLICY "Providers delete own funds" ON public.scholarships FOR DELETE TO authenticated USING (auth.uid() = provider_id);

-- Signup trigger: profile + starter credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, organisation_name, contact_person)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'organisation_name', ''),
    coalesce(new.raw_user_meta_data->>'contact_person', '')
  );
  INSERT INTO public.provider_credits (provider_id, balance) VALUES (new.id, 12);
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic match request: checks + spends 1 credit, creates the pending match
CREATE OR REPLACE FUNCTION public.request_match(p_student_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
  v_match public.matches;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE provider_id = auth.uid() AND student_id = p_student_id) THEN
    RAISE EXCEPTION 'Match already requested for this candidate';
  END IF;
  SELECT balance INTO v_balance FROM public.provider_credits WHERE provider_id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL THEN
    INSERT INTO public.provider_credits (provider_id, balance) VALUES (auth.uid(), 12)
    RETURNING balance INTO v_balance;
  END IF;
  IF v_balance < 1 THEN
    RAISE EXCEPTION 'No Match Credits remaining';
  END IF;
  UPDATE public.provider_credits SET balance = balance - 1 WHERE provider_id = auth.uid();
  INSERT INTO public.matches (provider_id, student_id) VALUES (auth.uid(), p_student_id)
  RETURNING * INTO v_match;
  RETURN v_match;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_match(uuid) TO authenticated;

-- Demo credit top-up
CREATE OR REPLACE FUNCTION public.top_up_credits(p_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.provider_credits (provider_id, balance) VALUES (auth.uid(), p_amount)
  ON CONFLICT (provider_id) DO UPDATE SET balance = provider_credits.balance + p_amount
  RETURNING balance INTO v_balance;
  RETURN v_balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.top_up_credits(int) TO authenticated;

-- Student accepts a pending request (student view is public; flips pending -> accepted only)
CREATE OR REPLACE FUNCTION public.accept_match(p_candidate_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches m
  SET status = 'accepted', accepted_at = now()
  FROM public.students s
  WHERE m.student_id = s.id
    AND s.candidate_code = p_candidate_code
    AND m.status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_match(text) TO anon, authenticated;

-- Public student-view feed of incoming requests (org name revealed only after accept)
CREATE OR REPLACE FUNCTION public.list_student_requests()
RETURNS TABLE (candidate_code text, program text, status text, organisation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.candidate_code,
    s.program,
    m.status,
    CASE WHEN m.status = 'accepted' THEN p.organisation_name ELSE s.org_mask END
  FROM public.matches m
  JOIN public.students s ON s.id = m.student_id
  JOIN public.profiles p ON p.id = m.provider_id;
$$;
GRANT EXECUTE ON FUNCTION public.list_student_requests() TO anon, authenticated;

-- Seed: the 5 demo candidates (anonymized records)
INSERT INTO public.students (
  id, candidate_code, degree_title, degree, discipline, year_label, uni,
  raw_gpa, weekly_hours, work_sector, visa_status, year_level, study_mode, study_load,
  birth_year, equity_tags, verified_centrelink, verified_low_ses,
  client_empathy, pressure_resilience, crisis_management, adaptability,
  endorsement, endorser, traits, program, org_mask
) VALUES
  ('00000000-0000-4000-8000-000000088942', 'CANDIDATE #AU-88942', 'Bachelor of Laws', 'Bachelor of Laws', 'Law', '3rd Year', 'Sandstone University (anonymized)',
   76, 25, 'Hospitality', 'Citizen', 3, 'Internal', 75,
   2003, ARRAY['First-Gen Student', 'High External Workload 20+ hrs', 'Low-SES Postcode'], true, true,
   92, 88, 84, 86,
   'Shows up to every society shift after a 10-hour work roster and still lifts the whole team. First person I''d hire.', 'President, Law Students'' Society',
   ARRAY['First-Gen', '20+ hrs work', 'Distinction avg'], 'Commercial Pathways', 'Top-Tier Law Firm'),
  ('00000000-0000-4000-8000-000000031076', 'CANDIDATE #AU-31076', 'Bachelor of Engineering (Civil)', 'Bachelor of Engineering (Civil)', 'Engineering', '4th Year', 'Regional University (anonymized)',
   72, 30, 'Trades', 'Citizen', 4, 'Hybrid', 75,
   1998, ARRAY['Regional/Remote Background', 'Primary Caretaker'], false, false,
   80, 90, 88, 92,
   'Drove 400km each week for capstone placements while caring for a parent. Never missed a deadline, never complained.', 'President, Engineering Society',
   ARRAY['Regional/Remote', 'Primary Caretaker'], 'Regional Engineering Scholarship', 'Fortune 100 Miner'),
  ('00000000-0000-4000-8000-000000055213', 'CANDIDATE #AU-55213', 'Bachelor of Commerce', 'Bachelor of Commerce', 'Business', '2nd Year', 'Metro University (anonymized)',
   74, 22, 'Retail', 'Permanent Resident', 2, 'Internal', 100,
   2004, ARRAY['First-Gen Student', 'High External Workload 20+ hrs'], true, false,
   86, 82, 78, 84,
   'Built our case-competition program from zero while working three casual jobs. Relentless in the best way.', 'President, Business Students'' Association',
   ARRAY['First-Gen', '20+ hrs work'], 'Leadership Stream', 'Big Four Bank'),
  ('00000000-0000-4000-8000-000000070415', 'CANDIDATE #AU-70415', 'Bachelor of Nursing', 'Bachelor of Nursing', 'Medicine', '3rd Year', 'Coastal University (anonymized)',
   70, 32, 'Hospital / Clinical Care', 'Citizen', 3, 'Internal', 75,
   1994, ARRAY['Low-SES Postcode', 'Primary Caretaker', 'High External Workload 20+ hrs'], true, true,
   95, 93, 91, 88,
   'Ran night shifts on a cardiac ward and still tutored first-years every Saturday. Calm under genuine pressure.', 'President, Nursing Students'' Society',
   ARRAY['Mature Age', 'Clinical shifts', 'Low-SES'], 'Future Health Leaders Grant', 'National Health Network'),
  ('00000000-0000-4000-8000-000000019638', 'CANDIDATE #AU-19638', 'Bachelor of Communications', 'Bachelor of Communications', 'Arts', '2nd Year', 'Inner-City University (anonymized)',
   81, 14, 'Administration', 'Student Visa 500', 2, 'Online', 50,
   2003, ARRAY['Regional/Remote Background'], false, false,
   84, 72, 68, 80,
   'Turned our student magazine around in a semester while studying remotely from three hours out of town.', 'President, Media & Communications Collective',
   ARRAY['Regional/Remote', 'Online study'], 'Creative Industries Fellowship', 'Global Media Group');

-- Seed: student PII (locked behind the accepted-match RLS policy)
INSERT INTO public.student_identities (student_id, legal_name, phone, email, transcript_url) VALUES
  ('00000000-0000-4000-8000-000000088942', 'Priya Raman', '+61 412 884 902', 'p.raman@student.edu.au', 'https://my.equals.com/transcripts/AU-88942'),
  ('00000000-0000-4000-8000-000000031076', 'Jack Mereweather', '+61 438 310 776', 'j.mereweather@student.edu.au', 'https://my.equals.com/transcripts/AU-31076'),
  ('00000000-0000-4000-8000-000000055213', 'Amira Haddad', '+61 421 552 130', 'a.haddad@student.edu.au', 'https://my.equals.com/transcripts/AU-55213'),
  ('00000000-0000-4000-8000-000000070415', 'Dana Kowalski', '+61 470 415 208', 'd.kowalski@student.edu.au', 'https://my.equals.com/transcripts/AU-70415'),
  ('00000000-0000-4000-8000-000000019638', 'Levi Okafor', '+61 419 638 441', 'l.okafor@student.edu.au', 'https://my.equals.com/transcripts/AU-19638');