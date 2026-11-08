# Shared IRTO score breakdown

## What will be built
- Add one reusable `GritBreakdownPanel` overlay used by both the Student Live Match Radar and the Employers & Providers candidate feed.
- Make each score badge open the same panel on click, keyboard focus, or pointer hover, while remaining usable on touch screens.
- Show the requested academic formula, adjusted capability progress, soft-skill trackers, conditional frontline modifier, conditional verified equity signals, and compliance footer.
- Bind every value to the existing candidate profile and current IRTO result instead of duplicating calculations in the interface.
- Apply the dark neon treatment in Graduate Employer and the editorial off-white treatment in Scholarship Provider.

## Data mapping
- Link each student opportunity tile to its existing anonymised candidate record so its percentage and breakdown use the same local scoring data.
- Detect verified equity badges from candidate flags/tags and show only applicable indicators.
- Preserve all current matching, filtering, shared credits, and identity-handshake behaviour.

## Validation
- Check interaction and visual layout on Student View, Graduate Employer, and Scholarship Provider.
- Check desktop and mobile sizing, keyboard access, panel dismissal, and current build diagnostics.

## Technical details
- Use the existing popover primitives for one accessible overlay implementation.
- Extend the candidate profile shape only where explicit verified equity booleans are needed.
- Keep IRTO calculations in the existing scoring engine; the panel receives a computed result plus its student record.