# Parent access and studio specification

## Target files

- `src/components/AccessGate.tsx`
- `src/components/ParentStudio.tsx`
- matching component-scoped CSS files

## Access gate

- Full product-quality entry screen inside the editorial/scrapbook visual system.
- Title `Welcome to the world Baby Tsubery` and message explaining that this is a private family journal.
- Parent path: one labeled password field and submit button.
- Guest path is normally automatic through `?invite=...`; show a calm invalid/expired invitation message when needed.
- Support loading, error, and demo-preview states with `aria-live`.
- Never persist the parent password in browser storage.

## Parent studio

- Open as an accessible dialog/sheet suitable for mobile use.
- Daily-memory form: image file, date, and optional caption. Use the caption as accessible image text, with a neutral fallback when no caption is provided.
- Show a local image preview after selection. Before submit, convert the image through canvas to a web-sized WebP (maximum 1800px longest edge, quality 0.86), which removes original EXIF metadata.
- Controlled form fields, clear inline errors, disabled/loading submit state.
- Album form: title, optional description, and selectable memory list with date and caption. Require at least one memory.
- Settings section: explain that the family invitation link can be rotated; provide a button/callback surface, but do not fake a successful rotation.
- Use lucide-react icons, semantic labels, 44px controls, and `role=dialog`/`aria-modal` behavior.

## Visual direction

- Paper-white sheet, berry controls, date-stamp labels, subtle blush/lilac sections.
- Avoid excessive decorative motion. Use a single gentle sheet entrance and respect reduced motion.
