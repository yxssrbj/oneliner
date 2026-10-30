begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select has_table('public', 'groups', 'private groups exist');
select has_function('public', 'group_weekly_metrics', array['uuid','date'], 'aggregate RPC exists');
insert into auth.users(id,email,raw_user_meta_data) values
('50000000-0000-0000-0000-000000000001','group-owner@example.test','{"username":"group_owner"}'::jsonb),
('50000000-0000-0000-0000-000000000002','group-member@example.test','{"username":"group_member"}'::jsonb),
('50000000-0000-0000-0000-000000000003','group-outsider@example.test','{"username":"group_outsider"}'::jsonb);
update public.profiles set display_name = 'Owner' where id='50000000-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Member' where id='50000000-0000-0000-0000-000000000002';
delete from public.profiles where id='50000000-0000-0000-0000-000000000003';
create temp table fixture(group_id uuid, token uuid);
grant all on fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.create_group(' ')$$,'22023',null,'blank name rejected');
insert into fixture(group_id) select public.create_group('Friends');
update fixture set token = (public.get_group_details(group_id)->>'inviteToken')::uuid;
select is(jsonb_array_length(public.list_my_groups()),1,'owner lists own group');
select throws_ok($$select * from public.groups$$,'42501',null,'tables deny direct metadata access');
select throws_ok($$select * from public.group_invites$$,'42501',null,'tables deny direct token access');
select throws_ok($$select public.leave_group(group_id) from fixture$$,'22023',null,'owner cannot leave');
select throws_ok($$select public.remove_group_member(group_id,auth.uid()) from fixture$$,'22023',null,'owner cannot remove self');
insert into public.trades(owner_id,original_note,symbol,side,entry_price,stop_price,setup,opened_at,exit_price,idempotency_key) values
(auth.uid(),'secret win','ES','long',100,99,'private','2026-10-19T00:00:00Z',102,gen_random_uuid()),
(auth.uid(),'secret loss','ES','long',100,99,'private','2026-10-20T00:00:00Z',99,gen_random_uuid()),
(auth.uid(),'secret flat','ES','long',100,99,'private','2026-10-21T00:00:00Z',100,gen_random_uuid()),
(auth.uid(),'unfinished','ES','long',100,99,'private','2026-10-22T00:00:00Z',null,gen_random_uuid()),
(auth.uid(),'before UTC week','ES','long',100,99,'private','2026-10-18T23:59:59Z',110,gen_random_uuid()),
(auth.uid(),'next UTC week','ES','long',100,99,'private','2026-10-26T00:00:00Z',110,gen_random_uuid());
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.join_group(token) from fixture$$,'22023',null,'profile required to join');
select throws_ok($$select * from public.group_weekly_metrics((select group_id from fixture),'2026-10-19')$$,'P0002',null,'nonmember cannot read aggregates');
select throws_ok($$select public.get_group_details(group_id) from fixture$$,'P0002',null,'nonmember cannot read details');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select is(public.join_group(token),group_id,'invite joins group') from fixture;
select is(public.join_group(token),group_id,'join is idempotent') from fixture;
select is(public.get_group_details(group_id)->'inviteToken','null'::jsonb,'member cannot retrieve invite') from fixture;
select is((select count(*) from public.trades),0::bigint,'member cannot select owner trades');
select throws_ok($$select public.rename_group(group_id,'Stolen') from fixture$$,'P0002',null,'member cannot rename');
select throws_ok($$select public.rotate_group_invite(group_id) from fixture$$,'P0002',null,'member cannot rotate');
select throws_ok($$select public.close_group(group_id) from fixture$$,'P0002',null,'member cannot close');
select throws_ok($$select public.remove_group_member(group_id,'50000000-0000-0000-0000-000000000001') from fixture$$,'P0002',null,'member cannot remove');
select results_eq($$select display_name,total_r,round(win_rate,4),completed_count from public.group_weekly_metrics((select group_id from fixture),'2026-10-19') order by display_name$$,$$values ('Member'::text,0::numeric,null::numeric,0::bigint),('Owner',1::numeric,0.3333::numeric,3::bigint)$$,'aggregate includes zero results and correct UTC week');
select is((select array_agg(key order by key) from jsonb_object_keys((select to_jsonb(m) from public.group_weekly_metrics((select group_id from fixture),'2026-10-19') m limit 1)) key),array['completed_count','display_name','total_r','win_rate'],'only aggregate columns exposed');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
insert into public.trades(owner_id,symbol,side,entry_price,exit_price,opened_at,idempotency_key,source_key,source_net_pnl_usd,source_quantity,source_payload)
select auth.uid(),'ES','long',100,102,'2026-10-19T12:00:00Z',gen_random_uuid(),'group-import-' || n,pnl,1,'{}'::jsonb
from (values (1,10),(2,-2),(3,0),(4,3),(5,-1),(6,5)) as imports(n,pnl);
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select results_eq($$select total_r,round(win_rate,4),completed_count from public.group_weekly_metrics((select group_id from fixture),'2026-10-19') where display_name='Owner'$$,$$values (null::numeric,0.4444::numeric,9::bigint)$$,'missing risk leaves R unavailable while source outcomes count');
select is((select count(*) from public.trades),0::bigint,'member cannot read imported source rows');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
update public.trades set stop_price=99,setup='ORB' where source_key='group-import-2';
select results_eq($$select total_r,round(win_rate,4),completed_count from public.group_weekly_metrics((select group_id from fixture),'2026-10-19') where display_name='Owner'$$,$$values (null::numeric,0.4444::numeric,9::bigint)$$,'partial risk stays unavailable and edited positive R does not override source loss');
update public.trades set stop_price=99,setup='ORB' where source_key is not null;
select results_eq($$select total_r,round(win_rate,4),completed_count from public.group_weekly_metrics((select group_id from fixture),'2026-10-19') where display_name='Owner'$$,$$values (13::numeric,0.4444::numeric,9::bigint)$$,'complete risk restores total without changing source win rate');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select throws_ok($$select * from public.group_weekly_metrics((select group_id from fixture),'2026-10-20')$$,'22023',null,'week must begin Monday');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.rename_group(group_id,' ') from fixture$$,'22023',null,'blank rename rejected');
select lives_ok($$select public.rename_group(group_id,' New circle ') from fixture$$,'owner renames');
select is((public.get_group_details(group_id)->'group'->>'name'),'New circle','rename appears in details') from fixture;
select lives_ok($$select public.remove_group_member(group_id,'50000000-0000-0000-0000-000000000002') from fixture$$,'owner removes member');
select isnt((public.get_group_details(group_id)->>'inviteToken')::uuid,token,'removal rotates token atomically') from fixture;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.join_group(token) from fixture$$,'P0002',null,'old token cannot rejoin');
select throws_ok($$select * from public.group_weekly_metrics((select group_id from fixture),'2026-10-19')$$,'P0002',null,'removed member loses summary access');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
update fixture set token = public.rotate_group_invite(group_id);
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.join_group(token) from fixture$$,'new invite joins');
select lives_ok($$select public.leave_group(group_id) from fixture$$,'member leaves');
select throws_ok($$select public.get_group_details(group_id) from fixture$$,'P0002',null,'leaving revokes details');
select lives_ok($$select public.join_group(token) from fixture$$,'member can explicitly rejoin active invite');
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.close_group(group_id) from fixture$$,'owner closes');
select is((select count(*) from public.trades),12::bigint,'closing preserves journal');
select throws_ok($$select public.join_group(token) from fixture$$,'P0002',null,'closed invite unavailable');
select throws_ok($$select * from public.group_weekly_metrics((select group_id from fixture),'2026-10-19')$$,'P0002',null,'closed summary unavailable');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.list_my_groups()$$,'28000',null,'null identity rejected directly');
select throws_ok($$select public.create_group('Another')$$,'28000',null,'null identity cannot create');
select throws_ok($$select public.join_group(gen_random_uuid())$$,'28000',null,'null identity cannot join');
select throws_ok($$select public.get_group_details(group_id) from fixture$$,'28000',null,'null identity cannot read details');
select throws_ok($$select public.leave_group(group_id) from fixture$$,'28000',null,'null identity cannot leave');
select throws_ok($$select public.remove_group_member(group_id,gen_random_uuid()) from fixture$$,'28000',null,'null identity cannot remove');
select throws_ok($$select public.rotate_group_invite(group_id) from fixture$$,'28000',null,'null identity cannot rotate');
select throws_ok($$select public.close_group(group_id) from fixture$$,'28000',null,'null identity cannot close');
select throws_ok($$select public.rename_group(group_id,'No') from fixture$$,'28000',null,'null identity cannot rename');
select throws_ok($$select * from public.group_weekly_metrics((select group_id from fixture),'2026-10-19')$$,'28000',null,'null identity cannot read metrics');
reset role;
select ok(not has_function_privilege('anon','public.create_group(text)','EXECUTE'),'anon cannot call RPC');
select ok(not has_function_privilege('anon','public.group_weekly_metrics(uuid,date)','EXECUTE'),'anon cannot call metrics');
select ok(not has_function_privilege('anon','public.rename_group(uuid,text)','EXECUTE'),'anon cannot rename');
select ok(not has_function_privilege('service_role','public.create_group(text)','EXECUTE'),'only authenticated role receives explicit RPC execution');
select ok((select bool_and(p.prosecdef and p.proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_group','list_my_groups','get_group_details','join_group','leave_group','rename_group','remove_group_member','rotate_group_invite','close_group','group_weekly_metrics')),'all RPCs definer with empty search path');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('groups','group_members','group_invites')),'all group tables enforce RLS');
select ok(not has_table_privilege('authenticated','public.group_members','SELECT,INSERT,UPDATE,DELETE'),'memberships deny direct access');
select * from finish();
rollback;
