-- 0015: lets a provider see, for one eligible candidate, which of the fund's rules they meet (for the anonymous case summary).
-- Returns only rule names and met/not met. No student answers. Only for the provider's own fund and only for candidates who meet every Required rule.
CREATE FUNCTION public.fund_candidate_rule_results(p_fund_id uuid, p_student_id uuid)
RETURNS TABLE(rule_key text, preferred boolean, met boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fund public.scholarships;
BEGIN
SELECT * INTO v_fund FROM public.scholarships WHERE id = p_fund_id AND public.is_organisation_member(organisation_id);
IF NOT FOUND THEN RAISE EXCEPTION 'Fund not found'; END IF;
IF EXISTS(SELECT 1 FROM public.evaluate_fund_rules(v_fund.rules,v_fund.discipline,v_fund.life_load,p_student_id) r WHERE NOT r.preferred AND NOT r.met) THEN RAISE EXCEPTION 'Candidate does not meet the fund''s required rules'; END IF;
RETURN QUERY SELECT r.rule_key, r.preferred, r.met FROM public.evaluate_fund_rules(v_fund.rules,v_fund.discipline,v_fund.life_load,p_student_id) r ORDER BY r.preferred, r.rule_key;
END $$;
REVOKE ALL ON FUNCTION public.fund_candidate_rule_results(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_candidate_rule_results(uuid,uuid) TO authenticated;