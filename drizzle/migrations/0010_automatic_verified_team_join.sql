CREATE OR REPLACE FUNCTION public.claim_organisation_invitations() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_inv public.organisation_invites; v_count integer := 0;
BEGIN
  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RETURN 0; END IF;
  FOR v_inv IN SELECT * FROM public.organisation_invites WHERE email = v_email AND expires_at > now() AND accepted_at IS NULL ORDER BY expires_at, id FOR UPDATE LOOP
    INSERT INTO public.organisation_members(organisation_id,user_id,member_role) VALUES(v_inv.organisation_id,auth.uid(),'member') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET organisation_id = v_inv.organisation_id, organisation_name = (SELECT name FROM public.provider_organisations WHERE id=v_inv.organisation_id) WHERE id=auth.uid();
    UPDATE public.organisation_invites SET accepted_at=now() WHERE id=v_inv.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.claim_organisation_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_organisation_invitations() TO authenticated;
COMMENT ON FUNCTION public.claim_organisation_invitations() IS 'Automatically accepts unexpired owner-issued invitations for the authenticated verified email; never trusts client identity or signup metadata.';