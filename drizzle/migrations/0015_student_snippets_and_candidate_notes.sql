-- 0016: (1) short student statements reviewed by Rounder before providers see them, (3) provider "consider" list and private notes,
-- (4) bulk read functions used by the compare/export screens. Requires 0011, 0013 and 0015. No DROP statements.

-- 1) Student statements. Raw text is private to the student and Rounder admins; providers only ever see the approved version.
CREATE TABLE public.student_snippets (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  community_text text NOT NULL DEFAULT '' CHECK (char_length(community_text) <= 300),
  next_study_text text NOT NULL DEFAULT '' CHECK (char_length(next_study_text) <= 300),
  approved_community_text text NOT NULL DEFAULT '' CHECK (char_length(approved_community_text) <= 300),
  approved_next_study_text text NOT NULL DEFAULT '' CHECK (char_length(approved_next_study_text) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.student_snippets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_snippets FROM anon, authenticated;
GRANT ALL ON public.student_snippets TO service_role;

CREATE FUNCTION public.student_get_snippets(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; r jsonb;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now();
IF NOT FOUND OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT jsonb_build_object('communityText',sn.community_text,'nextStudyText',sn.next_study_text,'status',sn.status) INTO r FROM public.student_snippets sn WHERE sn.student_id = v_inv.student_id;
RETURN coalesce(r, jsonb_build_object('communityText','','nextStudyText','','status','none'));
END $$;
REVOKE ALL ON FUNCTION public.student_get_snippets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_snippets(text) TO anon, authenticated;

CREATE FUNCTION public.student_save_snippets(p_token text, p_community text, p_next_study text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; v_c text; v_n text;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now() FOR UPDATE;
IF NOT FOUND OR v_inv.student_id IS NULL OR v_inv.consented_at IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
IF NOT public.intake_editable(v_inv.student_id, v_inv.intake_unlocked_at) THEN RAISE EXCEPTION 'Your answers are locked because you have been shortlisted. Ask Rounder to reopen them.'; END IF;
v_c := trim(coalesce(p_community,'')); v_n := trim(coalesce(p_next_study,''));
IF char_length(v_c) > 300 OR char_length(v_n) > 300 THEN RAISE EXCEPTION 'Each answer must be 300 characters or fewer'; END IF;
INSERT INTO public.student_snippets(student_id, community_text, next_study_text) VALUES (v_inv.student_id, v_c, v_n)
ON CONFLICT (student_id) DO UPDATE SET community_text = excluded.community_text, next_study_text = excluded.next_study_text,
  approved_community_text = '', approved_next_study_text = '', status = 'pending', submitted_at = now(), reviewed_at = NULL;
RETURN jsonb_build_object('saved', true, 'status', 'pending');
END $$;
REVOKE ALL ON FUNCTION public.student_save_snippets(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_save_snippets(text,text,text) TO anon, authenticated;

CREATE FUNCTION public.admin_list_snippets() RETURNS TABLE(student_id uuid, candidate_code text, community_text text, next_study_text text, approved_community_text text, approved_next_study_text text, status text, submitted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
RETURN QUERY SELECT sn.student_id, s.candidate_code, sn.community_text, sn.next_study_text, sn.approved_community_text, sn.approved_next_study_text, sn.status, sn.submitted_at
FROM public.student_snippets sn JOIN public.students s ON s.id = sn.student_id WHERE sn.community_text <> '' OR sn.next_study_text <> ''
ORDER BY (sn.status = 'pending') DESC, sn.submitted_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_snippets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_snippets() TO authenticated;

CREATE FUNCTION public.admin_review_snippets(p_student_id uuid, p_community text, p_next_study text, p_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c text := trim(coalesce(p_community,'')); v_n text := trim(coalesce(p_next_study,''));
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
IF char_length(v_c) > 300 OR char_length(v_n) > 300 THEN RAISE EXCEPTION 'Each answer must be 300 characters or fewer'; END IF;
UPDATE public.student_snippets SET approved_community_text = CASE WHEN p_approve THEN v_c ELSE '' END, approved_next_study_text = CASE WHEN p_approve THEN v_n ELSE '' END,
  status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, reviewed_at = now() WHERE student_id = p_student_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Statement not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_snippets(uuid,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_snippets(uuid,text,text,boolean) TO authenticated;

-- 3) Provider "consider" list and private notes, shared within the provider organisation only.
CREATE TABLE public.candidate_notes (
  organisation_id uuid NOT NULL REFERENCES public.provider_organisations(id) ON DELETE CASCADE,
  fund_id uuid NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  considered boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fund_id, student_id)
);
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_notes FROM anon, authenticated;
GRANT SELECT ON public.candidate_notes TO authenticated;
GRANT ALL ON public.candidate_notes TO service_role;
CREATE POLICY candidate_notes_org_read ON public.candidate_notes FOR SELECT TO authenticated USING (public.is_organisation_member(organisation_id));

CREATE FUNCTION public.save_candidate_note(p_fund_id uuid, p_student_id uuid, p_considered boolean, p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fund public.scholarships; v_note text := trim(coalesce(p_note,''));
BEGIN
SELECT * INTO v_fund FROM public.scholarships WHERE id = p_fund_id AND public.is_organisation_member(organisation_id);
IF NOT FOUND THEN RAISE EXCEPTION 'Fund not found'; END IF;
IF char_length(v_note) > 1000 THEN RAISE EXCEPTION 'Notes must be 1000 characters or fewer'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.students WHERE id = p_student_id) OR EXISTS(SELECT 1 FROM public.evaluate_fund_rules(v_fund.rules,v_fund.discipline,v_fund.life_load,p_student_id) r WHERE NOT r.preferred AND NOT r.met) THEN RAISE EXCEPTION 'Candidate does not meet the fund''s required rules'; END IF;
IF NOT coalesce(p_considered,false) AND v_note = '' THEN
  DELETE FROM public.candidate_notes WHERE fund_id = p_fund_id AND student_id = p_student_id;
ELSE
  INSERT INTO public.candidate_notes(organisation_id, fund_id, student_id, considered, note, updated_by) VALUES (v_fund.organisation_id, p_fund_id, p_student_id, coalesce(p_considered,false), v_note, auth.uid())
  ON CONFLICT (fund_id, student_id) DO UPDATE SET considered = excluded.considered, note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_candidate_note(uuid,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_candidate_note(uuid,uuid,boolean,text) TO authenticated;

-- 4) Bulk reads for the list, compare and export screens. Eligible candidates of the provider's own fund only.
CREATE FUNCTION public.fund_candidate_snippets(p_fund_id uuid) RETURNS TABLE(student_id uuid, community_text text, next_study_text text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fund public.scholarships;
BEGIN
SELECT * INTO v_fund FROM public.scholarships WHERE id = p_fund_id AND public.is_organisation_member(organisation_id);
IF NOT FOUND THEN RAISE EXCEPTION 'Fund not found'; END IF;
RETURN QUERY SELECT sn.student_id, sn.approved_community_text, sn.approved_next_study_text FROM public.student_snippets sn
WHERE sn.status = 'approved' AND sn.student_id IN (SELECT e.student_id FROM public.eligible_scholarship_students(v_fund.rules, v_fund.discipline, v_fund.life_load) e);
END $$;
REVOKE ALL ON FUNCTION public.fund_candidate_snippets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_candidate_snippets(uuid) TO authenticated;

CREATE FUNCTION public.fund_rule_results_all(p_fund_id uuid) RETURNS TABLE(student_id uuid, rule_key text, preferred boolean, met boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fund public.scholarships;
BEGIN
SELECT * INTO v_fund FROM public.scholarships WHERE id = p_fund_id AND public.is_organisation_member(organisation_id);
IF NOT FOUND THEN RAISE EXCEPTION 'Fund not found'; END IF;
RETURN QUERY SELECT e.student_id, r.rule_key, r.preferred, r.met FROM public.eligible_scholarship_students(v_fund.rules, v_fund.discipline, v_fund.life_load) e
CROSS JOIN LATERAL public.evaluate_fund_rules(v_fund.rules, v_fund.discipline, v_fund.life_load, e.student_id) r;
END $$;
REVOKE ALL ON FUNCTION public.fund_rule_results_all(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_rule_results_all(uuid) TO authenticated;