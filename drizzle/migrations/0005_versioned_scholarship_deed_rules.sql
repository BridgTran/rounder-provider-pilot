ALTER TABLE public.scholarships ADD COLUMN rules jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN status text NOT NULL DEFAULT 'draft', ADD COLUMN rule_version integer NOT NULL DEFAULT 0, ADD COLUMN deed_path text, ADD COLUMN deed_confirmed_at timestamptz;
COMMENT ON COLUMN public.scholarships.location IS 'DEPRECATED: structured geography is stored in rules';
CREATE TABLE public.scholarship_rule_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fund_id uuid NOT NULL REFERENCES public.scholarships(id), provider_id uuid NOT NULL, version integer NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(fund_id,version));
GRANT SELECT ON public.scholarship_rule_versions TO authenticated; GRANT ALL ON public.scholarship_rule_versions TO service_role;
ALTER TABLE public.scholarship_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own rule versions" ON public.scholarship_rule_versions FOR SELECT TO authenticated USING(provider_id=auth.uid());
CREATE TABLE public.scholarship_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fund_id uuid NOT NULL REFERENCES public.scholarships(id), provider_id uuid NOT NULL, actor_id uuid, version integer NOT NULL, action text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.scholarship_audit TO authenticated; GRANT ALL ON public.scholarship_audit TO service_role;
ALTER TABLE public.scholarship_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers read own fund audit" ON public.scholarship_audit FOR SELECT TO authenticated USING(provider_id=auth.uid());
CREATE TABLE public.student_eligibility (student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE, state text, postcode text, region text, institution text, household_income integer, first_generation boolean, centrelink_concession boolean);
GRANT ALL ON public.student_eligibility TO service_role;
ALTER TABLE public.student_eligibility ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.prevent_fund_history_changes() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Fund history is append-only'; END $$;
CREATE TRIGGER immutable_rule_versions BEFORE UPDATE OR DELETE ON public.scholarship_rule_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_fund_history_changes();
CREATE TRIGGER immutable_fund_audit BEFORE UPDATE OR DELETE ON public.scholarship_audit FOR EACH ROW EXECUTE FUNCTION public.prevent_fund_history_changes();
CREATE FUNCTION public.record_scholarship_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF TG_OP='UPDATE' AND NEW.provider_id <> OLD.provider_id THEN RAISE EXCEPTION 'Fund ownership cannot change'; END IF;
IF NEW.status NOT IN('draft','active') THEN RAISE EXCEPTION 'Invalid fund status'; END IF;
IF NEW.status='active' AND (NEW.deed_confirmed_at IS NULL OR (TG_OP='UPDATE' AND NEW.deed_confirmed_at IS NOT DISTINCT FROM OLD.deed_confirmed_at)) THEN RAISE EXCEPTION 'Confirm these rules reflect your trust deed'; END IF;
IF length(trim(NEW.title))=0 THEN RAISE EXCEPTION 'Fund title required'; END IF;
IF NEW.status='active' AND (coalesce((NEW.rules->>'numberOfAwards')::integer,0)<1 OR coalesce(NEW.rules->>'closeDate','')='' OR (NEW.rules->>'closeDate')::date < (now() AT TIME ZONE 'Australia/Sydney')::date) THEN RAISE EXCEPTION 'Activation requires awards and a current close date'; END IF;
IF NEW.deed_path IS NOT NULL AND (split_part(NEW.deed_path,'/',1) <> NEW.provider_id::text OR NEW.deed_path !~ '\.pdf$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='trust-deeds' AND name=NEW.deed_path)) THEN RAISE EXCEPTION 'Invalid private deed'; END IF;
NEW.rule_version := CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.rule_version+1 END;
RETURN NEW;
END $$;
CREATE FUNCTION public.audit_scholarship_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.scholarship_rule_versions(fund_id,provider_id,version,snapshot) VALUES(NEW.id,NEW.provider_id,NEW.rule_version,to_jsonb(NEW));
INSERT INTO public.scholarship_audit(fund_id,provider_id,actor_id,version,action,snapshot) VALUES(NEW.id,NEW.provider_id,auth.uid(),NEW.rule_version,CASE WHEN NEW.status='active' THEN 'activated' ELSE 'draft_saved' END,to_jsonb(NEW)); RETURN NEW;
END $$;
CREATE TRIGGER scholarship_version_before BEFORE INSERT OR UPDATE ON public.scholarships FOR EACH ROW EXECUTE FUNCTION public.record_scholarship_version();
CREATE TRIGGER scholarship_version_after AFTER INSERT OR UPDATE ON public.scholarships FOR EACH ROW EXECUTE FUNCTION public.audit_scholarship_version();
REVOKE INSERT,UPDATE,DELETE ON public.scholarships FROM authenticated;
CREATE FUNCTION public.save_scholarship_rules(p_fund_id uuid, p_expected_version integer, p_input jsonb, p_activate boolean, p_confirmed boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_fund public.scholarships; BEGIN
IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Provider sign-in required'; END IF;
IF p_activate AND NOT p_confirmed THEN RAISE EXCEPTION 'Confirm these rules reflect your trust deed'; END IF;
IF p_fund_id IS NOT NULL THEN
SELECT * INTO v_fund FROM public.scholarships WHERE id=p_fund_id AND provider_id=auth.uid() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Fund not found'; END IF;
IF v_fund.rule_version <> p_expected_version THEN RAISE EXCEPTION 'This fund changed. Reopen it before saving'; END IF;
UPDATE public.scholarships SET title=p_input->>'title',org_class=p_input->>'orgClass',location=coalesce(p_input->'rules'->>'state',''),stipend_aud=(p_input->>'stipendAud')::integer,discipline=p_input->>'discipline',life_load=ARRAY(SELECT jsonb_array_elements_text(p_input->'lifeLoad')),rules=p_input->'rules',status=CASE WHEN p_activate THEN 'active' ELSE 'draft' END,deed_path=nullif(p_input->>'deedPath',''),deed_confirmed_at=CASE WHEN p_activate THEN clock_timestamp() ELSE NULL END WHERE id=p_fund_id RETURNING * INTO v_fund;
ELSE
INSERT INTO public.scholarships(provider_id,title,org_class,location,stipend_aud,discipline,life_load,min_empathy,min_resilience,rules,status,deed_path,deed_confirmed_at) VALUES(auth.uid(),p_input->>'title',p_input->>'orgClass',coalesce(p_input->'rules'->>'state',''),(p_input->>'stipendAud')::integer,p_input->>'discipline',ARRAY(SELECT jsonb_array_elements_text(p_input->'lifeLoad')),0,0,p_input->'rules',CASE WHEN p_activate THEN 'active' ELSE 'draft' END,nullif(p_input->>'deedPath',''),CASE WHEN p_activate THEN clock_timestamp() ELSE NULL END) RETURNING * INTO v_fund;
END IF;
RETURN jsonb_build_object('id',v_fund.id,'version',v_fund.rule_version,'status',v_fund.status);
END $$;
REVOKE ALL ON FUNCTION public.save_scholarship_rules(uuid,integer,jsonb,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_scholarship_rules(uuid,integer,jsonb,boolean,boolean) TO authenticated;
CREATE FUNCTION public.eligible_scholarship_students(p_rules jsonb, p_discipline text, p_life_load text[]) RETURNS TABLE(student_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Provider sign-in required'; END IF;
RETURN QUERY SELECT s.id FROM public.students s LEFT JOIN public.student_eligibility e ON e.student_id=s.id WHERE
(p_discipline='All Disciplines' OR s.discipline=p_discipline)
AND (coalesce(p_rules->>'state','any')='any' OR e.state=p_rules->>'state')
AND (coalesce(jsonb_array_length(p_rules->'postcodes'),0)=0 AND coalesce(jsonb_array_length(p_rules->'regions'),0)=0 OR e.postcode IN(SELECT jsonb_array_elements_text(p_rules->'postcodes')) OR lower(e.region) IN(SELECT lower(jsonb_array_elements_text(p_rules->'regions'))))
AND (coalesce(p_rules->>'studyLoad','any')='any' OR (p_rules->>'studyLoad'='full-time' AND s.study_load>=75) OR (p_rules->>'studyLoad'='part-time' AND s.study_load<75))
AND (p_rules->>'maxHouseholdIncome' IS NULL OR e.household_income<=(p_rules->>'maxHouseholdIncome')::integer)
AND (coalesce(jsonb_array_length(p_rules->'institutions'),0)=0 OR lower(e.institution) IN(SELECT lower(jsonb_array_elements_text(p_rules->'institutions'))))
AND (coalesce(jsonb_array_length(p_rules->'yearLevels'),0)=0 OR s.year_level IN(SELECT jsonb_array_elements_text(p_rules->'yearLevels')::integer))
AND (coalesce(jsonb_array_length(p_rules->'residencies'),0)=0 OR s.visa_status IN(SELECT jsonb_array_elements_text(p_rules->'residencies')))
AND (coalesce(p_rules->>'firstGeneration','any')='any' OR coalesce(e.first_generation,'First-Gen Student'=ANY(s.equity_tags))=(p_rules->>'firstGeneration'='yes'))
AND (coalesce(p_rules->>'centrelink','any')='any' OR coalesce(e.centrelink_concession,s.verified_centrelink)=(p_rules->>'centrelink'='yes'))
AND (coalesce(cardinality(p_life_load),0)=0 OR s.equity_tags @> p_life_load);
END $$;
REVOKE ALL ON FUNCTION public.eligible_scholarship_students(jsonb,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eligible_scholarship_students(jsonb,text,text[]) TO authenticated;
CREATE POLICY "Providers upload private deed PDFs" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='trust-deeds' AND (storage.foldername(name))[1]=auth.uid()::text AND lower(storage.extension(name))='pdf');
CREATE POLICY "Providers read own private deeds" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='trust-deeds' AND (storage.foldername(name))[1]=auth.uid()::text);
