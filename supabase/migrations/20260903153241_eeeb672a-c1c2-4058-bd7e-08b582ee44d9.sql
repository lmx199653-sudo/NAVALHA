create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  if lower(coalesce(new.email, '')) = 'pronavalha@gmail.com' then
    insert into public.platform_roles (user_id, role) values (new.id, 'support') on conflict do nothing;
  end if;
  return new;
end;
$function$;