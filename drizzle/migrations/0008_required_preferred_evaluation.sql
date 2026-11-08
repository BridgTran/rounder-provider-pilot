CREATE FUNCTION public.evaluate_fund_rules(p_rules jsonb,p_discipline text,p_life_load text[],p_student uuid) RETURNS TABLE(rule_key text,preferred boolean,met boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT v.key,coalesce(p_rules->'strengths'->>v.key,'Required')='Preferred',coalesce(v.met,false) FROM public.students s LEFT JOIN public.student_eligibility e ON e.student_id=s.id CROSS JOIN LATERAL (VALUES
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
('institutions',coalesce(jsonb_array_length(p_rules->'institutions'),0)>0,e.institution IN(SELECT jsonb_array_elements_text(p_rules->'institutions')))
) v(key,active,met) WHERE s.id=p_student AND v.active $$;
REVOKE ALL ON FUNCTION public.evaluate_fund_rules(jsonb,text,text[],uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.fund_eligibility_results(p_rules jsonb,p_discipline text,p_life_load text[]) RETURNS TABLE(student_id uuid,preferences_met integer,preferences_total integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Provider sign-in required'; END IF;
RETURN QUERY SELECT s.id,(SELECT count(*)::int FROM public.evaluate_fund_rules(p_rules,p_discipline,p_life_load,s.id) r WHERE r.preferred AND r.met),(SELECT count(*)::int FROM public.evaluate_fund_rules(p_rules,p_discipline,p_life_load,s.id) r WHERE r.preferred) FROM public.students s WHERE NOT EXISTS(SELECT 1 FROM public.evaluate_fund_rules(p_rules,p_discipline,p_life_load,s.id) r WHERE NOT r.preferred AND NOT r.met); END $$;
REVOKE ALL ON FUNCTION public.fund_eligibility_results(jsonb,text,text[]) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.fund_eligibility_results(jsonb,text,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.eligible_scholarship_students(p_rules jsonb,p_discipline text,p_life_load text[]) RETURNS TABLE(student_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT student_id FROM public.fund_eligibility_results(p_rules,p_discipline,p_life_load) $$;
CREATE OR REPLACE FUNCTION public.record_scholarship_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='UPDATE' AND (NEW.provider_id<>OLD.provider_id OR NEW.organisation_id IS DISTINCT FROM OLD.organisation_id) THEN RAISE EXCEPTION 'Fund ownership cannot change'; END IF;
IF NEW.status NOT IN('draft','active') OR length(trim(NEW.title))=0 THEN RAISE EXCEPTION 'Invalid fund'; END IF;
IF (NEW.status='active' OR TG_OP='UPDATE') AND (NEW.deed_confirmed_at IS NULL OR (TG_OP='UPDATE' AND NEW.deed_confirmed_at IS NOT DISTINCT FROM OLD.deed_confirmed_at)) THEN RAISE EXCEPTION 'Confirm deed rules and authority for this fund'; END IF;
IF NEW.maximum_award_value<0 THEN RAISE EXCEPTION 'Award value must not be negative'; END IF;
IF NEW.status='active' AND (coalesce((NEW.rules->>'numberOfAwards')::int,0)<1 OR coalesce(NEW.rules->>'closeDate','')='' OR (NEW.rules->>'closeDate')::date<(now() AT TIME ZONE 'Australia/Sydney')::date) THEN RAISE EXCEPTION 'Activation requires awards and a current close date'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_each_text(coalesce(NEW.rules->'strengths','{}')) WHERE value NOT IN('Required','Preferred')) THEN RAISE EXCEPTION 'Invalid rule strength'; END IF;
IF NEW.deed_path IS NOT NULL AND (NEW.deed_path !~ '\.pdf$' OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='trust-deeds' AND o.name=NEW.deed_path) OR NOT (split_part(NEW.deed_path,'/',1)=auth.uid()::text OR (TG_OP='UPDATE' AND NEW.deed_path IS NOT DISTINCT FROM OLD.deed_path))) THEN RAISE EXCEPTION 'Invalid private deed'; END IF;
NEW.rule_version:=CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.rule_version+1 END; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.audit_scholarship_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_role text; BEGIN
SELECT member_role INTO v_role FROM public.organisation_members WHERE organisation_id=NEW.organisation_id AND user_id=auth.uid();
INSERT INTO public.scholarship_rule_versions(fund_id,provider_id,version,snapshot) VALUES(NEW.id,NEW.provider_id,NEW.rule_version,to_jsonb(NEW));
INSERT INTO public.scholarship_audit(fund_id,provider_id,actor_id,version,action,snapshot) VALUES(NEW.id,NEW.provider_id,auth.uid(),NEW.rule_version,CASE WHEN NEW.status='active' THEN 'activated' ELSE 'draft_saved' END,to_jsonb(NEW));
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES('rule changed',coalesce(auth.uid()::text,'system'),coalesce(v_role,'system'),NEW.organisation_id,NEW.id,NEW.rule_version);
IF NEW.deed_confirmed_at IS NOT NULL THEN INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES('rule attested',coalesce(auth.uid()::text,'system'),coalesce(v_role,'system'),NEW.organisation_id,NEW.id,NEW.rule_version); END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.save_scholarship_rules(p_fund_id uuid,p_expected_version integer,p_input jsonb,p_activate boolean,p_confirmed boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_fund public.scholarships; v_org uuid; v_id uuid:=nullif(p_fund_id,'00000000-0000-0000-0000-000000000000'::uuid); BEGIN
SELECT organisation_id INTO v_org FROM public.profiles WHERE id=auth.uid(); IF NOT public.is_organisation_member(v_org) THEN RAISE EXCEPTION 'Provider sign-in required'; END IF;
IF (p_activate OR v_id IS NOT NULL) AND NOT p_confirmed THEN RAISE EXCEPTION 'Confirm deed rules and authority for this fund'; END IF;
IF v_id IS NOT NULL THEN
SELECT * INTO v_fund FROM public.scholarships WHERE id=v_id AND organisation_id=v_org FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Fund not found'; END IF;
IF v_fund.rule_version<>p_expected_version THEN RAISE EXCEPTION 'This fund changed. Reopen it before saving'; END IF;
UPDATE public.scholarships SET title=p_input->>'title',org_class=p_input->>'orgClass',maximum_award_value=(p_input->>'maximumAwardValue')::int,discipline=p_input->>'discipline',life_load=ARRAY(SELECT jsonb_array_elements_text(p_input->'lifeLoad')),rules=p_input->'rules',status=CASE WHEN p_activate OR v_fund.status='active' THEN 'active' ELSE 'draft' END,deed_path=nullif(p_input->>'deedPath',''),deed_confirmed_at=CASE WHEN p_confirmed THEN clock_timestamp() END WHERE id=v_id RETURNING * INTO v_fund;
ELSE
INSERT INTO public.scholarships(provider_id,organisation_id,title,org_class,maximum_award_value,discipline,life_load,rules,status,deed_path,deed_confirmed_at) VALUES(auth.uid(),v_org,p_input->>'title',p_input->>'orgClass',(p_input->>'maximumAwardValue')::int,p_input->>'discipline',ARRAY(SELECT jsonb_array_elements_text(p_input->'lifeLoad')),p_input->'rules',CASE WHEN p_activate THEN 'active' ELSE 'draft' END,nullif(p_input->>'deedPath',''),CASE WHEN p_confirmed THEN clock_timestamp() END) RETURNING * INTO v_fund;
END IF; RETURN jsonb_build_object('id',v_fund.id,'version',v_fund.rule_version,'status',v_fund.status); END $$;
REVOKE ALL ON FUNCTION public.save_scholarship_rules_internal(uuid,integer,jsonb,boolean,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.request_fund_unlock(p_student_id uuid,p_fund_id uuid) RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_fund public.scholarships; v_match public.matches; v_balance int; v_role text; BEGIN
SELECT * INTO v_fund FROM public.scholarships WHERE id=p_fund_id AND public.is_organisation_member(organisation_id) FOR SHARE;
IF NOT FOUND OR v_fund.status<>'active' OR (v_fund.rules->>'closeDate')::date<(now() AT TIME ZONE 'Australia/Sydney')::date THEN RAISE EXCEPTION 'Choose an active, open fund'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student_id) OR EXISTS(SELECT 1 FROM public.evaluate_fund_rules(v_fund.rules,v_fund.discipline,v_fund.life_load,p_student_id) r WHERE NOT r.preferred AND NOT r.met) THEN RAISE EXCEPTION 'Student does not meet required rules'; END IF;
IF EXISTS(SELECT 1 FROM public.matches WHERE organisation_id=v_fund.organisation_id AND student_id=p_student_id) THEN RAISE EXCEPTION 'Your organisation already requested this student'; END IF;
SELECT balance INTO v_balance FROM public.provider_credits WHERE provider_id=auth.uid() FOR UPDATE; IF coalesce(v_balance,0)<1 THEN RAISE EXCEPTION 'No Match Credits remaining'; END IF;
UPDATE public.provider_credits SET balance=balance-1 WHERE provider_id=auth.uid();
INSERT INTO public.matches(provider_id,student_id,fund_id,rule_version,organisation_id) VALUES(auth.uid(),p_student_id,v_fund.id,v_fund.rule_version,v_fund.organisation_id) RETURNING * INTO v_match;
SELECT member_role INTO v_role FROM public.organisation_members WHERE organisation_id=v_fund.organisation_id AND user_id=auth.uid();
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES('matched',auth.uid()::text,v_role,v_fund.organisation_id,v_fund.id,v_fund.rule_version),('unlock requested',auth.uid()::text,v_role,v_fund.organisation_id,v_fund.id,v_fund.rule_version); RETURN v_match; END $$;
CREATE UNIQUE INDEX org_student_unlock_unique ON public.matches(organisation_id,student_id);
REVOKE ALL ON FUNCTION public.request_fund_unlock(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.request_fund_unlock(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.request_match(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.audit_unlock_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_actor text; BEGIN
IF NEW.fund_id IS NOT NULL AND ((NEW.status='accepted' AND OLD.status<>'accepted') OR (NEW.declined_at IS NOT NULL AND OLD.declined_at IS NULL)) THEN
SELECT id::text INTO v_actor FROM public.student_invites WHERE student_id=NEW.student_id;
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES(CASE WHEN NEW.declined_at IS NOT NULL THEN 'declined' ELSE 'accepted' END,coalesce(v_actor,'student'),'student',NEW.organisation_id,NEW.fund_id,NEW.rule_version); END IF; RETURN NEW; END $$;
CREATE TRIGGER unlock_decision_audit AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.audit_unlock_decision();