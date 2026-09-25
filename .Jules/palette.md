## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Toast Notification Accessibility & Live Regions
**Learning:** Toast notifications without `role="status"` and `aria-live="polite"` fail to announce dynamic feedback (e.g. Watchlist updates) to screen reader users, and icon-only dismiss controls require explicit `aria-label` and `:focus-visible` indicators.
**Action:** Always include `role="status"`, `aria-live="polite"`, `aria-label`, and `focus-visible` ring styles on interactive notification components.
