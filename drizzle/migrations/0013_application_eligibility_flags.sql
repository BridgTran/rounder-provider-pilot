-- 0014: flag applications whose student no longer meets the fund's Required rules after editing their answers. Requires 0011 and 0013.
ALTER TABLE public.matches ADD COLUMN eligibility_flagged_at timestamptz;

CREATE FUNCTION public.flag_matches_after_edit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
UPDATE public.matches m SET eligibility_flagged_at = CASE
  WHEN EXISTS(SELECT 1 FROM public.evaluate_fund_rules(f.rules,f.discipline,f.life_load,m.student_id) r WHERE NOT r.preferred AND NOT r.met) THEN coalesce(m.eligibility_flagged_at, now())
  ELSE NULL END
FROM public.scholarships f WHERE f.id = m.fund_id AND m.student_id = NEW.student_id AND m.stage <> 'declined';
RETURN NEW; END $$;
CREATE TRIGGER flag_after_eligibility_edit AFTER UPDATE ON public.student_eligibility FOR EACH ROW EXECUTE FUNCTION public.flag_matches_after_edit();

-- Rounder cannot mark an application checked or released while the student fails a Required rule.
CREATE OR REPLACE FUNCTION public.admin_advance_application(p_match_id uuid, p_to text) RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
SELECT * INTO v_m FROM public.matches WHERE id=p_match_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
IF NOT ((v_m.stage='shortlisted' AND p_to='invited') OR (v_m.stage IN('accepted','returned') AND p_to='submitted') OR (v_m.stage='submitted' AND p_to IN('checked','returned')) OR (v_m.stage='checked' AND p_to='released')) THEN RAISE EXCEPTION 'That step is not allowed from %', v_m.stage; END IF;
IF p_to='released' AND v_m.release_consent_at IS NULL THEN RAISE EXCEPTION 'The student has not consented to release'; END IF;
IF p_to IN('checked','released') AND EXISTS(SELECT 1 FROM public.scholarships f, LATERAL public.evaluate_fund_rules(f.rules,f.discipline,f.life_load,v_m.student_id) r WHERE f.id=v_m.fund_id AND NOT r.preferred AND NOT r.met) THEN RAISE EXCEPTION 'The student no longer meets the fund''s required rules'; END IF;
UPDATE public.matches SET stage=p_to, stage_updated_at=now() WHERE id=p_match_id RETURNING * INTO v_m;
IF v_m.organisation_id IS NOT NULL THEN
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES(p_to,auth.uid()::text,'system',v_m.organisation_id,v_m.fund_id,v_m.rule_version);
END IF;
RETURN v_m; END $$;
