alter table public.group_messages add column sender_name text;
update public.group_messages msg set sender_name=p.display_name
  from public.profiles p where p.id=msg.sender_id;
alter table public.group_messages alter column sender_name set not null;
alter table public.group_messages alter column sender_id drop not null;
alter table public.group_messages drop constraint group_messages_sender_id_fkey;
alter table public.group_messages add constraint group_messages_sender_id_fkey
  foreign key(sender_id) references public.profiles(id) on delete set null;

create function public.record_group_message_sender() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select p.display_name into new.sender_name from public.profiles p where p.id=new.sender_id;
  if new.sender_name is null then raise exception 'Sender unavailable' using errcode='P0002'; end if;
  return new;
end; $$;
create trigger record_group_message_sender before insert on public.group_messages
for each row execute function public.record_group_message_sender();
revoke all on function public.record_group_message_sender() from public,anon,authenticated,service_role;

create or replace function public.list_group_messages(group_id uuid,before_time timestamptz,before_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  perform 1 from public.groups g where g.id=list_group_messages.group_id for share;
  if not found or not exists(select 1 from public.group_members m where m.group_id=list_group_messages.group_id and m.user_id=auth.uid()) then
    raise exception 'Group unavailable' using errcode='P0002';
  end if;
  if (before_time is null) <> (before_id is null) then raise exception 'Invalid cursor' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',h.id,'senderId',h.sender_id,'displayName',h.display_name,'body',h.body,
    'imageType',h.image_type,'createdAt',h.created_at) order by h.created_at desc,h.id desc)
    from (select msg.id,msg.sender_id,coalesce(p.display_name,msg.sender_name) as display_name,msg.body,msg.image_type,msg.created_at
      from public.group_messages msg left join public.profiles p on p.id=msg.sender_id
      where msg.group_id=list_group_messages.group_id and
        (before_time is null or (msg.created_at,msg.id)<(before_time,before_id))
      order by msg.created_at desc,msg.id desc limit 50) h),'[]'::jsonb);
end; $$;
