## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Specific ARIA Labels and Avoiding Nested Interactive Elements in Cards
**Learning:** Generic ARIA labels (e.g. "Mark as watched") on card quick actions make screen reader navigation ambiguous when many cards are present. Additionally, adding `role="button"` to a container card that contains nested buttons breaks the accessibility tree.
**Action:** Always interpolate specific entity titles into action `aria-label`s (e.g., `aria-label={`Mark ${movie.title} as watched`}`), and keep parent card containers free of `role="button"`.
