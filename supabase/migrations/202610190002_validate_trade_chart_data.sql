create or replace function public.valid_trade_chart_data(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  bar jsonb;
  bar_time timestamptz;
  previous_time timestamptz := '-infinity'::timestamptz;
  open_price numeric;
  high_price numeric;
  low_price numeric;
  close_price numeric;
  volume numeric;
begin
  if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) not between 1 and 5000 then
    return false;
  end if;

  for bar in select entry from jsonb_array_elements(value) as entries(entry) loop
    if jsonb_typeof(bar) <> 'object'
      or (select count(*) from jsonb_object_keys(bar)) <> 6
      or not (bar ?& array['time', 'open', 'high', 'low', 'close', 'volume'])
      or jsonb_typeof(bar->'time') <> 'string'
      or (bar->>'time') !~* '(Z|[+-][0-9]{2}:?[0-9]{2})$'
      or jsonb_typeof(bar->'open') <> 'number'
      or jsonb_typeof(bar->'high') <> 'number'
      or jsonb_typeof(bar->'low') <> 'number'
      or jsonb_typeof(bar->'close') <> 'number'
      or jsonb_typeof(bar->'volume') not in ('number', 'null') then
      return false;
    end if;

    bar_time := (bar->>'time')::timestamptz;
    open_price := (bar->>'open')::numeric;
    high_price := (bar->>'high')::numeric;
    low_price := (bar->>'low')::numeric;
    close_price := (bar->>'close')::numeric;
    if jsonb_typeof(bar->'volume') = 'number' then
      volume := (bar->>'volume')::numeric;
      if volume < 0 then return false; end if;
    end if;

    if bar_time <= previous_time
      or high_price < greatest(open_price, close_price)
      or low_price > least(open_price, close_price)
      or high_price < low_price then
      return false;
    end if;
    previous_time := bar_time;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

alter table public.trades drop constraint if exists trades_chart_data_check;
alter table public.trades
  add constraint trades_chart_data_valid
  check (chart_data is null or public.valid_trade_chart_data(chart_data));
