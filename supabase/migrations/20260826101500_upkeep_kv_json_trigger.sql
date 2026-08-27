-- Derive `json` server-side instead of shipping it from the client.
--
-- The client used to send every value twice: once as `raw` and once parsed.
-- `upkeep:sessions` is a single row that grows all year and is rewritten after
-- every logged set, so that doubling was paid on mobile data at the gym, on
-- every set. The server can parse the value it already received.
--
-- The trigger also owns `updated_at`. It was client-supplied and unconstrained,
-- which is fine for a replica but not for anything that later queries on it.
create or replace function public.upkeep_kv_derive() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
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

drop trigger if exists upkeep_kv_derive_trg on public.upkeep_kv;
create trigger upkeep_kv_derive_trg
  before insert or update on public.upkeep_kv
  for each row execute function public.upkeep_kv_derive();

-- The client never deletes rows: removals are tombstones, and real deletion
-- happens through the `auth.users` cascade. Match the grant to actual usage.
revoke delete on table public.upkeep_kv from authenticated;
