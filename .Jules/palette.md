## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Scrollable Carousel Region Accessibility
**Learning:** Scrollable overflow containers (`overflow-x: auto`) are inaccessible to keyboard-only users unless explicitly focusable and labeled.
**Action:** Add `role="region"`, `aria-label="Image gallery carousel"`, and `tabindex="0"` to scrollable containers, with clear `:focus-visible` focus ring styles.
