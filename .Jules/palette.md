## 2025-05-18 - Streamlit Image Gallery Button Accessibility
**Learning:** Raw `<img>` tags with `on:click` in Svelte component libraries fail keyboard navigation and screen reader accessibility checks.
**Action:** Wrap clickable images in semantic `<button type="button">` controls with descriptive `aria-label`, `aria-pressed`, and clear `:focus-visible` outline styles.

## 2025-05-19 - Image Gallery Keyboard Carousel & Disabled States
**Learning:** Scrollable horizontal galleries require ArrowLeft/ArrowRight key navigation and scrollIntoView focus auto-scrolling to be fully navigable via keyboard.
**Action:** Bind keydown handlers for ArrowLeft/ArrowRight to move focus between image items, trigger smooth `scrollIntoView`, and respect component `disabled` state from parent wrapper.
