# Contributing

Issues and pull requests are welcome. For anything bigger than a fix, open an issue first so we
can agree on the approach.

## Setup

Follow the quick start in the [README](README.md). Everything but sign-in and sync works without a
Supabase project.

## Before opening a pull request

- `npm run build` passes. It type-checks the app, then builds.
- `npm test` passes, with a test next to the code in `src/lib` for logic you changed.
- A change to stored data comes with a migration in `src/lib/migrations.ts`, so existing data
  moves to the new shape. A database change adds a file in `supabase/migrations`.
- Code follows the style around it. Interface text is short and plain.

By contributing, you agree that your contributions are licensed under the
[AGPL-3.0](LICENSE), like the rest of Upkeep.
