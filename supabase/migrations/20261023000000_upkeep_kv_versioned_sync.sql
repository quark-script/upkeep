-- Two-way sync between devices.
--
-- Until now each device only pushed, with a plain upsert, so whichever device
-- wrote last silently replaced the other's value: a freshly signed-in phone
-- overwrote the real medicines list with its empty starter list.
--
-- Every row now carries a version that the server bumps on each write, and
-- clients write through `upkeep_kv_put`, which only applies a write made against
-- the version the device last saw. A stale write is refused, the device pulls
-- the newer value, merges, and retries. Nothing is overwritten unseen.

alter table public.upkeep_kv add column if not exists version bigint not null default 1;

-- Pulls ask for "rows changed since"; keep that cheap as the table grows.
create index if not exists upkeep_kv_user_updated_idx on public.upkeep_kv (user_id, updated_at);

create or replace function public.upkeep_kv_derive() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  else
    new.version := 1;
  end if;
  -- Values are not required to be JSON; `raw` is what a restore uses, and
  -- `json` exists only so server-side features can query without parsing text.
  begin
    new.json := new.raw::jsonb;
  exception when others then
    new.json := null;
  end;
  return new;
end;
$$;

-- Conditional write. Each element of `p_rows`:
--   { "key": text, "raw": text, "deleted": bool, "base": bigint | null }
-- `base` null means "create only if the key does not exist yet".
-- Returns one row per input; `ok` false means the cloud moved on and the device
-- must pull before writing that key again.
--
-- Security invoker: row-level security still decides what the caller can touch.
create or replace function public.upkeep_kv_put(p_rows jsonb)
returns table (k text, v bigint, ok boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  new_version bigint;
  is_deleted boolean;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    new_version := null;
    is_deleted := coalesce((r->>'deleted')::boolean, false);

    if r->>'base' is null then
      insert into public.upkeep_kv as t (user_id, key, raw, deleted)
      values (uid, r->>'key', r->>'raw', is_deleted)
      on conflict (user_id, key) do nothing
      returning t.version into new_version;
    else
      update public.upkeep_kv as t
         -- A tombstone keeps the last value, so a mistaken delete is recoverable.
         set raw = case when is_deleted then t.raw else r->>'raw' end,
             deleted = is_deleted
       where t.user_id = uid
         and t.key = r->>'key'
         and t.version = (r->>'base')::bigint
      returning t.version into new_version;
    end if;

    k := r->>'key';
    v := new_version;
    ok := new_version is not null;
    return next;
  end loop;
end;
$$;

revoke all on function public.upkeep_kv_put(jsonb) from public, anon;
grant execute on function public.upkeep_kv_put(jsonb) to authenticated;
