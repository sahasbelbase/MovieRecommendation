## 2025-05-10 - Streamlit Svelte Custom Components Accessibility
**Learning:** Custom Streamlit component templates using Svelte often render interactive `<img>` elements without keyboard event listeners (`keydown`), `role="button"`, `tabindex="0"`, or focus indicators (`:focus-visible`).
**Action:** When working on Streamlit Svelte components, ensure interactive images/cards have proper ARIA labels, `role="button"`, `tabindex="0"`, Enter/Space key navigation handlers, and distinct `:focus-visible` focus rings.
