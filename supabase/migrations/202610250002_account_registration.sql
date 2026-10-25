alter table public.profiles add column username text not null
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$');
alter table public.profiles add constraint profiles_username_unique unique (username);

create function public.keep_profile_username() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.username is distinct from old.username then
    raise exception 'Username cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger keep_profile_username_before_update
before update of username on public.profiles
for each row execute function public.keep_profile_username();

revoke all on function public.keep_profile_username() from public, anon, authenticated;

create function public.create_signup_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare chosen text;
begin
  chosen := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
  if chosen !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Valid username required' using errcode = '22023';
  end if;
  insert into public.profiles (id, username, display_name) values (new.id, chosen, chosen);
  return new;
end;
$$;

create trigger create_signup_profile_after_insert
after insert on auth.users
for each row execute function public.create_signup_profile();

revoke all on function public.create_signup_profile() from public, anon, authenticated;
