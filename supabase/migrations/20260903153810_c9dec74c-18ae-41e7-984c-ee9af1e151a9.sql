alter table public.support_conversations drop constraint support_conversations_user_id_fkey;
alter table public.support_conversations add constraint support_conversations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.support_conversations drop constraint support_conversations_assigned_to_fkey;
alter table public.support_conversations add constraint support_conversations_assigned_to_fkey
  foreign key (assigned_to) references auth.users(id) on delete set null;
alter table public.support_messages drop constraint support_messages_sender_id_fkey;
alter table public.support_messages add constraint support_messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete cascade;

create or replace function public.support_user_info(_user_ids uuid[])
returns table(user_id uuid, full_name text, email text, phone text)
language sql stable security definer set search_path = public as $$
  select u.id,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
         coalesce(p.email, u.email),
         coalesce(p.phone, u.phone)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = any(_user_ids) and public.is_support();
$$;
revoke all on function public.support_user_info(uuid[]) from public, anon;
grant execute on function public.support_user_info(uuid[]) to authenticated, service_role;