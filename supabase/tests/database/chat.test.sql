begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select has_table('public','group_messages','messages table exists');
select has_function('public','list_group_messages',array['uuid','timestamp with time zone','uuid'],'list RPC exists');
insert into auth.users(id,email,raw_user_meta_data) values
('60000000-0000-0000-0000-000000000001','chat-owner@example.test','{"username":"chat_owner"}'::jsonb),
('60000000-0000-0000-0000-000000000002','chat-member@example.test','{"username":"chat_member"}'::jsonb),
('60000000-0000-0000-0000-000000000003','chat-outsider@example.test','{"username":"chat_outsider"}'::jsonb);
create temp table fixture(group_id uuid,token uuid,message_id uuid,member_message_id uuid);
grant all on fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
insert into fixture(group_id) select public.create_group('Chat');
update fixture set token=(public.get_group_details(group_id)->>'inviteToken')::uuid;
select throws_ok($$select * from public.group_messages$$,'42501',null,'direct rows denied');
select throws_ok($$select public.send_group_message(group_id,'',null,null) from fixture$$,'22023',null,'empty send denied');
select throws_ok($$select public.send_group_message(group_id,repeat('x',2001),null,null) from fixture$$,'22023',null,'oversize text denied');
select throws_ok($$select public.send_group_message(group_id,'hi','image/png',decode('00','hex')) from fixture$$,'22023',null,'disguised picture denied');
update fixture set message_id=(public.send_group_message(group_id,'Hello',null,null)->>'id')::uuid;
select is(jsonb_array_length(public.list_group_messages(group_id,null,null)),1,'owner sees sent message') from fixture;
select is(public.list_group_messages(group_id,null,null)->0->>'body','Hello','body is returned') from fixture;
select is(public.list_group_messages(group_id,null,null)->0->>'senderId',auth.uid()::text,'server assigns sender') from fixture;
select throws_ok($$select * from fixture f cross join lateral public.read_group_image(f.group_id,f.message_id)$$,'P0002',null,'text-only message has no image');
update fixture set message_id=(public.send_group_message(group_id,null,'image/png',decode('89504e470d0a1a0a00000000','hex'))->>'id')::uuid;
select is(jsonb_array_length(public.list_group_messages(group_id,null,null)),2,'picture-only message is listed') from fixture;
select is(jsonb_array_length(public.list_group_messages(group_id,
  (public.list_group_messages(group_id,null,null)->0->>'createdAt')::timestamptz,
  (public.list_group_messages(group_id,null,null)->0->>'id')::uuid)),1,'cursor loads older message') from fixture;
select is((select data_base64 from public.read_group_image(group_id,message_id)),encode(decode('89504e470d0a1a0a00000000','hex'),'base64'),'member reads picture bytes') from fixture;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.list_group_messages(group_id,null,null) from fixture$$,'P0002',null,'outsider cannot list');
select throws_ok($$select public.send_group_message(group_id,'intrude',null,null) from fixture$$,'P0002',null,'outsider cannot send');
select throws_ok($$select * from fixture f cross join lateral public.read_group_image(f.group_id,f.message_id)$$,'P0002',null,'outsider cannot read image');
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select public.join_group(token) from fixture;
select is(jsonb_array_length(public.list_group_messages(group_id,null,null)),2,'member sees history') from fixture;
select lives_ok($$update fixture set member_message_id=(public.send_group_message(group_id,'Reply','image/png',decode('89504e470d0a1a0a00000000','hex'))->>'id')::uuid$$,'member can send picture');
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.remove_group_member(group_id,'60000000-0000-0000-0000-000000000002') from fixture$$,'remove member');
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.list_group_messages(group_id,null,null) from fixture$$,'P0002',null,'removed member loses history');
select throws_ok($$select public.send_group_message(group_id,'after removal',null,null) from fixture$$,'P0002',null,'removed member cannot send');
select throws_ok($$select * from fixture f cross join lateral public.read_group_image(f.group_id,f.message_id)$$,'P0002',null,'removed member cannot read bytes');
reset role;
delete from auth.users where id='60000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
select is((select count(*) from jsonb_array_elements(public.list_group_messages(group_id,null,null)) m where m->>'body'='Reply'),1::bigint,'remaining members keep history after sender account deletion') from fixture;
select is((select data_base64 from public.read_group_image(group_id,member_message_id)),encode(decode('89504e470d0a1a0a00000000','hex'),'base64'),'remaining members keep picture after sender account deletion') from fixture;
select lives_ok($$select public.close_group(group_id) from fixture$$,'owner closes group');
reset role;
select is((select count(*) from public.group_messages where sender_id in ('60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002')),0::bigint,'close cascades messages');
select ok(not has_table_privilege('authenticated','public.group_messages','SELECT,INSERT,UPDATE,DELETE'),'no direct table access');
select ok(not has_function_privilege('anon','public.list_group_messages(uuid,timestamptz,uuid)','EXECUTE'),'anonymous list denied');
select * from finish();
rollback;
