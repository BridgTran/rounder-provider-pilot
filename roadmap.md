# Current work

## Admin invitation and application workspace
- [x] Add one-time invitation link generation and rename the Applications statistic.
- [x] Add stage-specific application actions, consent visibility and error toasts.
- [ ] Verify stage rules, admin access and live invitation/application controls.

## Student invitation applications
- [x] Update consent and stage-specific application cards.
- [x] Hide retained equity questions and enforce required academic intake answers.
- [x] Verify 21 tests, automatic typecheck/build and real invite consent → intake → applications → test data deletion; desktop/mobile checked.

## Provider shortlist presentation
- [x] Update shortlist buttons, stage messages, release-only drawer contacts and stat counts.
- [x] Add completion-year, further-study and community-contribution rule controls with strengths and clause references; extended disciplines already present.
- [x] Verify 29 tests, automatic typecheck/build and signed-in desktop/mobile rule controls and drawer.
- [ ] Verify a new shortlist through the live UI. Blocked: the existing active fund returned no eligible candidates.

## Application-stage code alignment
- [x] Extend fund and intake models and validation tests; 39 tests pass.
- [x] Remove provider credits and switch candidate actions to shortlisting with release-only identity display.
- [x] Add authenticated administrator invitation and application functions without database changes.
- [x] Verify signed-in desktop/mobile dashboard and fund form; automatic typecheck/build passes.
- [ ] Verify shortlisting, invitation issuance and complete stage transitions end-to-end. Blocked: these checks would write database data, excluded by this request.

## Automatic team invitations
- [x] Email a secure sign-in invitation using the default auth sender; signed-in send accepted by auth service.
- [x] Automatically join verified invited accounts and remove the paste-and-join controls.
- [x] Test verified-email automatic acceptance and repeat-load safety; signed-in mobile controls verified with no runtime errors.
- [ ] Verify inbox arrival and a distinct colleague's email-link journey. Blocked: no second account/inbox was available.

## Extended fund rules and organisation access
- [x] Add Required/Preferred rules, new criteria, university choices and award fields.
- [x] Enforce attestation, immutable versions and append-only event auditing.
- [x] Add secure shared organisation access for multiple logins and funds.
- [x] Verify signed-in saves, preference counts, Required gating, invite acceptance, unlock acceptance, deletion and RLS; 27 tests pass.
- [ ] Verify shared organisation access with a second independent login. Blocked: only the requesting user's session was available; verified-email invitation acceptance was checked with that account.

## Provider password reset
- [x] Add "Forgot password?" on the sign-in form and a reset-password page that only accepts a valid recovery link.
- [x] Verify the button, the confirmation message, and graceful handling of expired/invalid links; 3 tests pass.
- [ ] Confirm the reset email is delivered. Blocked: no sending domain is configured, so auth email delivery can't be confirmed from here.
- [ ] Connect a custom email domain and verify auth-email delivery. Blocked: the user will give a heads-up about a week before pilot invitations; the default sender stays in place until then.

## Deed-backed scholarship configuration
- [x] Update form, private PDF upload, eligibility count and draft/activation actions.
- [x] Persist versioned rules and append-only provider audit history.
- [x] Verify signed-in saving, activation, live counts, immutable history, private deed access and desktop/mobile layout; 14 tests pass.

## Provider-first experience
- [x] Replace employer and student screens with provider dashboard and private student invitations.
- [x] Enforce consent, intake, per-request accept/decline, and deletion using invite credentials.
- [x] Remove shared wallet and protect the admin route with server-validated roles.
- [x] Verify public entry, mobile layout, invalid invite rejection, database access restrictions and student action validation.
- [x] Verify signed-in provider → invite → consent → intake → unlock decision → deletion end-to-end.
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
