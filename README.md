# Upkeep

Personal health tracker PWA. Built for one user, runs entirely offline, no backend.

## What it does

- **Workout logger** — Push/Pull/Legs split auto-detected from the day. Log sets with weight and reps, with +/- steppers so you rarely touch the keypad. Handles barbell load, bodyweight lifts (added weight) and timed holds. Tracks previous session values, pre-fills a progressive-overload target, flags stalled compound lifts after 3 sessions, and shows a PR badge when you beat a lift. Tap any lift for its full history and estimated-1RM trend.
- **Progress** — 26-week consistency heatmap, transformation silhouette, estimated-1RM trends, PR timeline, muscle-group balance over the last 4 weeks, body trend charts and a tape measurement table.
- **Daily** — Four sections:
  - *Food* — protein logged in **grams** against a target derived from body weight, with one-tap adds for common foods.
  - *Sleep* — phone away → in bed → awake, keyed by the night you went to bed, plus a 1–5 rested rating and a prompt to fill in last night's wake-up.
  - *Meds* — what you take, the dose, and how often (daily / weekly / every N days / as needed), with 30-day adherence.
  - *Skin* — ordered morning and night routines; actives can run on alternate days.
- **Today** — Streak, sessions this week, protein, last night's sleep, meds and skincare still outstanding, and recent workout history.
- **Settings** — Full backup and restore (merge or replace), JSON/CSV export, and a weekly digest for a human or AI trainer.

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
