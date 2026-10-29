# Architecture

Upkeep is a single-page app (React and Vite) that keeps everything in the browser's
`localStorage`. Supabase is optional: signed in, the same values are backed up and synced between
devices.

## On the device

- Every value lives under one prefix, `upkeep:` ([`src/lib/storage.ts`](../src/lib/storage.ts)):
  lists such as sessions, medicines and measurements, plus one key per day for food, sleep,
  medicine and skincare ticks. Backup, export and reset find everything by that prefix.
- Data migrations ([`src/lib/migrations.ts`](../src/lib/migrations.ts)) run once at startup,
  before anything reads storage. Each records itself in `upkeep:migrations` and keeps a snapshot
  until you delete it in Settings, so an upgrade can be undone.
- Backups ([`src/lib/backup.ts`](../src/lib/backup.ts)) are a JSON copy of every key. Restoring
  merges into what's there or replaces it. Exports
  ([`src/lib/export.ts`](../src/lib/export.ts)) are for reading: a JSON report, CSV files and a
  weekly summary in Markdown.
- The app is a PWA (`vite-plugin-pwa`), so it installs and works offline.

## Sync

The cloud copy is one table, `public.upkeep_kv`: a row per key, with the raw value, the value as
JSON, a tombstone flag and a version the server bumps on every write
([`supabase/migrations`](../supabase/migrations)).

Each cycle is pull, merge, push ([`src/lib/sync.ts`](../src/lib/sync.ts)):

- **Pull** fetches rows changed since this device last looked and merges each into the local
  value ([`src/lib/merge.ts`](../src/lib/merge.ts)). Lists merge item by item (by `id`, or by
  `date` for measurements), objects field by field, against the cloud value this device last
  saw. So a medicine added on one phone and a workout logged on another both survive.
- **Push** writes changed values through `upkeep_kv_put`, which applies a write only if the row
  is still at the version this device last saw. Otherwise it's refused, and the device pulls,
  merges and tries again.
- A new device never pushes before its first full pull, so its empty starter lists can't
  overwrite real data. Deletions are tombstones that keep the last value.
- Screens read storage when they open, so a pull that changes something reloads the page: at
  once if the app is on screen, otherwise when you come back to it. Pulls happen at startup, on
  sign-in and on returning to the app, never in the middle of logging.

## Sign-in and access

- Sign-in is a 6-digit code by email (`signInWithOtp` with `shouldCreateUser: false`). A link
  would open the browser, whose storage an installed iOS app can't see. Sign-ups are off for the
  project, so only accounts created in the dashboard can sign in.
- Row level security limits each account to its own rows, and signed-out visitors have no access
  to the table at all. The browser holds only the publishable key. Rows are never deleted by the
  app; deleting the account deletes them.

## Food

Search looks through recent foods, your own and a built-in table of common Indian foods with
macros per 100 g ([`src/lib/foods.ts`](../src/lib/foods.ts)). Each food has household servings
("1 bowl", "1 katori") as gram weights. An entry stores its grams and macros when logged, so
correcting a food later changes only what comes after.

## Design

The Vault theme: graphite with an oxblood accent, Newsreader for headings and JetBrains Mono for
numbers. The colours are in [`tailwind.config.ts`](../tailwind.config.ts) and
[`src/index.css`](../src/index.css), and the shared pieces in
[`src/components/ui.tsx`](../src/components/ui.tsx).
