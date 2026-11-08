-- The student view is public; anonymized student records carry no PII
-- (identities live in student_identities behind the accepted-match policy).
GRANT SELECT ON public.students TO anon;
CREATE POLICY "Public read of anonymized students" ON public.students FOR SELECT TO anon USING (true);