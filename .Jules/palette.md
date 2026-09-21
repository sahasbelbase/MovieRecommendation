## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Interactive Card Accessibility vs. Nested Controls
**Learning:** Adding `role="button"` or interactive card wrappers around components containing child buttons violates WCAG nested interactive controls guidelines and confuses screen readers.
**Action:** Keep outer card wrappers non-interactive and ensure child controls have explicit `type="button"`, descriptive `aria-label`s with context (e.g. `aria-label={`Play ${title}`}`), and clear `focus-visible` focus indicators.
