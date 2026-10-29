create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name, E' \t\n\r\f' || chr(11))) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.group_invites (
  group_id uuid primary key references public.groups(id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);
create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);
create index group_members_user_id on public.group_members(user_id);
alter table public.groups enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_invites, public.group_members from public, anon, authenticated;

create function public.create_group(name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if name is null or length(btrim(name,E' \t\n\r\f' || chr(11))) not between 1 and 80
    or not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'Display name and group name required' using errcode='22023';
  end if;
  insert into public.groups(owner_id,name) values(auth.uid(),btrim(name,E' \t\n\r\f' || chr(11))) returning id into new_id;
  insert into public.group_members(group_id,user_id) values(new_id,auth.uid());
  insert into public.group_invites(group_id) values(new_id);
  return new_id;
end; $$;

create function public.list_my_groups() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'ownerId',g.owner_id) order by g.created_at,g.id)
    from public.groups g join public.group_members m on m.group_id=g.id where m.user_id=auth.uid()),'[]'::jsonb);
end; $$;

create function public.get_group_details(group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  select * into g from public.groups where id=group_id for share;
  if not found or not exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=auth.uid()) then
    raise exception 'Group unavailable' using errcode='P0002';
  end if;
  return jsonb_build_object('group',jsonb_build_object('id',g.id,'name',g.name,'ownerId',g.owner_id),
    'members',(select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name) order by m.joined_at,m.user_id)
      from public.group_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id),
    'inviteToken',case when g.owner_id=auth.uid() then (select i.token from public.group_invites i where i.group_id=g.id) else null end,
    'viewerId',auth.uid());
end; $$;

create function public.join_group(token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Display name required' using errcode='22023'; end if;
  select g.id into target from public.groups g join public.group_invites i on i.group_id=g.id where i.token=join_group.token for update of g;
  -- Recheck after the lock so rotation cannot admit a waiting stale invite.
  if target is null or not exists(select 1 from public.group_invites i where i.group_id=target and i.token=join_group.token) then
    raise exception 'Invite unavailable' using errcode='P0002';
  end if;
  insert into public.group_members(group_id,user_id) values(target,auth.uid()) on conflict do nothing;
  return target;
end; $$;

create function public.leave_group(group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  select owner_id into owner from public.groups where id=group_id for update;
  if owner is null or not exists(select 1 from public.group_members m where m.group_id=leave_group.group_id and m.user_id=auth.uid()) then raise exception 'Group unavailable' using errcode='P0002'; end if;
  if owner=auth.uid() then raise exception 'Owner must close the group' using errcode='22023'; end if;
  delete from public.group_members m where m.group_id=leave_group.group_id and m.user_id=auth.uid();
end; $$;

create function public.remove_group_member(group_id uuid,member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  select owner_id into owner from public.groups where id=group_id for update;
  if owner is distinct from auth.uid() or not exists(select 1 from public.group_members m where m.group_id=remove_group_member.group_id and m.user_id=auth.uid()) then raise exception 'Group unavailable' using errcode='P0002'; end if;
  if member_id is null or member_id=owner then raise exception 'Cannot remove owner' using errcode='22023'; end if;
  delete from public.group_members m where m.group_id=remove_group_member.group_id and m.user_id=member_id;
  if not found then raise exception 'Group unavailable' using errcode='P0002'; end if;
  update public.group_invites i set token=gen_random_uuid() where i.group_id=remove_group_member.group_id;
end; $$;

create function public.rotate_group_invite(group_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner uuid; new_token uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  select owner_id into owner from public.groups where id=group_id for update;
  if owner is distinct from auth.uid() or not exists(select 1 from public.group_members m where m.group_id=rotate_group_invite.group_id and m.user_id=auth.uid()) then raise exception 'Group unavailable' using errcode='P0002'; end if;
  update public.group_invites i set token=gen_random_uuid() where i.group_id=rotate_group_invite.group_id returning i.token into new_token;
  return new_token;
end; $$;

create function public.close_group(group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  select owner_id into owner from public.groups where id=group_id for update;
  if owner is distinct from auth.uid() or not exists(select 1 from public.group_members m where m.group_id=close_group.group_id and m.user_id=auth.uid()) then raise exception 'Group unavailable' using errcode='P0002'; end if;
  delete from public.groups where id=group_id;
end; $$;

create function public.group_weekly_metrics(group_id uuid,week_start date)
returns table(display_name text,total_r numeric,win_rate numeric,completed_count bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  perform 1 from public.groups where id=group_id for share;
  if not found or not exists(select 1 from public.group_members m where m.group_id=group_weekly_metrics.group_id and m.user_id=auth.uid()) then raise exception 'Group unavailable' using errcode='P0002'; end if;
  if week_start is null or not isfinite(week_start) or extract(isodow from week_start)<>1 then raise exception 'Monday required' using errcode='22023'; end if;
  return query select p.display_name,coalesce(sum(t.r_result),0),
    count(*) filter(where t.r_result>0)::numeric / nullif(count(t.r_result),0),count(t.r_result)
    from public.group_members m join public.profiles p on p.id=m.user_id
    left join public.trades t on t.owner_id=m.user_id and t.opened_at >= (week_start::timestamp at time zone 'UTC')
      and t.opened_at < ((week_start+7)::timestamp at time zone 'UTC') and t.exit_price is not null
    where m.group_id=group_weekly_metrics.group_id group by m.user_id,p.display_name order by p.display_name,m.user_id;
end; $$;

revoke all on function public.create_group(text), public.list_my_groups(), public.get_group_details(uuid), public.join_group(uuid), public.leave_group(uuid), public.remove_group_member(uuid,uuid), public.rotate_group_invite(uuid), public.close_group(uuid), public.group_weekly_metrics(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.create_group(text), public.list_my_groups(), public.get_group_details(uuid), public.join_group(uuid), public.leave_group(uuid), public.remove_group_member(uuid,uuid), public.rotate_group_invite(uuid), public.close_group(uuid), public.group_weekly_metrics(uuid,date) to authenticated;
