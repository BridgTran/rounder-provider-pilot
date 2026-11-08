# Corporate account navigation overhaul

## Goal
Create a clear two-level account hierarchy: a global Student/Employers parent switch, then an employer-only Graduate Employment/Scholarship Funds campaign switch. Both employer tracks will operate from the same account state, candidate registry, and Match Credit wallet.

## Changes
- Rebuild the sticky header as a full-width, high-contrast parent selector containing exactly:
  - 🧑‍🎓 Student View
  - 🏢 Employers & Providers Hub
- Show a second selector directly below the parent bar only on the employer workspace:
  - 💼 Graduate Employment
  - 🏆 Scholarship Funds
- Store the selected employer track in the corporate page URL so the view is stable, shareable, and refresh-safe.
- Keep both tracks inside the existing corporate workspace and connect both to the existing global match controller, ensuring credits, handshake status, candidate reveals, and matching records remain shared.
- Preserve the existing live IRTO ranking and all hard-gate controls. Switching tracks will change presentation and campaign language, not scoring behavior.
- Graduate Employment mode:
  - Dark charcoal workspace treatment with neon-lime accents
  - Shared credit balance and `+ Top Up`
  - `Post Graduate Intake Slot` action
  - Employment-focused candidate feed labels
- Scholarship Funds mode:
  - Editorial off-white workspace treatment with restrained charcoal and lime details
  - `Configure New Scholarship Fund` action
  - A `Trust Finalist Report` metrics strip
  - Scholarship-focused candidate feed labels while retaining the same candidates, filters, wallet, and handshake flow
- Adapt the existing opportunity modal trigger text and presentation to the active campaign without changing its underlying workflow.
- Ensure the two-tier navigation and workspace remain usable on narrow mobile screens and desktop.

## Technical details
- Update the shared header and parent toggle components rather than duplicating navigation per page.
- Validate the corporate route search parameter with a safe default of Graduate Employment.
- Derive theme classes and labels from the active campaign while keeping filter state and `rankCandidates(...)` in one shared corporate component.
- Add route-specific Open Graph and Twitter metadata fields required for the updated employer hub.
- Verify compilation and test both tracks, shared credit updates, filters, and mobile/desktop layout in the running app.
