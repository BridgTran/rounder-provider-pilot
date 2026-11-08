# Current work

## Deed-backed scholarship configuration
- [x] Update form, private PDF upload, eligibility count and draft/activation actions.
- [x] Persist versioned rules and append-only provider audit history.
- [x] Verify signed-in saving, activation, live counts, immutable history, private deed access and desktop/mobile layout; 14 tests pass.

## Provider-first experience
- [x] Replace employer and student screens with provider dashboard and private student invitations.
- [x] Enforce consent, intake, per-request accept/decline, and deletion using invite credentials.
- [x] Remove shared wallet and protect the admin route with server-validated roles.
- [x] Verify public entry, mobile layout, invalid invite rejection, database access restrictions and student action validation.
- [ ] Verify signed-in provider → invite → consent → intake → unlock decision → deletion end-to-end. Blocked: no requesting-user account or signed-in session.
- [ ] Activate the requested admin account. Blocked: tran.bridgitte@gmail.com must register and confirm its email; verified-email assignment is configured.

## Scholarship-provider pilot MVP
- [x] Enable Lovable Cloud.
- [x] Email/password auth for providers; profiles table (org name, contact person) auto-created on signup.
- [x] Move provider workspace behind login; student view stays public.
- [x] Students table with IRTO fields; seed the 5 demo candidates via migration.
- [x] Scholarships table (provider-owned: title, stipend, location, finalist requirements, hard-gate criteria); "Configure New Scholarship Fund" modal writes to it; "My Funds" list; published funds drive feed filters.
- [x] Matches table + per-provider credits balance: request costs 1 credit, student accepts, then names/contact revealed to both sides via RLS.
- [x] Keep IRTO scoring, GritBreakdownPanel, and both campaign themes working on real data.
- [x] Verify end-to-end (signup, publish fund, request match, accept, reveal) and build clean.
