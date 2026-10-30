alter table public.trades
  alter column original_note drop not null,
  alter column stop_price drop not null,
  alter column setup drop not null,
  add column source_key text,
  add column source_net_pnl_usd numeric,
  add column source_quantity numeric,
  add column source_payload jsonb,
  add constraint trades_owner_source_unique unique(owner_id, source_key),
  add constraint trades_source_details check (
    (source_key is null and source_net_pnl_usd is null and source_quantity is null and source_payload is null
      and original_note is not null and stop_price is not null and setup is not null)
    or (source_key is not null and length(btrim(source_key)) between 1 and 2048
      and source_net_pnl_usd is not null and source_net_pnl_usd > '-Infinity'::numeric and source_net_pnl_usd < 'Infinity'::numeric
      and source_quantity is not null and source_quantity > 0 and source_quantity < 'Infinity'::numeric
      and source_payload is not null and jsonb_typeof(source_payload) = 'object')
  );

create or replace function public.maintain_trade() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.owner_id is distinct from new.owner_id then
    raise exception 'trade owner cannot change' using errcode = '23514';
  end if;
  if row(old.source_key,old.source_net_pnl_usd,old.source_quantity,old.source_payload)
    is distinct from row(new.source_key,new.source_net_pnl_usd,new.source_quantity,new.source_payload) then
    raise exception 'trade source cannot change' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.import_trade_history(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  snapshot jsonb;
  existing jsonb;
  inserted integer := 0;
  already_present integer := 0;
  affected integer;
  entry_value numeric;
  exit_value numeric;
  pnl_value numeric;
  quantity_value numeric;
  opened_value timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if rows is null or jsonb_typeof(rows) <> 'array' then
    raise exception 'Trade array required' using errcode = '22023';
  end if;
  if jsonb_array_length(rows) not between 1 and 2500 or octet_length(rows::text) > 2000000 then
    raise exception 'Invalid import size' using errcode = '22023';
  end if;
  if (select count(distinct value->>'sourceKey') from jsonb_array_elements(rows)) <> jsonb_array_length(rows) then
    raise exception 'Duplicate or missing source identifiers' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(rows) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Trade object required' using errcode = '22023';
    end if;
    if (select count(*) from jsonb_object_keys(item)) <> 8
      or not (item ?& array['sourceKey','symbol','side','entryPrice','exitPrice','openedAt','sourcePnlUsd','quantity'])
      or exists(select 1 from jsonb_each(item) where jsonb_typeof(value) <> 'string')
      or length(btrim(item->>'sourceKey')) not between 1 and 2048
      or btrim(item->>'symbol', E' \t\n\r\f' || chr(11)) = ''
      or item->>'side' not in ('long','short')
      or item->>'openedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
      or exists(select 1 from jsonb_each_text(item) where key in ('entryPrice','exitPrice','sourcePnlUsd','quantity')
        and value !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$') then
      raise exception 'Invalid trade fields' using errcode = '22023';
    end if;
    begin
      entry_value := (item->>'entryPrice')::numeric;
      exit_value := (item->>'exitPrice')::numeric;
      pnl_value := (item->>'sourcePnlUsd')::numeric;
      quantity_value := (item->>'quantity')::numeric;
      opened_value := (item->>'openedAt')::timestamptz;
    exception when data_exception then
      raise exception 'Invalid trade number or timestamp' using errcode = '22023';
    end;
    if entry_value <= 0 or exit_value <= 0 or quantity_value <= 0 or not isfinite(opened_value) then
      raise exception 'Invalid trade values' using errcode = '22023';
    end if;
    -- Keep source identity independent of later journal corrections and decimal formatting.
    snapshot := jsonb_build_object('symbol',item->>'symbol','side',item->>'side','entryPrice',entry_value,
      'exitPrice',exit_value,'openedAt',extract(epoch from opened_value),'sourcePnlUsd',pnl_value,'quantity',quantity_value);
    insert into public.trades(owner_id,symbol,side,entry_price,exit_price,opened_at,idempotency_key,
      source_key,source_net_pnl_usd,source_quantity,source_payload)
    values(auth.uid(),item->>'symbol',item->>'side',entry_value,exit_value,opened_value,gen_random_uuid(),
      item->>'sourceKey',pnl_value,quantity_value,snapshot)
    on conflict(owner_id,source_key) do nothing;
    get diagnostics affected = row_count;
    if affected = 1 then
      inserted := inserted + 1;
    else
      select source_payload into existing from public.trades
        where owner_id = auth.uid() and source_key = item->>'sourceKey' for share;
      if existing is distinct from snapshot then
        raise exception 'Source trade differs from existing import' using errcode = '23505';
      end if;
      already_present := already_present + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted',inserted,'alreadyPresent',already_present);
end;
$$;
revoke all on function public.import_trade_history(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.import_trade_history(jsonb) to authenticated;
