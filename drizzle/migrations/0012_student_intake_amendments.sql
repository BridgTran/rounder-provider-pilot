-- 0013: students can amend their intake answers until they are shortlisted (or Rounder reopens it). Requires 0011.
ALTER TABLE public.student_invites ADD COLUMN intake_unlocked_at timestamptz;

CREATE TABLE public.student_intake_edits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE, edited_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.student_intake_edits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.student_intake_edits TO service_role;

ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_event_type_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_event_type_check
  CHECK (event_type IN ('matched','unlock requested','accepted','declined','rule changed','rule attested','shortlisted','invited','submitted','returned','checked','released','intake edited'));

-- Editable while no live application exists (declined ones do not count), or when Rounder has reopened it.
CREATE FUNCTION public.intake_editable(p_student uuid, p_unlocked timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT p_unlocked IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.matches WHERE student_id = p_student AND stage <> 'declined') $$;
REVOKE ALL ON FUNCTION public.intake_editable(uuid,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.student_get_intake(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; r jsonb;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now();
IF NOT FOUND OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT jsonb_build_object(
 'legalName',i.legal_name,'email',i.email,'phone',i.phone,'degree',s.degree,'discipline',s.discipline,'rawGpa',s.raw_gpa,'weeklyHours',s.weekly_hours,
 'workSector',s.work_sector,'visaStatus',s.visa_status,'yearLevel',s.year_level,'studyMode',s.study_mode,'studyLoad',s.study_load,'birthYear',s.birth_year,
 'equityTags',to_jsonb(s.equity_tags),'gender',coalesce(e.gender,''),'degreeLevel',coalesce(e.degree_level,''),
 'firstUndergraduateDegree',CASE e.first_undergraduate_degree WHEN true THEN 'yes' WHEN false THEN 'no' ELSE '' END,
 'yearsCompleted',e.years_completed,'campusState',coalesce(e.campus_state,''),'institution',coalesce(e.institution,''),
 'state',coalesce(e.state,''),'postcode',coalesce(e.postcode,''),'region',coalesce(e.region,''),'householdIncome',e.household_income,
 'firstGeneration',CASE e.first_generation WHEN true THEN 'yes' WHEN false THEN 'no' ELSE '' END,
 'centrelink',CASE e.centrelink_concession WHEN true THEN 'yes' WHEN false THEN 'no' ELSE '' END,
 'firstDegreeCompletionYear',e.first_degree_completion_year,
 'intendsFurtherStudy',CASE e.intends_further_study WHEN true THEN 'yes' WHEN false THEN 'no' ELSE '' END,
 'communityContribution',CASE e.community_contribution WHEN true THEN 'yes' WHEN false THEN 'no' ELSE '' END,
 'editable',public.intake_editable(s.id, v_inv.intake_unlocked_at)) INTO r
FROM public.students s JOIN public.student_identities i ON i.student_id=s.id LEFT JOIN public.student_eligibility e ON e.student_id=s.id WHERE s.id=v_inv.student_id;
RETURN r; END $$;
REVOKE ALL ON FUNCTION public.student_get_intake(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_intake(text) TO anon, authenticated;

CREATE FUNCTION public.student_update_intake(p_token text, p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; v_year int; v_load int; v_gpa numeric; v_hours numeric; v_sector text;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now() FOR UPDATE;
IF NOT FOUND OR v_inv.student_id IS NULL OR v_inv.consented_at IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
IF NOT public.intake_editable(v_inv.student_id, v_inv.intake_unlocked_at) THEN RAISE EXCEPTION 'Your answers are locked because you have been shortlisted. Ask Rounder to reopen them.'; END IF;
IF length(trim(coalesce(p_payload->>'legalName',''))) < 1 OR length(trim(coalesce(p_payload->>'degree',''))) < 1 OR coalesce(p_payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Name, email and degree are required'; END IF;
v_year := (p_payload->>'yearLevel')::int; v_load := (p_payload->>'studyLoad')::int; v_gpa := (p_payload->>'rawGpa')::numeric; v_hours := coalesce((p_payload->>'weeklyHours')::numeric,0);
IF v_year IS NULL OR v_year NOT BETWEEN 1 AND 6 OR v_load IS NULL OR v_load NOT IN(25,50,75,100) OR v_gpa IS NULL OR v_gpa NOT BETWEEN 0 AND 100 OR v_hours NOT BETWEEN 0 AND 168 OR (p_payload->>'birthYear')::int NOT BETWEEN 1900 AND extract(year FROM now()) THEN RAISE EXCEPTION 'Invalid intake values'; END IF;
v_sector := coalesce(nullif(p_payload->>'workSector',''),'Other');
IF coalesce(p_payload->>'discipline','') NOT IN('Law','Engineering','Business','Medicine','Arts','Science','Health','Education','IT','Other') OR coalesce(p_payload->>'studyMode','') NOT IN('Internal','Online','Hybrid') OR v_sector NOT IN('Hospitality','Retail','Hospital / Clinical Care','Administration','Tutoring','Trades','Other') THEN RAISE EXCEPTION 'Invalid intake selection'; END IF;
UPDATE public.students SET degree_title=p_payload->>'degree', degree=p_payload->>'degree', discipline=p_payload->>'discipline', year_label='Year '||v_year, raw_gpa=v_gpa, weekly_hours=v_hours, work_sector=v_sector,
 visa_status=p_payload->>'visaStatus', year_level=v_year, study_mode=p_payload->>'studyMode', study_load=v_load, birth_year=(p_payload->>'birthYear')::int,
 equity_tags=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'equityTags','[]'::jsonb))), traits=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'equityTags','[]'::jsonb)))
 WHERE id=v_inv.student_id;
UPDATE public.student_identities SET legal_name=trim(p_payload->>'legalName'), phone=coalesce(p_payload->>'phone',''), email=p_payload->>'email' WHERE student_id=v_inv.student_id;
INSERT INTO public.student_eligibility(student_id) VALUES(v_inv.student_id) ON CONFLICT (student_id) DO NOTHING;
UPDATE public.student_eligibility SET state=nullif(p_payload->>'state',''), postcode=nullif(p_payload->>'postcode',''), region=nullif(p_payload->>'region',''), institution=nullif(p_payload->>'institution',''),
 household_income=(p_payload->>'householdIncome')::int, first_generation=CASE p_payload->>'firstGeneration' WHEN 'yes' THEN true WHEN 'no' THEN false END,
 centrelink_concession=CASE p_payload->>'centrelink' WHEN 'yes' THEN true WHEN 'no' THEN false END, gender=nullif(p_payload->>'gender',''), degree_level=nullif(p_payload->>'degreeLevel',''),
 first_undergraduate_degree=CASE p_payload->>'firstUndergraduateDegree' WHEN 'yes' THEN true WHEN 'no' THEN false END, years_completed=(p_payload->>'yearsCompleted')::numeric,
 campus_state=nullif(p_payload->>'campusState',''), first_degree_completion_year=(p_payload->>'firstDegreeCompletionYear')::int,
 intends_further_study=CASE p_payload->>'intendsFurtherStudy' WHEN 'yes' THEN true WHEN 'no' THEN false END,
 community_contribution=CASE p_payload->>'communityContribution' WHEN 'yes' THEN true WHEN 'no' THEN false END
 WHERE student_id=v_inv.student_id;
INSERT INTO public.student_intake_edits(student_id) VALUES(v_inv.student_id);
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version)
 SELECT 'intake edited', v_inv.id::text, 'student', m.organisation_id, m.fund_id, m.rule_version FROM public.matches m WHERE m.student_id=v_inv.student_id AND m.organisation_id IS NOT NULL AND m.stage<>'declined';
RETURN jsonb_build_object('updated',true); END $$;
REVOKE ALL ON FUNCTION public.student_update_intake(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_update_intake(text,jsonb) TO anon, authenticated;

-- Rounder can reopen (or relock) a student's answers after shortlisting.
CREATE FUNCTION public.admin_set_intake_unlock(p_student_id uuid, p_unlocked boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
UPDATE public.student_invites SET intake_unlocked_at = CASE WHEN p_unlocked THEN now() ELSE NULL END WHERE student_id = p_student_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF; END $$;
REVOKE ALL ON FUNCTION public.admin_set_intake_unlock(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_intake_unlock(uuid,boolean) TO authenticated;
