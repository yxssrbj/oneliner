create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  image_type text,
  image_bytes bytea,
  created_at timestamptz not null default now(),
  constraint group_message_content check (
    (body is not null or image_bytes is not null) and
    (body is null or (length(body) between 1 and 2000 and body = btrim(body)))
  ),
  constraint group_message_image check (
    (image_type is null and image_bytes is null) or
    (image_type in ('image/jpeg','image/png','image/webp') and image_bytes is not null and octet_length(image_bytes) between 1 and 1048576)
  )
);
create index group_messages_history on public.group_messages(group_id,created_at desc,id desc);
alter table public.group_messages enable row level security;
revoke all on public.group_messages from public,anon,authenticated;

create function public.list_group_messages(group_id uuid,before_time timestamptz,before_id uuid) returns jsonb
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
    from (select msg.id,msg.sender_id,p.display_name,msg.body,msg.image_type,msg.created_at
      from public.group_messages msg join public.profiles p on p.id=msg.sender_id
      where msg.group_id=list_group_messages.group_id and
        (before_time is null or (msg.created_at,msg.id)<(before_time,before_id))
      order by msg.created_at desc,msg.id desc limit 50) h),'[]'::jsonb);
end; $$;

create function public.send_group_message(group_id uuid,message_text text,image_type text,image_bytes bytea) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sent public.group_messages; cleaned text;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  perform 1 from public.groups g where g.id=send_group_message.group_id for share;
  if not found or not exists(select 1 from public.group_members m where m.group_id=send_group_message.group_id and m.user_id=auth.uid()) then
    raise exception 'Group unavailable' using errcode='P0002';
  end if;
  cleaned := nullif(btrim(message_text), '');
  if (cleaned is null and image_bytes is null) or length(cleaned)>2000 or
    ((image_type is null) <> (image_bytes is null)) or
    (image_bytes is not null and (octet_length(image_bytes)>1048576 or
      not case image_type
        when 'image/png' then substring(image_bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')
        when 'image/jpeg' then substring(image_bytes from 1 for 3)=decode('ffd8ff','hex')
        when 'image/webp' then substring(image_bytes from 1 for 4)=decode('52494646','hex') and substring(image_bytes from 9 for 4)=decode('57454250','hex')
        else false end)) then
    raise exception 'Invalid message' using errcode='22023';
  end if;
  insert into public.group_messages(group_id,sender_id,body,image_type,image_bytes)
    values(group_id,auth.uid(),cleaned,image_type,image_bytes) returning * into sent;
  return jsonb_build_object('id',sent.id,'senderId',sent.sender_id,'body',sent.body,
    'imageType',sent.image_type,'createdAt',sent.created_at);
end; $$;

create function public.read_group_image(group_id uuid,message_id uuid)
returns table(content_type text,data_base64 text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  perform 1 from public.groups g where g.id=read_group_image.group_id for share;
  if not found or not exists(select 1 from public.group_members m where m.group_id=read_group_image.group_id and m.user_id=auth.uid()) then
    raise exception 'Group unavailable' using errcode='P0002';
  end if;
  return query select msg.image_type,encode(msg.image_bytes,'base64')
    from public.group_messages msg where msg.group_id=read_group_image.group_id
      and msg.id=message_id and msg.image_bytes is not null;
  if not found then raise exception 'Image unavailable' using errcode='P0002'; end if;
end; $$;

revoke all on function public.list_group_messages(uuid,timestamptz,uuid),public.send_group_message(uuid,text,text,bytea),public.read_group_image(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_group_messages(uuid,timestamptz,uuid),public.send_group_message(uuid,text,text,bytea),public.read_group_image(uuid,uuid) to authenticated;
