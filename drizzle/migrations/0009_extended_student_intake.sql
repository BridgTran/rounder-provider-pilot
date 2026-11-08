DO $migration$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.student_invite_action(text,text,jsonb)'::regprocedure) INTO definition;
definition:=replace(definition,'UPDATE public.student_invites SET student_id = v_student WHERE id = v_inv.id;', $replacement$INSERT INTO public.student_eligibility(student_id,state,postcode,region,institution,household_income,first_generation,centrelink_concession,gender,degree_level,first_undergraduate_degree,years_completed,campus_state) VALUES(v_student,nullif(p_payload->>'state',''),nullif(p_payload->>'postcode',''),nullif(p_payload->>'region',''),nullif(p_payload->>'institution',''),(p_payload->>'householdIncome')::int,CASE p_payload->>'firstGeneration' WHEN 'yes' THEN true WHEN 'no' THEN false END,CASE p_payload->>'centrelink' WHEN 'yes' THEN true WHEN 'no' THEN false END,nullif(p_payload->>'gender',''),nullif(p_payload->>'degreeLevel',''),CASE p_payload->>'firstUndergraduateDegree' WHEN 'yes' THEN true WHEN 'no' THEN false END,(p_payload->>'yearsCompleted')::numeric,nullif(p_payload->>'campusState',''));
UPDATE public.student_invites SET student_id = v_student WHERE id = v_inv.id;$replacement$);
EXECUTE definition; END $migration$;
CREATE FUNCTION public.validate_student_eligibility() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NEW.gender IS NOT NULL AND NEW.gender NOT IN('female','male','non-binary') THEN RAISE EXCEPTION 'Invalid gender'; END IF;
IF NEW.degree_level IS NOT NULL AND NEW.degree_level NOT IN('undergraduate','honours','postgraduate coursework','postgraduate research') THEN RAISE EXCEPTION 'Invalid degree level'; END IF;
IF NEW.years_completed<0 OR NEW.years_completed>20 OR NEW.household_income<0 THEN RAISE EXCEPTION 'Invalid eligibility values'; END IF;
IF NEW.institution IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.australian_universities WHERE name=NEW.institution) THEN RAISE EXCEPTION 'Choose a listed university'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER eligibility_validation BEFORE INSERT OR UPDATE ON public.student_eligibility FOR EACH ROW EXECUTE FUNCTION public.validate_student_eligibility();