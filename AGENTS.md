<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture

- Backend is Lovable Cloud: provider email/password auth, `profiles` + `provider_credits` (auto-created by signup trigger), `students` (anonymized, public-read), `student_identities` (PII, RLS-readable only after an accepted match), `scholarships` (provider-owned), `matches` (pending/accepted). Credit spend and match lifecycle go through security-definer RPCs (`request_match`, `top_up_credits`, `accept_match`, `list_student_requests`); app logic lives in `createServerFn` functions in `src/lib/provider.functions.ts`. Why: the double-blind reveal must be enforced by row-level security, not UI hiding.
- The provider workspace (`/corporate`) sits under the `_authenticated` gate; the student view (`/`) stays public and reads only anonymized data via publishable-key server functions.
