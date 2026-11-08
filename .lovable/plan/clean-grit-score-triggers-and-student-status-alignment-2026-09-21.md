# Clean Grit Score Triggers and Student Status Alignment

## Scope

- Restyle the shared Grit Match Fit display used by student opportunities and employer/provider candidates.
- Keep the existing IRTO calculation panel, matching state, and campaign themes unchanged.
- Correct the passive student opportunity status alignment.

## Implementation

1. **Shared score display**
   - Remove the score trigger’s border, background, rounded container, and shadow styling.
   - Present the percentage and `GRIT MATCH FIT` label as clean, vertically aligned typography.
   - Add a compact question-mark icon beside the label as the explicit interactive control.
   - Preserve hover, click, focus, keyboard, and touch opening behavior for the existing IRTO breakdown overlay.
   - Keep dark and light campaign text contrast appropriate without reintroducing a filled badge.

2. **Student opportunity waiting state**
   - Convert `Awaiting Provider Request` into a centered flex row with centered text and a stable gap between the lock and label.
   - Add sufficient horizontal space and prevent uneven wrapping or clipping on narrow cards.
   - Preserve its existing passive tooltip and non-actionable behavior.

3. **Verification**
   - Check Student, Graduate Employer, and Scholarship Provider cards at desktop and mobile widths.
   - Verify the question-mark trigger opens the correct candidate’s IRTO panel by hover and click.
   - Confirm the passive status remains centered and the project builds without errors.
