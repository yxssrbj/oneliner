create or replace function public.group_weekly_metrics(group_id uuid,week_start date)
returns table(display_name text,total_r numeric,win_rate numeric,completed_count bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  perform 1 from public.groups where id=group_id for share;
  if not found or not exists(select 1 from public.group_members m where m.group_id=group_weekly_metrics.group_id and m.user_id=auth.uid()) then raise exception 'Group unavailable' using errcode='P0002'; end if;
  if week_start is null or not isfinite(week_start) or extract(isodow from week_start)<>1 then raise exception 'Monday required' using errcode='22023'; end if;
  return query select p.display_name,case when count(t.id) > count(t.r_result) then null else coalesce(sum(t.r_result),0) end,
    count(*) filter(where coalesce(t.source_net_pnl_usd,t.r_result)>0)::numeric / nullif(count(t.id),0),count(t.id)
    from public.group_members m join public.profiles p on p.id=m.user_id
    left join public.trades t on t.owner_id=m.user_id and t.opened_at >= (week_start::timestamp at time zone 'UTC')
      and t.opened_at < ((week_start+7)::timestamp at time zone 'UTC') and t.exit_price is not null
    where m.group_id=group_weekly_metrics.group_id group by m.user_id,p.display_name order by p.display_name,m.user_id;
end; $$;

