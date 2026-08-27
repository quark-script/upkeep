-- Durable replica of the app's localStorage. One row per app-owned key.
--
-- `raw` is the verbatim localStorage string, so a restore reproduces bytes exactly
-- and can be fed straight into the existing file-restore path. `json` is the same
-- value parsed, so server-side features can query it in SQL; it is null when the
-- value is not valid JSON.
create table if not exists public.upkeep_kv (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  raw        text,
  json       jsonb,
  -- Tombstone: a key deleted on the device must not resurrect on restore.
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.upkeep_kv enable row level security;

-- The only access control that matters: the anon/publishable key is public by design.
drop policy if exists own_rows on public.upkeep_kv;
create policy own_rows on public.upkeep_kv
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Signed-out clients have no business touching this table at all.
revoke all on table public.upkeep_kv from anon;
grant select, insert, update, delete on table public.upkeep_kv to authenticated;
