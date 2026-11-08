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

- Provider data is authenticated-only; student PII remains protected by accepted-match RLS, and provider-only credit spending remains atomic through request_match. Why: removing the shared wallet must not bypass the existing per-provider unlock charge.
- The authenticated provider workspace remains at /corporate; / resolves to provider sign-in or workspace, while /invite/$token is the only student surface. Why: private invitations replace public student browsing without breaking provider URLs.
- Student invitation secrets are generated server-side, stored only as hashes, and checked inside a narrowly scoped transactional RPC for consent, intake, per-match decisions and cascading deletion. Why: candidate codes and client state must never authorize student actions.
- Administrative roles live in public.user_roles and getAdminOverview validates has_role before privileged aggregate reads. Why: neither provider signup metadata nor browser storage can confer admin access.
