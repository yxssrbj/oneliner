create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name, E' \t\n\r\f\v') <> '')
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  original_note text not null check (btrim(original_note, E' \t\n\r\f\v') <> ''),
  symbol text not null check (btrim(symbol, E' \t\n\r\f\v') <> ''),
  side text not null check (side in ('long', 'short')),
  entry_price numeric not null check (entry_price > 0 and entry_price < 'Infinity'::numeric),
  stop_price numeric not null check (stop_price > 0 and stop_price < 'Infinity'::numeric),
  setup text not null check (btrim(setup, E' \t\n\r\f\v') <> ''),
  opened_at timestamptz not null,
  exit_price numeric check (exit_price is null or (exit_price > 0 and exit_price < 'Infinity'::numeric)),
  r_result numeric generated always as (
    case
      when exit_price is null then null
      when side = 'long' then (exit_price - entry_price) / (entry_price - stop_price)
      else (entry_price - exit_price) / (stop_price - entry_price)
    end
  ) stored,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_stop_on_loss_side check (
    (side = 'long' and stop_price < entry_price)
    or (side = 'short' and stop_price > entry_price)
  ),
  constraint trades_owner_idempotency_key_unique unique (owner_id, idempotency_key)
);

create function public.maintain_trade() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    raise exception 'trade owner cannot change' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger maintain_trade_before_update
before update on public.trades
for each row execute function public.maintain_trade();

alter table public.profiles enable row level security;
alter table public.trades enable row level security;

create policy profiles_owner_select on public.profiles
for select to authenticated using (auth.uid() = id);
create policy profiles_owner_insert on public.profiles
for insert to authenticated with check (auth.uid() = id);
create policy profiles_owner_update on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy trades_owner_select on public.trades
for select to authenticated using (auth.uid() = owner_id);
create policy trades_owner_insert on public.trades
for insert to authenticated with check (auth.uid() = owner_id);
create policy trades_owner_update on public.trades
for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy trades_owner_delete on public.trades
for delete to authenticated using (auth.uid() = owner_id);

revoke all on public.profiles, public.trades from public, anon;
grant select, insert, update on public.profiles, public.trades to authenticated;
grant delete on public.trades to authenticated;
revoke all on function public.maintain_trade() from public, anon, authenticated;
