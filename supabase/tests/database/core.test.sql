begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

select has_table('public', 'profiles', 'profiles table exists');
select has_column('public', 'profiles', 'display_name', 'profiles have display names');
select has_table('public', 'trades', 'trades table exists');
select has_column('public', 'trades', 'r_result', 'trades have calculated R');
select has_column('public', 'trades', 'idempotency_key', 'trades have idempotency keys');
select has_column('public', 'trades', 'chart_data', 'trades can store chart data');
select col_type_is('public', 'trades', 'r_result', 'numeric', 'R uses numeric precision');
select columns_are('public', 'profiles', array['id', 'display_name', 'username'], 'profile column shape');
select columns_are('public', 'trades', array['id', 'owner_id', 'original_note', 'symbol', 'side', 'entry_price', 'stop_price', 'setup', 'opened_at', 'exit_price', 'r_result', 'idempotency_key', 'created_at', 'updated_at', 'chart_data', 'source_key', 'source_net_pnl_usd', 'source_quantity', 'source_payload'], 'trade column shape');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'trader-one@example.test', '{"username":"trader_one"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'trader-two@example.test', '{"username":"trader_two"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
update public.profiles set display_name = 'Trader One' where id = auth.uid();
select is((select display_name from public.profiles where id = auth.uid()), 'Trader One', 'owner can read own profile');
select throws_ok($$update public.profiles set display_name = E'\f' where id = auth.uid()$$, '23514', null, 'form-feed-only display name rejected');

insert into public.trades
  (id, owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, exit_price, idempotency_key)
values
  ('10000000-0000-0000-0000-000000000001', auth.uid(), 'long win', 'ES', 'long', 100, 99, 'breakout', now(), 102, '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', auth.uid(), 'short loss', 'ES', 'short', 100, 101, 'breakout', now(), 102, '20000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', auth.uid(), 'breakeven', 'ES', 'long', 100, 99, 'breakout', now(), 100, '20000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004', auth.uid(), 'unfinished', 'ES', 'long', 100, 99, 'breakout', now(), null, '20000000-0000-0000-0000-000000000004');

update public.trades set chart_data = '[{"time":"2026-10-19T09:30:00Z","open":101,"high":104,"low":100,"close":103,"volume":25}]'::jsonb where id = '10000000-0000-0000-0000-000000000001';
select throws_ok($$update public.trades set chart_data = '{}'::jsonb where id = '10000000-0000-0000-0000-000000000001'$$, '23514', null, 'chart data must be an array');
select throws_ok($$update public.trades set chart_data = '[{"time":"2026-10-19T09:30:00Z"}]'::jsonb where id = '10000000-0000-0000-0000-000000000001'$$, '23514', null, 'chart data requires complete bars');
select throws_ok($$update public.trades set chart_data = '[{"time":"2026-10-19T09:30:00Z","open":101,"high":99,"low":100,"close":103,"volume":25}]'::jsonb where id = '10000000-0000-0000-0000-000000000001'$$, '23514', null, 'chart data rejects invalid OHLC geometry');
select throws_ok($$update public.trades set chart_data = '[{"time":"2026-10-19T09:30:00Z","open":101,"high":104,"low":100,"close":103,"volume":25},{"time":"2026-10-19T09:30:00Z","open":101,"high":104,"low":100,"close":103,"volume":25}]'::jsonb where id = '10000000-0000-0000-0000-000000000001'$$, '23514', null, 'chart data rejects duplicate timestamps');

select is((select r_result from public.trades where id = '10000000-0000-0000-0000-000000000001'), 2::numeric, 'long win is 2R');
select is((select r_result from public.trades where id = '10000000-0000-0000-0000-000000000002'), -2::numeric, 'short loss is -2R');
select is((select r_result from public.trades where id = '10000000-0000-0000-0000-000000000003'), 0::numeric, 'breakeven is 0R');
select is((select r_result from public.trades where id = '10000000-0000-0000-0000-000000000004'), null::numeric, 'unfinished trade has no R');

select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 0, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'zero entry rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', -1, 0.5, 'setup', now(), gen_random_uuid())$$, '23514', null, 'negative entry rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 'NaN', 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'NaN entry rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 'Infinity', 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'infinite entry rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 0, 'setup', now(), gen_random_uuid())$$, '23514', null, 'zero stop rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, -1, 'setup', now(), gen_random_uuid())$$, '23514', null, 'negative stop rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 'NaN', 'setup', now(), gen_random_uuid())$$, '23514', null, 'NaN stop rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 'Infinity', 'setup', now(), gen_random_uuid())$$, '23514', null, 'infinite stop rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, exit_price, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, 'setup', now(), 0, gen_random_uuid())$$, '23514', null, 'zero exit rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, exit_price, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, 'setup', now(), -1, gen_random_uuid())$$, '23514', null, 'negative exit rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, exit_price, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, 'setup', now(), 'NaN', gen_random_uuid())$$, '23514', null, 'NaN exit rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, exit_price, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, 'setup', now(), 'Infinity', gen_random_uuid())$$, '23514', null, 'infinite exit rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 100, 'setup', now(), gen_random_uuid())$$, '23514', null, 'long stop at entry rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'short', 100, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'short stop below entry rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), ' ', 'ES', 'long', 100, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'blank note rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), E'\f', 'ES', 'long', 100, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'form-feed-only note rejected');
select lives_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'v', 'ES', 'long', 100, 99, 'setup', now(), gen_random_uuid())$$, 'letter v is valid note content');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', ' ', 'long', 100, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'blank symbol rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', chr(11), 'long', 100, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'vertical-tab-only symbol rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, ' ', now(), gen_random_uuid())$$, '23514', null, 'blank setup rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, E'\f' || chr(11), now(), gen_random_uuid())$$, '23514', null, 'form-feed-and-vertical-tab-only setup rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'flat', 100, 99, 'setup', now(), gen_random_uuid())$$, '23514', null, 'invalid side rejected');
select throws_ok($$insert into public.trades (owner_id, original_note, symbol, side, entry_price, stop_price, setup, opened_at, idempotency_key) values (auth.uid(), 'note', 'ES', 'long', 100, 99, 'setup', now(), '20000000-0000-0000-0000-000000000001')$$, '23505', null, 'duplicate owner idempotency key rejected');
select throws_ok($$update public.trades set owner_id = '00000000-0000-0000-0000-000000000002' where id = '10000000-0000-0000-0000-000000000001'$$, '23514', null, 'owner cannot be changed');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 0::bigint, 'second user cannot read first profile');
with changed as (update public.profiles set display_name = 'stolen' where id = '00000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed), 0::bigint, 'second user cannot update first profile');
select is((select count(*) from public.trades), 0::bigint, 'second user cannot read first user trades');
select is((select count(*) from public.trades where chart_data is not null), 0::bigint, 'second user cannot read first user chart data');
with changed as (update public.trades set original_note = 'stolen' where id = '10000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed), 0::bigint, 'second user cannot update first user trade');
with changed as (update public.trades set chart_data = null where id = '10000000-0000-0000-0000-000000000001' returning id)
select is((select count(*) from changed), 0::bigint, 'second user cannot update first user chart data');

select * from finish();
rollback;
