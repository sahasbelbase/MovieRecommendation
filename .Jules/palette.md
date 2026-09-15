## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Carousel Keyboard Navigation and Position Context
**Learning:** Scrollable button galleries lack intuitive keyboard navigation unless explicitly listening for ArrowLeft/ArrowRight keys to shift focus between items, and screen readers need positional context (`X of Y`).
**Action:** Handle ArrowLeft/ArrowRight keydown events on gallery buttons for focus traversal and include positional info in `aria-label` along with container `role="region"`.
