begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'profiles', 'username', 'profiles reserve usernames');
insert into auth.users(id,email,raw_user_meta_data) values
  ('70000000-0000-0000-0000-000000000001','alpha@example.test','{"username":"Alpha"}'::jsonb);
select is((select username from public.profiles where id='70000000-0000-0000-0000-000000000001'),'alpha','signup normalizes username');
select is((select display_name from public.profiles where id='70000000-0000-0000-0000-000000000001'),'alpha','signup creates initial display name');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values
  ('70000000-0000-0000-0000-000000000002','second@example.test','{"username":"ALPHA"}'::jsonb)$$,'23505',null,'case-insensitive duplicate rejected');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values
  ('70000000-0000-0000-0000-000000000003','missing@example.test','{}'::jsonb)$$,'22023',null,'missing username rejected');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values
  ('70000000-0000-0000-0000-000000000004','invalid@example.test','{"username":"bad name"}'::jsonb)$$,'22023',null,'invalid username rejected');
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select is((select username from public.profiles),'alpha','owner reads own username');
select throws_ok($$update public.profiles set username='renamed' where id=auth.uid()$$,'23514',null,'username stays reserved');
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000099',true);
select is((select count(*) from public.profiles),0::bigint,'other user cannot read username');

select * from finish();
rollback;
