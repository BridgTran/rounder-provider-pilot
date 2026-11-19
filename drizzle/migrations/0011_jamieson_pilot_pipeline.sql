-- 0011: Jamieson pilot pipeline: no provider credits; shortlist -> Rounder outreach -> paperwork check -> release.
-- NOTE: provider credits are no longer granted or spent; the old table and functions are dropped later in 0012.

ALTER TABLE public.student_eligibility
  ADD COLUMN first_degree_completion_year integer,
  ADD COLUMN intends_further_study boolean,
  ADD COLUMN community_contribution boolean;

ALTER TABLE public.matches
  ADD COLUMN stage text NOT NULL DEFAULT 'shortlisted',
  ADD COLUMN stage_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN release_consent_at timestamptz;
UPDATE public.matches SET stage = CASE WHEN declined_at IS NOT NULL THEN 'declined' WHEN status = 'accepted' THEN 'released' ELSE 'invited' END,
  release_consent_at = CASE WHEN status = 'accepted' THEN accepted_at END;
ALTER TABLE public.matches ADD CONSTRAINT matches_stage_check
  CHECK (stage IN ('shortlisted','invited','accepted','declined','submitted','returned','checked','released'));
ALTER TABLE public.matches DROP CONSTRAINT matches_provider_id_student_id_key;
DROP INDEX public.org_student_unlock_unique;
CREATE UNIQUE INDEX matches_fund_student_unique ON public.matches(fund_id, student_id) WHERE fund_id IS NOT NULL;

ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_event_type_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_event_type_check
  CHECK (event_type IN ('matched','unlock requested','accepted','declined','rule changed','rule attested','shortlisted','invited','submitted','returned','checked','released'));

-- Updated functions (eligibility validation, rule evaluator, student invite action, signup trigger function).
CREATE OR REPLACE FUNCTION public.validate_student_eligibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN
IF NEW.gender IS NOT NULL AND NEW.gender NOT IN('female','male','non-binary') THEN RAISE EXCEPTION 'Invalid gender'; END IF;
IF NEW.degree_level IS NOT NULL AND NEW.degree_level NOT IN('undergraduate','honours','postgraduate coursework','postgraduate research','not enrolled') THEN RAISE EXCEPTION 'Invalid degree level'; END IF;
IF NEW.years_completed<0 OR NEW.years_completed>20 OR NEW.household_income<0 THEN RAISE EXCEPTION 'Invalid eligibility values'; END IF;
IF NEW.institution IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.australian_universities WHERE name=NEW.institution) THEN RAISE EXCEPTION 'Choose a listed university'; END IF;
IF NEW.first_degree_completion_year IS NOT NULL AND NEW.first_degree_completion_year NOT BETWEEN 1990 AND extract(year FROM now())::int+1 THEN RAISE EXCEPTION 'Invalid completion year'; END IF;
RETURN NEW; END $function$;

CREATE OR REPLACE FUNCTION public.evaluate_fund_rules(p_rules jsonb, p_discipline text, p_life_load text[], p_student uuid)
 RETURNS TABLE(rule_key text, preferred boolean, met boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT v.key,coalesce(p_rules->'strengths'->>v.key,'Required')='Preferred',coalesce(v.met,false) FROM public.students s LEFT JOIN public.student_eligibility e ON e.student_id=s.id CROSS JOIN LATERAL (VALUES
('discipline',p_discipline<>'All Disciplines',s.discipline=p_discipline),('lifeLoad',cardinality(p_life_load)>0,s.equity_tags @> p_life_load),
('state',coalesce(p_rules->>'state','any')<>'any',e.state=p_rules->>'state'),
('postcodes',coalesce(jsonb_array_length(p_rules->'postcodes'),0)>0,e.postcode IN(SELECT jsonb_array_elements_text(p_rules->'postcodes'))),
('regions',coalesce(jsonb_array_length(p_rules->'regions'),0)>0,lower(e.region) IN(SELECT lower(jsonb_array_elements_text(p_rules->'regions')))),
('studyLoad',coalesce(p_rules->>'studyLoad','any')<>'any',CASE p_rules->>'studyLoad' WHEN 'full-time' THEN s.study_load>=75 ELSE s.study_load<75 END),
('maxHouseholdIncome',p_rules->>'maxHouseholdIncome' IS NOT NULL,e.household_income<=(p_rules->>'maxHouseholdIncome')::numeric),
('yearLevels',coalesce(jsonb_array_length(p_rules->'yearLevels'),0)>0,s.year_level IN(SELECT jsonb_array_elements_text(p_rules->'yearLevels')::int)),
('residencies',coalesce(jsonb_array_length(p_rules->'residencies'),0)>0,s.visa_status IN(SELECT jsonb_array_elements_text(p_rules->'residencies'))),
('firstGeneration',coalesce(p_rules->>'firstGeneration','any')<>'any',e.first_generation=(p_rules->>'firstGeneration'='yes')),
('centrelink',coalesce(p_rules->>'centrelink','any')<>'any',e.centrelink_concession=(p_rules->>'centrelink'='yes')),
('gender',coalesce(p_rules->>'gender','any')<>'any',e.gender=p_rules->>'gender'),
('degreeLevel',coalesce(p_rules->>'degreeLevel','any')<>'any',e.degree_level=p_rules->>'degreeLevel'),
('firstUndergraduateDegree',coalesce(p_rules->>'firstUndergraduateDegree','any')<>'any',e.first_undergraduate_degree=(p_rules->>'firstUndergraduateDegree'='yes')),
('yearsCompleted',p_rules->>'yearsCompleted' IS NOT NULL,e.years_completed>=(p_rules->>'yearsCompleted')::numeric),
('minimumAcademicAverage',p_rules->>'minimumAcademicAverage' IS NOT NULL,s.raw_gpa>=(p_rules->>'minimumAcademicAverage')::numeric),
('studyMode',coalesce(p_rules->>'studyMode','any')<>'any',CASE p_rules->>'studyMode' WHEN 'online' THEN s.study_mode='Online' ELSE s.study_mode='Internal' END),
('campusStates',coalesce(jsonb_array_length(p_rules->'campusStates'),0)>0,e.campus_state IN(SELECT jsonb_array_elements_text(p_rules->'campusStates'))),
('institutions',coalesce(jsonb_array_length(p_rules->'institutions'),0)>0,e.institution IN(SELECT jsonb_array_elements_text(p_rules->'institutions'))),
('completionYear',p_rules->>'completionYear' IS NOT NULL,e.first_degree_completion_year=(p_rules->>'completionYear')::int),
('furtherStudy',coalesce(p_rules->>'furtherStudy','any')<>'any',coalesce(e.intends_further_study,false)),
('communityContribution',coalesce(p_rules->>'communityContribution','any')<>'any',coalesce(e.community_contribution,false))
) v(key,active,met) WHERE s.id=p_student AND v.active $function$;

CREATE OR REPLACE FUNCTION public.student_invite_action(p_token text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
v_year := (p_payload->>'yearLevel')::int; v_load := (p_payload->>'studyLoad')::int; v_gpa := (p_payload->>'rawGpa')::numeric; v_hours := coalesce((p_payload->>'weeklyHours')::numeric,0);
IF v_year IS NULL OR v_year NOT BETWEEN 1 AND 6 OR v_load IS NULL OR v_load NOT IN(25,50,75,100) OR v_gpa IS NULL OR v_gpa NOT BETWEEN 0 AND 100 OR v_hours IS NULL OR v_hours NOT BETWEEN 0 AND 168 OR (p_payload->>'birthYear')::int NOT BETWEEN 1900 AND extract(year FROM now()) THEN RAISE EXCEPTION 'Invalid intake values'; END IF;
IF coalesce(p_payload->>'discipline','') NOT IN('Law','Engineering','Business','Medicine','Arts','Science','Health','Education','IT','Other') OR coalesce(p_payload->>'studyMode','') NOT IN('Internal','Online','Hybrid') OR coalesce(nullif(p_payload->>'workSector',''),'Other') NOT IN('Hospitality','Retail','Hospital / Clinical Care','Administration','Tutoring','Trades','Other') THEN RAISE EXCEPTION 'Invalid intake selection'; END IF;
INSERT INTO public.students(candidate_code,degree_title,degree,discipline,year_label,uni,raw_gpa,weekly_hours,work_sector,visa_status,year_level,study_mode,study_load,birth_year,equity_tags,client_empathy,pressure_resilience,crisis_management,adaptability,endorsement,endorser,traits,program,org_mask)
VALUES('CANDIDATE #' || upper(substr(replace(v_inv.id::text,'-',''),1,12)),p_payload->>'degree',p_payload->>'degree',p_payload->>'discipline','Year '||v_year,'University withheld',v_gpa,v_hours,coalesce(nullif(p_payload->>'workSector',''),'Other'),p_payload->>'visaStatus',v_year,p_payload->>'studyMode',v_load,(p_payload->>'birthYear')::int,ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'equityTags','[]'::jsonb))),0,0,0,0,'','',ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'equityTags','[]'::jsonb))),'Scholarship applicant','Scholarship provider') RETURNING id INTO v_student;
INSERT INTO public.student_identities(student_id,legal_name,phone,email,transcript_url) VALUES(v_student,trim(p_payload->>'legalName'),coalesce(p_payload->>'phone',''),p_payload->>'email','');
INSERT INTO public.student_eligibility(student_id,state,postcode,region,institution,household_income,first_generation,centrelink_concession,gender,degree_level,first_undergraduate_degree,years_completed,campus_state,first_degree_completion_year,intends_further_study,community_contribution) VALUES(v_student,nullif(p_payload->>'state',''),nullif(p_payload->>'postcode',''),nullif(p_payload->>'region',''),nullif(p_payload->>'institution',''),(p_payload->>'householdIncome')::int,CASE p_payload->>'firstGeneration' WHEN 'yes' THEN true WHEN 'no' THEN false END,CASE p_payload->>'centrelink' WHEN 'yes' THEN true WHEN 'no' THEN false END,nullif(p_payload->>'gender',''),nullif(p_payload->>'degreeLevel',''),CASE p_payload->>'firstUndergraduateDegree' WHEN 'yes' THEN true WHEN 'no' THEN false END,(p_payload->>'yearsCompleted')::numeric,nullif(p_payload->>'campusState',''),(p_payload->>'firstDegreeCompletionYear')::int,CASE p_payload->>'intendsFurtherStudy' WHEN 'yes' THEN true WHEN 'no' THEN false END,CASE p_payload->>'communityContribution' WHEN 'yes' THEN true WHEN 'no' THEN false END);
UPDATE public.student_invites SET student_id = v_student WHERE id = v_inv.id;
v_inv.student_id := v_student;
ELSIF p_action = 'respond' THEN
IF v_inv.consented_at IS NULL OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Complete consent and intake first'; END IF;
SELECT * INTO v_match FROM public.matches WHERE id = (p_payload->>'matchId')::uuid AND student_id = v_inv.student_id FOR UPDATE;
IF NOT FOUND OR v_match.stage <> 'invited' OR v_match.declined_at IS NOT NULL THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
IF p_payload->>'decision' = 'accept' THEN UPDATE public.matches SET status='accepted',stage='accepted',stage_updated_at=now(),accepted_at=now(),release_consent_at=now() WHERE id=v_match.id;
ELSIF p_payload->>'decision' = 'decline' THEN UPDATE public.matches SET declined_at=now(),stage='declined',stage_updated_at=now() WHERE id=v_match.id;
ELSE RAISE EXCEPTION 'Choose accept or decline'; END IF;
ELSIF p_action <> 'read' THEN RAISE EXCEPTION 'Invalid action'; END IF;
SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'status',CASE WHEN m.stage IN('shortlisted','invited') THEN 'pending' WHEN m.stage='declined' THEN 'declined' ELSE 'accepted' END,'stage',m.stage,'fundTitle',f.title,'organisation',CASE WHEN m.stage NOT IN('shortlisted','invited','declined') THEN p.organisation_name ELSE 'Scholarship provider' END,'contactPerson',CASE WHEN m.stage='released' THEN p.contact_person ELSE NULL END,'email',CASE WHEN m.stage='released' THEN u.email ELSE NULL END) ORDER BY m.created_at DESC),'[]'::jsonb) INTO v_requests FROM public.matches m JOIN public.profiles p ON p.id=m.provider_id LEFT JOIN public.scholarships f ON f.id=m.fund_id LEFT JOIN auth.users u ON u.id=m.provider_id WHERE m.student_id = v_inv.student_id AND m.stage <> 'shortlisted';
RETURN jsonb_build_object('consented',v_inv.consented_at IS NOT NULL,'submitted',v_inv.student_id IS NOT NULL,'requests',v_requests);
END $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN
INSERT INTO public.provider_organisations(id,name) VALUES(new.id,coalesce(new.raw_user_meta_data->>'organisation_name',''));
INSERT INTO public.organisation_members VALUES(new.id,new.id,'owner');
INSERT INTO public.profiles(id,organisation_name,contact_person,organisation_id) VALUES(new.id,coalesce(new.raw_user_meta_data->>'organisation_name',''),coalesce(new.raw_user_meta_data->>'contact_person',''),new.id);
RETURN new; END $function$;

-- Provider shortlists an eligible candidate (no credits). Identity stays hidden until Rounder releases the checked package.
CREATE FUNCTION public.shortlist_candidate(p_student_id uuid, p_fund_id uuid) RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fund public.scholarships; v_match public.matches; v_role text;
BEGIN
SELECT * INTO v_fund FROM public.scholarships WHERE id=p_fund_id AND public.is_organisation_member(organisation_id) FOR SHARE;
IF NOT FOUND OR v_fund.status<>'active' OR (v_fund.rules->>'closeDate')::date<(now() AT TIME ZONE 'Australia/Sydney')::date THEN RAISE EXCEPTION 'Choose an active, open fund'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student_id) OR EXISTS(SELECT 1 FROM public.evaluate_fund_rules(v_fund.rules,v_fund.discipline,v_fund.life_load,p_student_id) r WHERE NOT r.preferred AND NOT r.met) THEN RAISE EXCEPTION 'Student does not meet required rules'; END IF;
IF EXISTS(SELECT 1 FROM public.matches WHERE fund_id=v_fund.id AND student_id=p_student_id) THEN RAISE EXCEPTION 'This candidate is already shortlisted for this fund'; END IF;
INSERT INTO public.matches(provider_id,student_id,fund_id,rule_version,organisation_id,stage) VALUES(auth.uid(),p_student_id,v_fund.id,v_fund.rule_version,v_fund.organisation_id,'shortlisted') RETURNING * INTO v_match;
SELECT member_role INTO v_role FROM public.organisation_members WHERE organisation_id=v_fund.organisation_id AND user_id=auth.uid();
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES('shortlisted',auth.uid()::text,v_role,v_fund.organisation_id,v_fund.id,v_fund.rule_version);
RETURN v_match; END $$;
REVOKE ALL ON FUNCTION public.shortlist_candidate(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shortlist_candidate(uuid,uuid) TO authenticated;

CREATE FUNCTION public.admin_issue_student_invites(p_token_hashes text[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
IF p_token_hashes IS NULL OR cardinality(p_token_hashes) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Provide between 1 and 500 invitations'; END IF;
IF EXISTS(SELECT 1 FROM unnest(p_token_hashes) h WHERE h IS NULL OR h !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
INSERT INTO public.student_invites(provider_id, token_hash) SELECT auth.uid(), h FROM unnest(p_token_hashes) h;
GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count; END $$;
REVOKE ALL ON FUNCTION public.admin_issue_student_invites(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_student_invites(text[]) TO authenticated;

CREATE FUNCTION public.admin_advance_application(p_match_id uuid, p_to text) RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
SELECT * INTO v_m FROM public.matches WHERE id=p_match_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
IF NOT ((v_m.stage='shortlisted' AND p_to='invited') OR (v_m.stage IN('accepted','returned') AND p_to='submitted') OR (v_m.stage='submitted' AND p_to IN('checked','returned')) OR (v_m.stage='checked' AND p_to='released')) THEN RAISE EXCEPTION 'That step is not allowed from %', v_m.stage; END IF;
IF p_to='released' AND v_m.release_consent_at IS NULL THEN RAISE EXCEPTION 'The student has not consented to release'; END IF;
UPDATE public.matches SET stage=p_to, stage_updated_at=now() WHERE id=p_match_id RETURNING * INTO v_m;
IF v_m.organisation_id IS NOT NULL THEN
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES(p_to,auth.uid()::text,'system',v_m.organisation_id,v_m.fund_id,v_m.rule_version);
END IF;
RETURN v_m; END $$;
REVOKE ALL ON FUNCTION public.admin_advance_application(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_advance_application(uuid,text) TO authenticated;

-- Identity is revealed to the provider's organisation only once Rounder has checked and released the package.
DROP POLICY "Providers read identity after accepted match" ON public.student_identities;
DROP POLICY "org_identity_accepted" ON public.student_identities;
CREATE POLICY "org_identity_released" ON public.student_identities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.student_id = student_identities.student_id AND m.stage = 'released' AND (m.provider_id = auth.uid() OR public.is_organisation_member(m.organisation_id))));

-- (Legacy credit functions and public.provider_credits are removed in 0012, after the app code no longer uses them.)

-- Idempotent seed so a fresh database accepts the university choices mirrored in src/lib/universities.ts.
INSERT INTO public.australian_universities(name) VALUES
('Australian Catholic University'),
('Australian National University'),
('Avondale University'),
('Bond University'),
('Charles Darwin University'),
('Charles Sturt University'),
('CQUniversity'),
('Curtin University'),
('Deakin University'),
('Edith Cowan University'),
('Federation University Australia'),
('Flinders University'),
('Griffith University'),
('James Cook University'),
('La Trobe University'),
('Macquarie University'),
('Monash University'),
('Murdoch University'),
('Queensland University of Technology'),
('RMIT University'),
('Southern Cross University'),
('Swinburne University of Technology'),
('Torrens University Australia'),
('University of Adelaide'),
('Adelaide University'),
('University of Canberra'),
('University of Divinity'),
('University of Melbourne'),
('University of New England'),
('University of New South Wales'),
('University of Newcastle'),
('University of Notre Dame Australia'),
('University of Queensland'),
('University of South Australia'),
('University of Southern Queensland'),
('University of Sydney'),
('University of Tasmania'),
('University of Technology Sydney'),
('University of the Sunshine Coast'),
('University of Western Australia'),
('University of Wollongong'),
('Victoria University'),
('Western Sydney University')
ON CONFLICT (name) DO NOTHING;
