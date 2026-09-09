## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.
