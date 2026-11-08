# Student-friendly Grit Match Fit panel

## Scope
- Make the shared breakdown panel aware when it is opened from Student View.
- Use student-focused fallback and compliance copy only in that context.
- Keep employer/provider wording and campaign styling unchanged.
- Pin the complete score stack to the right side of every student opportunity card, including its IRTO/β pill.

## Implementation
1. Add an explicit Student View context property to the shared score panel.
2. Switch the no-equity message and compliance footer to the exact requested student wording.
3. Pass the student context from each Matched Opportunities card.
4. Strengthen the score stack and card-row alignment so label, help icon, percentage, and metric pill remain one right-aligned column at narrow and wide widths.

## Verification
- Open score panels for student cards with and without equity indicators and confirm the appropriate copy.
- Check student opportunity cards at mobile and desktop widths.
- Confirm employer and provider panels retain their existing candidate-focused wording.
- Confirm the preview builds without errors.
