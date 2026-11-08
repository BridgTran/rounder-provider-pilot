# Current work

## Scholarship-provider pilot MVP
- [x] Enable Lovable Cloud.
- [x] Email/password auth for providers; profiles table (org name, contact person) auto-created on signup.
- [x] Move provider workspace behind login; student view stays public.
- [x] Students table with IRTO fields; seed the 5 demo candidates via migration.
- [x] Scholarships table (provider-owned: title, stipend, location, finalist requirements, hard-gate criteria); "Configure New Scholarship Fund" modal writes to it; "My Funds" list; published funds drive feed filters.
- [x] Matches table + per-provider credits balance: request costs 1 credit, student accepts, then names/contact revealed to both sides via RLS.
- [x] Keep IRTO scoring, GritBreakdownPanel, and both campaign themes working on real data.
- [x] Verify end-to-end (signup, publish fund, request match, accept, reveal) and build clean.
