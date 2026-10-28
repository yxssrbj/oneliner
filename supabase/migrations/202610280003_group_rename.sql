create function public.rename_group(group_id uuid, new_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  select owner_id into owner from public.groups where id=group_id for update;
  if owner is distinct from auth.uid() or not exists(select 1 from public.group_members m where m.group_id=rename_group.group_id and m.user_id=auth.uid()) then
    raise exception 'Group unavailable' using errcode='P0002';
  end if;
  if new_name is null or length(btrim(new_name,E' \t\n\r\f' || chr(11))) not between 1 and 80 then
    raise exception 'Group name required' using errcode='22023';
  end if;
  update public.groups g set name=btrim(new_name,E' \t\n\r\f' || chr(11)) where g.id=rename_group.group_id;
end; $$;

revoke all on function public.rename_group(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.rename_group(uuid,text) to authenticated;
