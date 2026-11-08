REVOKE ALL ON public.student_invites FROM anon, authenticated;
GRANT ALL ON public.student_invites TO service_role;
CREATE OR REPLACE FUNCTION public.assign_verified_pilot_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = lower('tran.bridgitte@gmail.com') THEN
INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin') ON CONFLICT(user_id,role) DO NOTHING;
ELSIF TG_OP = 'UPDATE' AND lower(OLD.email) = lower('tran.bridgitte@gmail.com') THEN
DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin';
END IF;
RETURN NEW;
END $$;