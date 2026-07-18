# Baby Tsubery product research

## Product promise

One small memory each day, shared privately with the people who love her.

## Comparable products reviewed

- TinyNest: emphasizes one-tap posting, invite-only privacy, and automatic organization by the baby's age.
- nappi Family Album: removes account friction for grandparents by using family invitation links and a browser viewer.
- Oli Journal: treats the calendar as the primary archive and turns selected memories into printable books.
- Family Journal: uses one shared entry per day and provides print/PDF output.
- Blipfoto: validates the emotional strength of a single-photo-per-day constraint.

## Patterns to keep

1. The newest photo is the first thing relatives see.
2. Posting takes less than a minute on a phone.
3. A calendar makes the passage of time visible without feeling like a social feed.
4. The baby's age is more meaningful than a raw date, but the date remains available.
5. Guest links require no account and can be revoked.
6. Album selection feels like arranging a keepsake, not managing files.
7. Missed days remain neutral; there are no streaks or guilt-producing reminders.

## Visual principles

- Warm and feminine without relying on saturated pink everywhere.
- Photography remains the dominant visual material.
- Soft rose, shell, berry, parchment, and restrained gold accents.
- Rounded touch targets and quiet transitions, with reduced-motion support.
- Minimum 44px touch targets, 16px mobile body type, visible focus states, and WCAG-readable contrast.
- Original interface direction; do not copy competitor imagery, branding, text, or layouts.

## Proposed information architecture

- Today: latest daily memory and previous/next navigation.
- Calendar: month grid with daily thumbnails and empty days left calm.
- Albums: saved selections with a print-friendly reading mode.
- Parent studio: upload, caption, date, crop/preview, replace, and delete.
- Family access: revocable guest link and parent-only settings.

## Technical implications

- GitHub Pages serves the public application shell at `babytsubery.com`.
- A Cloudflare Worker handles authenticated writes and protected photo delivery.
- D1 stores entries, album membership, sessions, and revocable guest tokens.
- R2 stores original and web-sized images.
- Browser-side image preparation should remove EXIF location metadata before upload.
