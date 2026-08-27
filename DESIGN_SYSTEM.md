# GainZ Design System — Vault Theme

Dark, editorial gym tracker aesthetic. Graphite base, oxblood accent, serif headlines, mono numerics.

---

## Color Palette

### Tailwind Tokens

| Token | Hex | Role |
|---|---|---|
| `bg` | `#0E0E10` | Page background |
| `panel` | `#16161A` | Card / sidebar / nav surface |
| `panel-inset` | `#1C1C20` | Nested surface (input bg, icon well) |
| `text` | `#EDEAE3` | Primary text |
| `text-dim` | `#9A968D` | Secondary / label text |
| `text-faint` | `#5C5851` | Disabled / placeholder |
| `accent` | `#B0413E` | Oxblood — primary action, active state |
| `accent-text` | `#EDEAE3` | Text on accent bg |
| `success` | `#9CB084` | Pull day / completed / positive |
| `warn` | `#D5A45F` | Legs day / caution |
| `danger` | `#B0413E` | Error (same as accent) |

### CSS Variables (add to `:root`)

```css
:root {
  --color-panel-border: rgba(255, 255, 255, 0.06);
  --color-divider:      rgba(255, 255, 255, 0.08);
  --color-accent-soft:  rgba(176, 65, 62, 0.18);
  --color-heatmap-empty: #1A1A1E;
}
```

### Special Backgrounds

```css
/* Page-level vault gradient */
.bg-vault {
  background:
    radial-gradient(circle at 30% -10%, rgba(176, 65, 62, 0.18), transparent 55%),
    #0e0e10;
}
```

---

## Typography

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| Serif (headings) | Newsreader | Georgia, serif |
| Sans (body / labels) | Inter Tight | system-ui, sans-serif |
| Mono (numerics / code) | JetBrains Mono | monospace |

### Google Fonts import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500;600&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### Type Scale

| Usage | Font | Size | Weight | Tracking | Color |
|---|---|---|---|---|---|
| Page kicker | mono | 11px | 400 | +0.14em | `text-dim` |
| Page title | serif | 32px / 36px lh | 500 | −0.04em | `text` |
| Section label | sans | 11px | 500 | +0.12em | `text-dim` |
| Eyebrow | mono | 10px | 400 | +0.14em | `text-dim` |
| Stat label | sans | 10px | 400 | +0.08em | `text-dim` |
| Stat value | mono | 30px / 32px lh | 500 | −0.04em | `text` or `accent` |
| Stat unit | sans | 11px | 400 | +0.04em | `text-dim` |
| Body / description | sans | 13px | 400 | 0 | `text-dim` |
| Button | sans | 13px | 600 | +0.04em | uppercase |
| Pill / badge | mono | 10px | 500 | +0.04em | uppercase |
| Nav label | sans | 10px | 600 | +0.04em | uppercase |

---

## Spacing & Radius

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-card` | 14px | Buttons, icon wells |
| `rounded-card-lg` | 22px | Cards |
| `rounded-pill` | 999px | Pills, nav bar |
| `rounded-[10px]` | 10px | Sidebar nav items, logo badge |

### Box Shadow

```
card: 0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px rgba(0,0,0,0.4)
```

---

## Components

### Card

```tsx
// Base card — graphite panel with subtle border and deep shadow
<div className="bg-panel rounded-card-lg shadow-card border border-[var(--color-panel-border)] p-4">
  {children}
</div>

// With left accent border (active/highlighted state)
<div className="bg-panel rounded-card-lg shadow-card border border-[var(--color-panel-border)] border-l-[3px] border-l-accent p-4">

// With left warn border
<div className="... border-l-[3px] border-l-warn p-4">
```

### Button

```tsx
// Primary — oxblood fill
<button className="flex items-center justify-center gap-2 px-[18px] py-3.5 rounded-card
                   font-sans font-semibold text-[13px] uppercase tracking-[0.04em]
                   bg-accent text-accent-text
                   transition-all active:scale-[0.98]
                   disabled:opacity-40 disabled:cursor-not-allowed">

// Secondary — ghost with border
<button className="... bg-transparent text-text border border-[var(--color-panel-border)]">
```

### Pill / Badge

```tsx
// Base classes (all variants)
"inline-flex items-center px-2 py-[3px] rounded-pill border
 font-mono text-[10px] uppercase tracking-[0.04em] font-medium"

// Variants
dim:     "bg-transparent border-[var(--color-panel-border)] text-text-dim"
accent:  "bg-[var(--color-accent-soft)] border-accent text-accent"
success: "bg-transparent border-success text-success"
warn:    "bg-transparent border-warn text-warn"
danger:  "bg-transparent border-danger text-danger"
push:    "bg-transparent border-accent/40 text-accent"   // Push day
pull:    "bg-transparent border-success/40 text-success" // Pull day
legs:    "bg-transparent border-warn/40 text-warn"       // Legs day
```

### Stat Block

```tsx
<div className="flex flex-col gap-1.5 min-w-0">
  <span className="font-sans text-[10px] uppercase tracking-[0.08em] text-text-dim">
    {label}
  </span>
  <span className="font-mono text-[30px] leading-[32px] font-medium tracking-[-0.04em] flex items-baseline gap-1 text-text">
    {value}
    <span className="font-sans text-[11px] font-normal uppercase tracking-[0.04em] text-text-dim">
      {unit}
    </span>
  </span>
</div>
```

### Page Title

```tsx
<div className="pb-4">
  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim mb-1.5">
    {kicker}
  </p>
  <h1 className="font-serif text-[32px] leading-[36px] font-medium text-text tracking-[-0.04em]">
    {title}
  </h1>
</div>
```

### Section Label

```tsx
<div className="flex items-baseline justify-between px-1 mb-2.5">
  <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-text-dim font-medium">
    {label}
  </span>
  {/* optional right value */}
  <span className="font-mono text-[11px] text-text-dim tracking-[0.04em]">{right}</span>
</div>
```

### Eyebrow

```tsx
<p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
  {text}
</p>
```

### Divider

```tsx
<div className="h-px bg-[var(--color-divider)]" />
```

### Icon (Lucide)

```tsx
// Standard stroke weight across all icons
<Icon size={18} strokeWidth={1.6} />

// Sizes used
// 17px — sidebar nav
// 18px — default
// 20px — bottom nav, empty state
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-10 px-6 text-center">
  <div className="w-12 h-12 rounded-[14px] bg-panel-inset border border-[var(--color-panel-border)]
                  flex items-center justify-center mb-4">
    <Icon size={20} strokeWidth={1.5} className="text-text-faint" />
  </div>
  <p className="font-serif text-[18px] font-medium text-text tracking-[-0.02em] mb-1">{title}</p>
  <p className="font-sans text-[13px] text-text-dim leading-[19px] max-w-[240px]">{sub}</p>
</div>
```

---

## Navigation

### Bottom Bar (mobile, `md:hidden`)

```tsx
// Container: fixed, 18px from bottom, 12px inset on sides
<nav className="fixed bottom-[18px] left-3 right-3 z-50">
  <div className="bg-panel border border-[var(--color-panel-border)] rounded-pill
                  flex items-center justify-around px-2 py-1.5 shadow-card">

    {/* Active tab */}
    <a className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-pill bg-accent text-accent-text">
      <Icon size={20} strokeWidth={1.6} />
      <span className="font-sans text-[10px] uppercase tracking-[0.04em] font-semibold">{label}</span>
    </a>

    {/* Inactive tab */}
    <a className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-pill text-text-dim">
```

### Sidebar (desktop, `hidden md:flex`)

```tsx
<aside className="flex flex-col w-60 shrink-0 h-full
                  border-r border-[var(--color-panel-border)] bg-panel px-6 py-8">

  {/* Logo lockup */}
  <div className="flex items-center gap-3 mb-10">
    <div className="w-9 h-9 rounded-[10px] bg-accent flex items-center justify-center shrink-0">
      <span className="font-mono font-bold text-sm text-accent-text leading-none">GZ</span>
    </div>
    <span className="font-serif text-xl text-text tracking-tight">AppName</span>
  </div>

  {/* Active nav item */}
  <a className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium
                bg-[var(--color-accent-soft)] text-accent">

  {/* Inactive nav item */}
  <a className="... text-text-dim hover:text-text hover:bg-panel-inset">
    <Icon size={17} strokeWidth={1.6} />
    <span className="font-sans">{label}</span>
  </a>
```

---

## Global Base CSS

```css
* {
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  height: 100dvh;
}

body {
  color: #EDEAE3;
  font-family: 'Inter Tight', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior: none;
}

/* Hide scrollbars */
::-webkit-scrollbar { width: 0; height: 0; }

/* Remove number input spinners */
input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; }
input[type='number'] { -moz-appearance: textfield; }
```

---

## Tailwind Config

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#0E0E10',
        panel:        '#16161A',
        'panel-inset':'#1C1C20',
        text:         '#EDEAE3',
        'text-dim':   '#9A968D',
        'text-faint': '#5C5851',
        accent:       '#B0413E',
        'accent-text':'#EDEAE3',
        success:      '#9CB084',
        warn:         '#D5A45F',
        danger:       '#B0413E',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans:  ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card:    '14px',
        'card-lg':'22px',
        pill:    '999px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## Design Principles

- **Dark but warm** — graphite base avoids cold blue-black; warm gray text keeps it readable
- **Oxblood accent** — used sparingly: active states, primary CTAs, left-border on important cards
- **Serif for personality** — headlines use Newsreader to feel editorial, not utilitarian
- **Mono for data** — all numbers use JetBrains Mono for mechanical precision
- **Ghost-first UI** — buttons, pills, and borders are low-contrast by default; accent only on selection/action
- **Mobile-first** — bottom pill nav on mobile, 240px sidebar on desktop; no hybrid
- `strokeWidth={1.6}` on all Lucide icons — slightly thinner than default for elegance
