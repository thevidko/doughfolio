# DoughFolio design guide

The single source of truth for the app's visual identity. Components never
hardcode visual decisions — everything flows through the design tokens in
`src/client/styles/globals.css`, and this document explains what those tokens
mean and how the style behaves.

> **Built to be re-themed.** The owner may regenerate this styling later (e.g.
> with a dedicated design pass for better UX). That must never require touching
> components: all colors, fonts, radii, motion durations and textures live in
> tokens/utilities defined once. If a visual decision cannot be expressed as a
> token or shared utility, it does not belong in a component.

## Art direction

**"Drawn with pencil and crayons."** The whole UI looks hand-drawn: soft,
slightly irregular lines, warm cozy colors, paper texture. Kawaii Japanese
dumpling (bao/dango) theme throughout — friendly, plump, gentle. Reference:
`assets/branding/logo-full.png`. The mascot character and lettering are
settled; only the logo's surroundings (the coin chest composition, background
details) will still be reworked — so the palette and the character itself are
safe to build on.

Practical translation:

- **Irregular lines** — no perfect rectangles. Cards/buttons use uneven
  border-radius (the "hand-drawn" trick, e.g.
  `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px`) exposed as a
  shared utility (`.wobbly`), with 2–3 variants so repeated elements don't look
  stamped. For true wobble on dividers and underlines, an SVG
  `feTurbulence` + `feDisplacementMap` filter is available — use sparingly
  (filters are GPU-costly in long lists).
- **Ink outlines** — interactive elements get a visible outline in `ink`
  (2–3 px), like crayon strokes; shadows are soft, warm and small
  (never harsh black).
- **Sketchy accents** — headings can carry a hand-drawn SVG underline; empty
  states and illustrations reuse the doodle set (stars, coins, sparkles,
  steam puffs).

## Color tokens (sampled from the logo)

Defined in `globals.css` under `@theme`. Semantic names only — components must
never use raw Tailwind palette colors.

| Token | Light value | Meaning & usage |
| --- | --- | --- |
| `cream` | `#FAF4E8` | Page background — warm paper, like a steamed-bun wrapper. |
| `cream-dark` | `#F0E6D2` | Subtle fills, hover backgrounds, borders on paper. |
| `dough` | `#E0A34E` | Primary brand gold ("Dough" lettering). Primary buttons, highlights. |
| `dough-dark` | `#C9883A` | Hover/active of primary, text-on-cream accents. |
| `matcha` | `#A9D18D` | Soft green ("Folio" lettering). Positive values, gains, success. |
| `matcha-dark` | `#7FB45E` | Stronger positive accents, success text with enough contrast. |
| `blush` | `#F2A0A8` | Mascot-cheek pink. Negative values, losses, warnings — kept gentle. |
| `blush-dark` | `#E0717C` | Stronger negative accents, error text. |
| `ink` | `#4A3728` | Hand-drawn outline brown. Primary text and strokes — never pure black. |
| `ink-soft` | `#8A715C` | Secondary text, captions, disabled states. |

Semantic mapping for finance: **gains = matcha, losses = blush** (with icons or
arrows alongside color — never color alone, for accessibility).

### Dark theme (warm, not gray)

Dark mode keeps the cozy mood: warm cocoa instead of cold gray. Proposed values
(to be tuned on real screens when the theme toggle is implemented):

| Token | Dark value | Note |
| --- | --- | --- |
| `cream` → surface | `#2B211A` | Warm dark cocoa paper. |
| `cream-dark` → surface-2 | `#3A2E24` | Cards, raised surfaces. |
| `ink` → text | `#F0E6D2` | Light warm text (reuses light `cream-dark`). |
| `ink-soft` | `#B49A82` | Secondary text. |
| `dough` / `matcha` / `blush` | slightly lightened | Same hues, +5–10 % lightness for contrast on dark. |

Both themes are first-class (PLANNING #12): system preference default, toggle
in settings. Every token must have a dark value — a component that looks wrong
in dark mode is a bug.

## Typography

Requirements: chubby rounded display font matching the logo lettering, full
UTF-8 with **Czech diacritics** (latin-ext subset), and **self-hosted** files —
no Google Fonts CDN (the app never phones home; see CLAUDE.md).

- **Display / headings: Baloo 2** — plump, rounded, closest free match to the
  logo lettering; latin-ext ✓. Alternatives if the tone needs adjusting:
  Fredoka (lighter, geometric) or Comfortaa (thinner, airy) — both latin-ext ✓.
- **Body: Nunito** — rounded terminals, excellent readability at small sizes,
  latin-ext ✓. Alternative: Quicksand.
- **Numbers:** money columns need **tabular figures** for alignment
  (`font-variant-numeric: tabular-nums`); verify the chosen fonts support the
  `tnum` feature at implementation time, otherwise pick a dedicated numeric
  font for tables.
- Delivery: `@fontsource/baloo-2` + `@fontsource/nunito` (woff2 bundled by
  Bun), wired into the `--font-*` tokens in `globals.css`.

## Page background

Warmer and textured, with faint drawn details:

- Base `cream` + a very subtle paper-grain texture (tiny SVG turbulence noise
  or a small tiling asset — must stay under ~2 % visual weight).
- A sparse, repeating doodle pattern of the brand set — stars, little coins,
  sparkles — drawn in `ink` at very low opacity (≈3–5 %), like faint pencil
  sketches on the paper. Density stays low so content areas remain calm;
  cards sit on plain `cream`/surface so data is always readable.
- The doodle SVGs live in `src/client/assets/doodles/` and are reused for
  empty states and decorations.

## Motion — "everything pops"

Animations follow the crayon-cartoon feel: bouncy, quick, cheerful.

- **Enter/appear:** pop — scale `0.9 → 1.03 → 1` with a spring/overshoot ease,
  150–250 ms. Lists stagger children by ~30 ms.
- **Hover:** gentle wiggle or 1–2° tilt on playful elements (buttons, cards);
  never on dense data rows.
- **Press:** squash (scale `0.96`), like poking a soft bun.
- **Value changes:** numbers count up/bounce briefly; gains flash `matcha`,
  losses `blush`.
- **Page transitions:** soft pop/fade, 300–400 ms max — snappy beats cute.
- **Reduced motion:** `prefers-reduced-motion` disables all decorative motion
  (pops, wiggles, mascot). Non-negotiable accessibility rule.
- Implementation: CSS transitions/keyframes first; add the `motion` package
  (Framer Motion's successor) once orchestrated/spring animations are needed.
  Durations and eases are tokens (`--motion-*`) so the whole feel can be
  retuned in one place.

## Mascot on the web

The dumpling character appears in the UI, not just the logo:

- **Phase 1 (now):** static mascot image with a CSS idle loop — slow bob
  (breathing) and occasional blink; floats on the landing/empty states.
- **Phase 2:** proper animated asset — sprite sheet or Lottie/Rive export —
  with a small set of states: idle, happy (portfolio up / action succeeded),
  sad-cute (losses / errors), sleeping (empty portfolio). The mascot design is
  final (only the logo's background composition will change), so this work can
  start whenever animation becomes a priority — it just needs the character
  cut out as a standalone asset first.
- The mascot is decoration: it must never block content, and it hides under
  `prefers-reduced-motion`.

## Component style specs (baseline)

- **Buttons:** wobbly radius, 2 px `ink` outline, `dough` fill (primary) or
  transparent (secondary), squash on press, tiny tilt on hover.
- **Cards:** plain surface, wobbly radius, soft warm shadow
  (`0 4px 12px rgb(74 55 40 / 0.08)`), optional sketchy corner doodle.
- **Inputs:** paper-colored fill, `ink-soft` outline that "draws itself"
  thicker (`ink`) on focus; validation colors via `matcha`/`blush`.
- **Charts:** follow the same palette; lines slightly thicker and rounded
  (`stroke-linecap: round`) to feel drawn.
