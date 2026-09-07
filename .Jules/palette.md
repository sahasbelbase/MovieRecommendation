## 2025-05-10 - Streamlit Custom Component Accessibility
**Learning:** Custom Svelte image components in Streamlit need explicit `role="button"`, `tabindex="0"`, and keydown handlers (`Enter`/`Space`) since native `<img>` tags receiving click events are not focusable or interactive for screen readers and keyboard-only users.
**Action:** Always wrap interactive image elements or add ARIA roles, tabindex, keydown listeners, and `:focus-visible` focus indicators when turning images into selectable UI controls.
