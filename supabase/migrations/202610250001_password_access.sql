create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.password_access (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on private.password_access from public, anon, authenticated;

-- OTP signup inserts a temporary password; only a later password update proves user-set access.
create function private.mark_password_access() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.password_access(user_id) values(new.id) on conflict do nothing;
  return new;
end; $$;

create trigger mark_password_access_after_update
after update of encrypted_password on auth.users
for each row when (old.encrypted_password is distinct from new.encrypted_password)
execute function private.mark_password_access();

-- Existing Oneliner accounts signed up by OTP; preserve any prior password updates.
insert into private.password_access(user_id)
select distinct u.id from auth.users u
join auth.audit_log_entries a on a.payload->>'actor_id'=u.id::text
where a.payload->>'action'='user_updated_password'
on conflict do nothing;

create function public.account_has_password() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='28000'; end if;
  return exists(select 1 from private.password_access where user_id=auth.uid());
end; $$;
revoke all on function public.account_has_password() from public, anon;
grant execute on function public.account_has_password() to authenticated;
