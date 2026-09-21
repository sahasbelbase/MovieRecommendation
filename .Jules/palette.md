## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Modal Close Button Accessibility and Keyboard Focus States
**Learning:** Icon-only modal close buttons without explicit `aria-label` attributes are silent to screen readers and lack visual focus indicators for keyboard navigation.
**Action:** Always provide `aria-label="Close modal"` (or context-specific label) and Tailwind `focus-visible:outline-none focus-visible:ring-2` ring utilities on icon-only close buttons.
