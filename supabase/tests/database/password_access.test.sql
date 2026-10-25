begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email,encrypted_password) values
('60000000-0000-0000-0000-000000000001','otp-only@example.test','temporary-secret'),
('60000000-0000-0000-0000-000000000002','other@example.test','temporary-secret');

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
select is(public.account_has_password(),false,'OTP signup temporary password is not user-set');
select throws_ok($$select * from private.password_access$$,'42501',null,'marker table is private');

reset role;
set local role anon;
select throws_ok($$select public.account_has_password()$$,'42501',null,'anonymous callers cannot read capability');
reset role;
update auth.users set encrypted_password='chosen-secret' where id='60000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(public.account_has_password(),true,'password update marks the account atomically');
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select is(public.account_has_password(),false,'another account cannot inherit the marker');
select * from finish();
rollback;
