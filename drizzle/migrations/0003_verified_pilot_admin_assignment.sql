CREATE FUNCTION public.assign_verified_pilot_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = lower('tran.bridgitte@gmail.com') THEN
INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin') ON CONFLICT(user_id,role) DO NOTHING;
END IF;
RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assign_verified_pilot_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_verified_pilot_admin AFTER INSERT OR UPDATE OF email_confirmed_at, email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_verified_pilot_admin();