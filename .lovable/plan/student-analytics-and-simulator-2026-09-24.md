# Student Analytics and Simulator

## What will be built
- Add a “⚡ YOUR MARKET VISIBILITY LAB” section near the top of Student View with three responsive analytics cards for Search Impressions, Filter Inclusions, and Anonymous Shortlists.
- Add a “🎛️ Grit Booster Simulator” directly beneath it with weekly work-hours and carer/external-load sliders.
- Show a live “PROVISIONAL RANKING CAPACITY” ring that starts from the current 88 score and applies the existing IRTO uplift of 0.65 points per simulated hour, capped at 100.
- Keep the simulator clearly provisional and local to the page; it will not alter the student’s saved profile or live match score.

## Design
- Use the existing ivory, charcoal, and lime system with soft borders, high-contrast typography, and compact responsive cards.
- Arrange metrics in three columns on larger screens and stack them on narrow screens.
- Keep the ring and controls stable at mobile sizes, with smooth motion that respects reduced-motion preferences.

## Validation and deployment
- Verify both sliders update the score and visible formula instantly.
- Check the Student View at desktop and the current mobile viewport for overflow and legibility.
- Confirm the preview has no build or runtime errors, then publish the updated app.
