# GainZ

Personal gym tracker PWA. Built for one user, runs entirely offline, no backend.

## What it does

- **Workout logger** — Push/Pull/Legs split auto-detected from the day. Log sets with weight and reps, one at a time. Tracks previous session values so you always know what to beat. Flags stalled compound lifts after 3 sessions. Shows a PR badge when you hit a new max.
- **Progress** — 26-week consistency heatmap. Body trend charts (weight, body fat, muscle mass). Tape measurement table across the last 3 months.
- **Daily** — Protein checklist with a progress ring. Resets at midnight. 3-stage sleep cycle logger (phone away → in bed → awake) with a weekly timeline.
- **Today** — Dashboard showing streak, sessions this week, protein score, last night's sleep, and recent workout history.
- **Settings** — Export all data as JSON or CSV. Reset everything.

## Stack

- React 18 + Vite 5 + TypeScript
- Tailwind CSS v3 (Vault theme — graphite + oxblood)
- `localStorage` for all data — no API calls, no auth
- `vite-plugin-pwa` + Workbox — installable, works offline

## Getting started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Regenerate PWA icons:

```bash
npm run gen:icons
```
