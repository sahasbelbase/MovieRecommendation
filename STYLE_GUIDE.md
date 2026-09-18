# UI & UX Style Guide: Human-Crafted Cinema Experience

> **Design Philosophy**: Built by movie lovers for movie lovers. Clean, quiet, tactile, and fast. The interface gets out of the way and lets the films and discovery shine. It strictly rejects AI design clichés.

---

## 1. The Anti-"AI Aesthetic" Principles

| AI Cliché (Forbidden ❌) | Human-Crafted Benchmark (Required ✅) |
| :--- | :--- |
| **Neon purple/cyan gradients & glowing shadows** on every border and button. | **Grounded, filmic neutral palette**: Deep carbon/zinc background (`#09090b`), crisp 1px borders (`#27272a`), subtle warm accents. |
| **Sparkle icons (`✨`) & buzzwords** ("Unlock your cinematic AI universe"). | **Honest, functional copy**: "Top Picks For You", "Because You Watched Inception", "Mark as Watched". |
| **Giant empty hero sections** with floating 3D balls or stock illustrations. | **Content-first layouts**: Posters, titles, metadata, and immediate search at the user's fingertips. |
| **Jarring animations** with bouncing spring physics and disorienting parallax. | **Snappy micro-interactions**: Sub-150ms transitions, subtle card lifts (`hover:scale-[1.02]`), crisp active states. |
| **Complex nested menus & popup modals** that interrupt the user. | **Direct manipulation**: One-click "Watched" checkmarks, intuitive `/` search shortcut, easy `Esc` to close. |

---

## 2. Color System & Design Tokens

A cinema-calibrated palette inspired by Letterboxd and Linear:

```css
:root {
  /* Canvas & Surfaces */
  --bg-canvas: #09090b;       /* Deepest zinc/black */
  --bg-surface: #121215;      /* Elevated card surface */
  --bg-surface-hover: #18181b;/* Interactive hover surface */
  --border-subtle: #27272a;   /* Clean 1px separator */
  --border-hover: #3f3f46;    /* Card hover border */

  /* Typography */
  --text-primary: #f4f4f5;    /* 95% white, high contrast headers & titles */
  --text-secondary: #a1a1aa;  /* Muted metadata (year, runtime, director) */
  --text-tertiary: #71717a;   /* Captions, badges, subtle labels */

  /* Semantic Accents (Used sparingly for state only) */
  --accent-watched: #10b981;  /* Emerald green for watched checkmark & confirmation */
  --accent-rating: #f59e0b;   /* Warm amber for IMDb/TMDB star ratings */
  --accent-primary: #e11d48;  /* Subtle crimson/rose for primary CTA accents */
  --focus-ring: #f43f5e;      /* Accessible outline for keyboard navigation */
}
```

---

## 3. Typography & Hierarchy

* **Font Stack**: System sans-serif / Geist / Inter (`font-sans` with `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`).
* **Movie Titles**: `font-medium tracking-tight text-zinc-100 line-clamp-1`
* **Metadata (Year, Rating, Runtime)**: `text-xs font-mono tabular-nums text-zinc-400`
* **Section Headers**: `text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2`
* **Movie Synopses**: `text-sm leading-relaxed text-zinc-300 font-normal`

---

## 4. Search & Discovery UX (Built for Speed)

1. **Instant Keyboard Navigation**:
   * Pressing `/` or `Cmd+K` anywhere focuses the search bar immediately.
   * Pressing `Escape` clears search or closes open detail modals.
2. **Predictable Search Bar**:
   * Minimalist input with a magnifying glass icon, a clear `x` button when text is entered, and a subtle keyboard badge `[/]`.
   * Fast debounced typeahead with immediate suggestions dropdown showing poster thumbnail, title, release year, and genre.
3. **Genre & Filter Pills**:
   * Horizontal scrollable chips (`Drama`, `Sci-Fi`, `Action`, `Comedy`) that toggle instantly without page reloads.

---

## 5. Movie Card & Tactile Micro-Interactions

```tsx
/* Concept Anatomy of a Human-Crafted Movie Card */
<div className="group relative flex flex-col rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-2.5 transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-900 hover:scale-[1.02] cursor-pointer">
  {/* Poster with aspect ratio 2:3 */}
  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-zinc-800">
    <img src={posterUrl} alt={title} className="h-full w-full object-cover transition-opacity duration-200" />
    
    {/* Quick Action: Mark as Watched (Top Right) */}
    <button 
      onClick={toggleWatched}
      className="absolute top-2 right-2 rounded-full p-2 bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/90 transition-transform active:scale-90"
      title={isWatched ? "Marked as Watched" : "Mark as Watched"}
    >
      <CheckIcon className={isWatched ? "text-emerald-400 fill-emerald-400" : "text-zinc-400"} />
    </button>
  </div>

  {/* Clean Metadata Block */}
  <div className="mt-2.5 flex flex-col gap-1">
    <h3 className="text-sm font-medium text-zinc-100 line-clamp-1">{title}</h3>
    <div className="flex items-center justify-between text-xs text-zinc-400">
      <span>{year}</span>
      <span className="flex items-center gap-1 text-amber-400 font-medium">★ {rating.toFixed(1)}</span>
    </div>
  </div>
</div>
```

---

## 6. Feedback & Frictionless State Changes

* **One-Click "Mark as Watched"**:
  * Toggling watched updates instantly on the client (optimistic UI) before network roundtrip.
  * Watched status displays a discrete green checkmark pill.
  * A non-blocking toast notification appears at the bottom-right: *"Added [Movie Title] to Watched • Undo"*.
* **Empty & Loading States**:
  * No jarring spinners that jump the screen. Use smooth, subtle pulse skeleton cards (`animate-pulse bg-zinc-800/50 rounded-xl`) that match the exact aspect ratio of movie posters.
  * Friendly, human empty states: *"No movies found matching that query. Try searching for a director or genre."*

---

## 7. Modal & Media Player Behavior

* **Clean Backdrop Header**: The movie modal displays the high-res backdrop with a soft gradient overlay fading into the deep surface background.
* **Inline Trailer Player**: Embedded YouTube player starts muted or with clear play controls, without obnoxious autoplay sound.
* **Cast & Crew**: Small circular portraits of key actors and director with character names underneath.
* **Light-Dismiss & Platform Standard**:
  * Closes via `Escape` key, close `x` icon, or clicking outside the backdrop (light-dismiss).
