-- 0017: student documents (private), Rounder verification, and a released-only package for providers.
-- Statements now reach providers only once the application is released. Requires 0011, 0014, 0016. No DROP statements.

-- Documents GW-NSW needs before an application can be marked checked.
CREATE FUNCTION public.required_document_types() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT ARRAY['transcript','statement','referee_1','referee_2','residency'] $$;

CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('transcript','statement','referee_1','referee_2','residency','other')),
  file_path text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/png','image/jpeg')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','checked','rejected')),
  admin_note text NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 500),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  checked_by uuid,
  UNIQUE (student_id, doc_type)
);
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_documents FROM anon, authenticated;
GRANT ALL ON public.student_documents TO service_role;

-- The private "student-documents" bucket is created separately (see the prompt), not in this file.


-- Student side (token based, like the rest of the invite flow).
CREATE FUNCTION public.student_get_documents(p_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; v_can boolean;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now();
IF NOT FOUND OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
v_can := EXISTS(SELECT 1 FROM public.matches WHERE student_id = v_inv.student_id AND stage IN ('accepted','returned'));
RETURN jsonb_build_object('studentId', v_inv.student_id, 'uploadOpen', v_can, 'required', to_jsonb(public.required_document_types()),
 'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('docType',d.doc_type,'fileName',d.file_name,'status',d.status,'note',d.admin_note,'uploadedAt',d.uploaded_at) ORDER BY d.doc_type) FROM public.student_documents d WHERE d.student_id = v_inv.student_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.student_get_documents(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_get_documents(text) TO anon, authenticated;

-- Called by the server function after it has stored the file. Replaces any earlier file of that type and sends it back for checking.
CREATE FUNCTION public.student_register_document(p_token text, p_doc_type text, p_path text, p_name text, p_mime text, p_size integer) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.student_invites; v_old text;
BEGIN
IF p_token IS NULL OR length(p_token) < 64 OR length(p_token) > 128 THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
SELECT * INTO v_inv FROM public.student_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND expires_at > now() FOR UPDATE;
IF NOT FOUND OR v_inv.student_id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.matches WHERE student_id = v_inv.student_id AND stage IN ('accepted','returned')) THEN RAISE EXCEPTION 'Uploads are not open for your application'; END IF;
IF p_path IS NULL OR left(p_path, 37) <> v_inv.student_id::text || '/' OR position('..' in p_path) > 0 THEN RAISE EXCEPTION 'Invalid file location'; END IF;
SELECT file_path INTO v_old FROM public.student_documents WHERE student_id = v_inv.student_id AND doc_type = p_doc_type;
INSERT INTO public.student_documents(student_id, doc_type, file_path, file_name, mime_type, size_bytes)
VALUES (v_inv.student_id, p_doc_type, p_path, p_name, p_mime, p_size)
ON CONFLICT (student_id, doc_type) DO UPDATE SET file_path = excluded.file_path, file_name = excluded.file_name, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
  status = 'uploaded', admin_note = '', uploaded_at = now(), checked_at = NULL, checked_by = NULL;
RETURN v_old; -- previous path (or null) so the server function can delete the old file
END $$;
REVOKE ALL ON FUNCTION public.student_register_document(text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_register_document(text,text,text,text,text,integer) TO anon, authenticated;

-- Rounder admin side.
CREATE FUNCTION public.admin_list_documents(p_student_id uuid) RETURNS TABLE(id uuid, doc_type text, file_name text, file_path text, mime_type text, size_bytes integer, status text, admin_note text, uploaded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
RETURN QUERY SELECT d.id, d.doc_type, d.file_name, d.file_path, d.mime_type, d.size_bytes, d.status, d.admin_note, d.uploaded_at FROM public.student_documents d WHERE d.student_id = p_student_id ORDER BY d.doc_type;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_documents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_documents(uuid) TO authenticated;

CREATE FUNCTION public.admin_review_document(p_document_id uuid, p_status text, p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
IF p_status NOT IN ('checked','rejected') THEN RAISE EXCEPTION 'Status must be checked or rejected'; END IF;
IF char_length(coalesce(p_note,'')) > 500 THEN RAISE EXCEPTION 'Note must be 500 characters or fewer'; END IF;
UPDATE public.student_documents SET status = p_status, admin_note = trim(coalesce(p_note,'')), checked_at = now(), checked_by = auth.uid() WHERE id = p_document_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_review_document(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_document(uuid,text,text) TO authenticated;

-- Rounder cannot mark an application checked until every required document is checked.
CREATE OR REPLACE FUNCTION public.admin_advance_application(p_match_id uuid, p_to text) RETURNS public.matches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
SELECT * INTO v_m FROM public.matches WHERE id=p_match_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
IF NOT ((v_m.stage='shortlisted' AND p_to='invited') OR (v_m.stage IN('accepted','returned') AND p_to='submitted') OR (v_m.stage='submitted' AND p_to IN('checked','returned')) OR (v_m.stage='checked' AND p_to='released')) THEN RAISE EXCEPTION 'That step is not allowed from %', v_m.stage; END IF;
IF p_to='released' AND v_m.release_consent_at IS NULL THEN RAISE EXCEPTION 'The student has not consented to release'; END IF;
IF p_to IN('checked','released') AND EXISTS(SELECT 1 FROM public.scholarships f, LATERAL public.evaluate_fund_rules(f.rules,f.discipline,f.life_load,v_m.student_id) r WHERE f.id=v_m.fund_id AND NOT r.preferred AND NOT r.met) THEN RAISE EXCEPTION 'The student no longer meets the fund''s required rules'; END IF;
IF p_to='checked' AND EXISTS(SELECT 1 FROM unnest(public.required_document_types()) t(doc_type) WHERE NOT EXISTS(SELECT 1 FROM public.student_documents d WHERE d.student_id=v_m.student_id AND d.doc_type=t.doc_type AND d.status='checked')) THEN RAISE EXCEPTION 'Every required document must be checked first'; END IF;
UPDATE public.matches SET stage=p_to, stage_updated_at=now() WHERE id=p_match_id RETURNING * INTO v_m;
IF v_m.organisation_id IS NOT NULL THEN
INSERT INTO public.audit_events(event_type,actor,actor_role,organisation_id,fund_id,rule_version) VALUES(p_to,auth.uid()::text,'system',v_m.organisation_id,v_m.fund_id,v_m.rule_version);
END IF;
RETURN v_m; END $$;

-- Providers: statements only for released applications of their own fund.
CREATE OR REPLACE FUNCTION public.fund_candidate_snippets(p_fund_id uuid) RETURNS TABLE(student_id uuid, community_text text, next_study_text text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.scholarships WHERE id = p_fund_id AND public.is_organisation_member(organisation_id)) THEN RAISE EXCEPTION 'Fund not found'; END IF;
RETURN QUERY SELECT sn.student_id, sn.approved_community_text, sn.approved_next_study_text FROM public.student_snippets sn
WHERE sn.status = 'approved' AND EXISTS(SELECT 1 FROM public.matches m WHERE m.fund_id = p_fund_id AND m.student_id = sn.student_id AND m.stage = 'released');
END $$;

-- Providers: the released package (identity, approved statements, checked documents). Nothing before release.
CREATE FUNCTION public.provider_released_package(p_fund_id uuid, p_student_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m public.matches; v_id public.student_identities; v_sn public.student_snippets;
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.scholarships WHERE id = p_fund_id AND public.is_organisation_member(organisation_id)) THEN RAISE EXCEPTION 'Fund not found'; END IF;
SELECT * INTO v_m FROM public.matches WHERE fund_id = p_fund_id AND student_id = p_student_id AND stage = 'released';
IF NOT FOUND THEN RAISE EXCEPTION 'This package has not been released yet'; END IF;
SELECT * INTO v_id FROM public.student_identities WHERE student_id = p_student_id;
SELECT * INTO v_sn FROM public.student_snippets WHERE student_id = p_student_id AND status = 'approved';
RETURN jsonb_build_object('studentId', p_student_id, 'releasedAt', v_m.stage_updated_at, 'legalName', v_id.legal_name, 'email', v_id.email, 'phone', v_id.phone,
 'communityText', coalesce(v_sn.approved_community_text,''), 'nextStudyText', coalesce(v_sn.approved_next_study_text,''),
 'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'docType',d.doc_type,'fileName',d.file_name,'mimeType',d.mime_type,'checkedAt',d.checked_at) ORDER BY d.doc_type) FROM public.student_documents d WHERE d.student_id = p_student_id AND d.status = 'checked'),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.provider_released_package(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_released_package(uuid,uuid) TO authenticated;

-- Server functions call this before issuing a signed download URL; returns the storage path or raises.
CREATE FUNCTION public.provider_document_path(p_document_id uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path text;
BEGIN
SELECT d.file_path INTO v_path FROM public.student_documents d
WHERE d.id = p_document_id AND d.status = 'checked' AND EXISTS(SELECT 1 FROM public.matches m WHERE m.student_id = d.student_id AND m.stage = 'released' AND public.is_organisation_member(m.organisation_id));
IF v_path IS NULL THEN RAISE EXCEPTION 'Document not available'; END IF;
RETURN v_path;
END $$;
REVOKE ALL ON FUNCTION public.provider_document_path(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_document_path(uuid) TO authenticated;

-- Admins: same, for reviewing any file.
CREATE FUNCTION public.admin_document_path(p_document_id uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path text;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator sign-in required'; END IF;
SELECT file_path INTO v_path FROM public.student_documents WHERE id = p_document_id;
IF v_path IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;
RETURN v_path;
END $$;
REVOKE ALL ON FUNCTION public.admin_document_path(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_document_path(uuid) TO authenticated;