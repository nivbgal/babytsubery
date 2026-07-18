# Journal views specification

## Target files

- `src/components/TodayView.tsx`
- `src/components/CalendarView.tsx`
- `src/components/AlbumsView.tsx`
- matching component-scoped CSS files

## Shared visual system

Editorial Heirloom structure with Modern Scrapbook accents. Use the variables and shared classes from `src/styles.css`. Photography is dominant. No emoji icons, inline SVG authored in the component, or third-party imagery. Use `lucide-react` for icons.

## Today view

- Large two-column spread on desktop, stacked on mobile.
- Left: portrait-oriented paper photo mat containing `MemoryVisual`, a small date stamp overlapping one edge, and a restrained tape-like CSS strip.
- Right: eyebrow `Newest entry · Today`, headline `Welcome to the world Baby Tsubery`, current caption, formatted date, and private-family indicator.
- Previous/next memory controls when neighboring entries exist.
- Accept entries, current entry, nickname, and selection callback as props.
- Empty state should invite a parent to add the first memory without implying failure.

## Calendar view

- Real month grid derived from entry dates; weekday headers and leading/trailing blank cells.
- Month previous/next controls; default month is latest entry month or current month.
- Entry days show `MemoryVisual` thumbnails and caption/date accessible labels.
- Empty dates remain intentionally quiet. Today gets a text/outline marker, not color alone.
- Selecting an entry calls a prop and returns the app to Today view.
- Responsive: seven readable columns down to 375px with compact labels and no horizontal scroll.

## Albums view

- Book-shelf/keepsake presentation, not generic dashboard cards.
- Show album cover, title, description, and number of memories.
- Selecting an album opens a reading/print view with entries in order and a clear `Print or save PDF` action using `window.print()`.
- Parents see `Create an album`; guests do not.
- Album creation can be triggered through a callback owned by the parent studio/app shell.

## Interaction and accessibility

- 44px minimum controls, visible focus states inherited from global CSS.
- 160–220ms ease-out hover/press transitions and reduced-motion compliance.
- Every photo/placeholder has descriptive accessible text.
- Buttons use semantic buttons and expose current/selected state.
