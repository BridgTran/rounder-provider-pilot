CREATE TYPE public.app_role AS ENUM ('admin', 'provider');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING(user_id = auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE TABLE public.student_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL, student_id uuid UNIQUE REFERENCES public.students(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days', consented_at timestamptz, consent_version text);
GRANT ALL ON public.student_invites TO service_role;
ALTER TABLE public.student_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ADD COLUMN declined_at timestamptz;
REVOKE SELECT ON public.students FROM anon;
DROP POLICY "Public read of anonymized students" ON public.students;
REVOKE ALL ON FUNCTION public.accept_match(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_student_requests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.top_up_credits(int) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.accept_match(text) IS 'DEPRECATED: replaced by token-scoped student_invite_action';
COMMENT ON FUNCTION public.list_student_requests() IS 'DEPRECATED: replaced by token-scoped student_invite_action';
COMMENT ON FUNCTION public.top_up_credits(int) IS 'DEPRECATED: shared demo wallet removed';
CREATE FUNCTION public.create_student_invite(p_token_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_id uuid; BEGIN
IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Provider sign-in required'; END IF;
IF p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
INSERT INTO public.student_invites(provider_id, token_hash) VALUES(auth.uid(),p_token_hash) RETURNING id INTO v_id; RETURN v_id; END $$;
REVOKE ALL ON FUNCTION public.create_student_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_student_invite(text) TO authenticated;
CREATE FUNCTION public.student_invite_action(p_token text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; v_student uuid; v_match public.matches; v_requests jsonb; v_year int; v_load int; v_gpa numeric; v_hours numeric;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
IF p_action = 'consent' THEN UPDATE public.student_invites SET consented_at = coalesce(consented_at,now()), consent_version = '1' WHERE id = v_inv.id; RETURN jsonb_build_object('consented',true,'submitted', v_inv.student_id IS NOT NULL,'requests','[]'::jsonb); END IF;
IF p_action = 'delete' THEN
IF v_inv.student_id IS NOT NULL THEN DELETE FROM public.students WHERE id = v_inv.student_id; ELSE DELETE FROM public.student_invites WHERE id = v_inv.id; END IF;
RETURN jsonb_build_object('deleted',true);
END IF;
IF p_action = 'intake' THEN
IF v_inv.consented_at IS NULL THEN RAISE EXCEPTION 'Consent is required before intake'; END IF;
IF v_inv.student_id IS NOT NULL THEN RAISE EXCEPTION 'Intake already submitted'; END IF;
IF length(trim(coalesce(p_payload->>'legalName',''))) < 1 OR length(trim(coalesce(p_payload->>'degree',''))) < 1 OR coalesce(p_payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Name, email and degree are required'; END IF;
v_year := (p_payload->>'yearLevel')::int; v_load := (p_payload->>'studyLoad')::int; v_gpa := (p_payload->>'rawGpa')::numeric; v_hours := (p_payload->>'weeklyHours')::numeric;
IF v_year IS NULL OR v_year NOT BETWEEN 1 AND 6 OR v_load IS NULL OR v_load NOT IN(25,50,75,100) OR v_gpa IS NULL OR v_gpa NOT BETWEEN 0 AND 100 OR v_hours IS NULL OR v_hours NOT BETWEEN 0 AND 168 OR (p_payload->>'birthYear')::int NOT BETWEEN 1900 AND extract(year FROM now()) THEN RAISE EXCEPTION 'Invalid intake values'; END IF;
IF coalesce(p_payload->>'discipline','') NOT IN('Law','Engineering','Business','Medicine','Arts') OR coalesce(p_payload->>'studyMode','') NOT IN('Internal','Online','Hybrid') OR coalesce(p_payload->>'workSector','') NOT IN('Hospitality','Retail','Hospital / Clinical Care','Administration','Tutoring','Trades','Other') THEN RAISE EXCEPTION 'Invalid intake selection'; END IF;
INSERT INTO public.students(candidate_code,degree_title,degree,discipline,year_label,uni,raw_gpa,weekly_hours,work_sector,visa_status,year_level,study_mode,study_load,birth_year,equity_tags,client_empathy,pressure_resilience,crisis_management,adaptability,endorsement,endorser,traits,program,org_mask)
VALUES('CANDIDATE #' || upper(substr(replace(v_inv.id::text,'-',''),1,12)),p_payload->>'degree',p_payload->>'degree',p_payload->>'discipline','Year '||v_year,'University withheld',v_gpa,v_hours,p_payload->>'workSector',p_payload->>'visaStatus',v_year,p_payload->>'studyMode',v_load,(p_payload->>'birthYear')::int,ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'equityTags','[]'::jsonb))),0,0,0,0,'','',ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'equityTags','[]'::jsonb))),'Scholarship applicant','Scholarship provider') RETURNING id INTO v_student;
INSERT INTO public.student_identities(student_id,legal_name,phone,email,transcript_url) VALUES(v_student,trim(p_payload->>'legalName'),coalesce(p_payload->>'phone',''),p_payload->>'email','');
UPDATE public.student_invites SET student_id = v_student WHERE id = v_inv.id;
v_inv.student_id := v_student;
ELSIF p_action = 'respond' THEN
IF v_inv.consented_at IS NULL OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Complete consent and intake first'; END IF;
SELECT * INTO v_match FROM public.matches WHERE id = (p_payload->>'matchId')::uuid AND student_id = v_inv.student_id FOR UPDATE;
IF NOT FOUND OR v_match.status <> 'pending' OR v_match.declined_at IS NOT NULL THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
IF p_payload->>'decision' = 'accept' THEN UPDATE public.matches SET status='accepted',accepted_at=now() WHERE id=v_match.id;
ELSIF p_payload->>'decision' = 'decline' THEN UPDATE public.matches SET declined_at=now() WHERE id=v_match.id;
ELSE RAISE EXCEPTION 'Choose accept or decline'; END IF;
ELSIF p_action <> 'read' THEN RAISE EXCEPTION 'Invalid action'; END IF;
SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'status',CASE WHEN m.declined_at IS NOT NULL THEN 'declined' ELSE m.status END,'organisation',CASE WHEN m.status='accepted' THEN p.organisation_name ELSE 'Scholarship provider' END,'contactPerson',CASE WHEN m.status='accepted' THEN p.contact_person ELSE NULL END,'email',CASE WHEN m.status='accepted' THEN u.email ELSE NULL END) ORDER BY m.created_at DESC),'[]'::jsonb) INTO v_requests FROM public.matches m JOIN public.profiles p ON p.id=m.provider_id LEFT JOIN auth.users u ON u.id=m.provider_id WHERE m.student_id = v_inv.student_id;
RETURN jsonb_build_object('consented',v_inv.consented_at IS NOT NULL,'submitted',v_inv.student_id IS NOT NULL,'requests',v_requests);
END $$;
REVOKE ALL ON FUNCTION public.student_invite_action(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_invite_action(text,text,jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.request_match(uuid) FROM PUBLIC, anon;
