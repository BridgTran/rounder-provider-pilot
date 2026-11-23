-- 0018: students write their 300-character statements only after they have been shortlisted and accepted (same window as document uploads).
-- Replaces student_save_snippets from 0016. Requires 0016 and 0017. No DROP statements.
CREATE OR REPLACE FUNCTION public.student_save_snippets(p_token text, p_community text, p_next_study text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; v_c text; v_n text;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now() FOR UPDATE;
IF NOT FOUND OR v_inv.student_id IS NULL OR v_inv.consented_at IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.matches WHERE student_id = v_inv.student_id AND stage IN ('accepted','returned')) THEN RAISE EXCEPTION 'Statements open once you have accepted a request'; END IF;
v_c := trim(coalesce(p_community,'')); v_n := trim(coalesce(p_next_study,''));
IF char_length(v_c) > 300 OR char_length(v_n) > 300 THEN RAISE EXCEPTION 'Each answer must be 300 characters or fewer'; END IF;
INSERT INTO public.student_snippets(student_id, community_text, next_study_text) VALUES (v_inv.student_id, v_c, v_n)
ON CONFLICT (student_id) DO UPDATE SET community_text = excluded.community_text, next_study_text = excluded.next_study_text,
  approved_community_text = '', approved_next_study_text = '', status = 'pending', submitted_at = now(), reviewed_at = NULL;
RETURN jsonb_build_object('saved', true, 'status', 'pending');
END $$;

-- Tell the page whether statements can be edited, alongside the text.
CREATE OR REPLACE FUNCTION public.student_get_snippets(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; r jsonb; v_open boolean;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now();
IF NOT FOUND OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
v_open := EXISTS(SELECT 1 FROM public.matches WHERE student_id = v_inv.student_id AND stage IN ('accepted','returned'));
SELECT jsonb_build_object('communityText',sn.community_text,'nextStudyText',sn.next_study_text,'status',sn.status) INTO r FROM public.student_snippets sn WHERE sn.student_id = v_inv.student_id;
RETURN coalesce(r, jsonb_build_object('communityText','','nextStudyText','','status','none')) || jsonb_build_object('editOpen', v_open);
END $$;