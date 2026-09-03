-- ===== Papéis da plataforma (equipe de suporte) =====
create table if not exists public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('support','admin')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.platform_roles to authenticated;
grant all on public.platform_roles to service_role;
alter table public.platform_roles enable row level security;

create or replace function public.is_support()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_roles where user_id = auth.uid() and role in ('support','admin'));
$$;
revoke all on function public.is_support() from public;
grant execute on function public.is_support() to authenticated, service_role;

create policy "read own platform role" on public.platform_roles
  for select to authenticated using (user_id = auth.uid() or public.is_support());

insert into public.platform_roles (user_id, role)
select id, 'support' from auth.users where lower(email) = 'pronavalha@gmail.com'
on conflict do nothing;

-- Suporte pode ver dados básicos das barbearias e perfis
create policy "support reads shops" on public.barbershops
  for select to authenticated using (public.is_support());
create policy "support reads profiles" on public.profiles
  for select to authenticated using (public.is_support());

-- ===== Conversas =====
create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'Ajuda',
  status text not null default 'new' check (status in ('new','open','resolved')),
  urgent boolean not null default false,
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  barber_unread integer not null default 0,
  support_unread integer not null default 0,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_conversations (user_id, last_message_at desc);
create index on public.support_conversations (status, last_message_at desc);
grant select, insert, update on public.support_conversations to authenticated;
grant all on public.support_conversations to service_role;
alter table public.support_conversations enable row level security;

create or replace function public.can_access_conversation(_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_support() or exists (
    select 1 from public.support_conversations c where c.id = _conv and c.user_id = auth.uid());
$$;
revoke all on function public.can_access_conversation(uuid) from public;
grant execute on function public.can_access_conversation(uuid) to authenticated, service_role;

create policy "conv select" on public.support_conversations
  for select to authenticated using (user_id = auth.uid() or public.is_support());
create policy "conv insert own" on public.support_conversations
  for insert to authenticated with check (user_id = auth.uid() and (barbershop_id is null or public.is_member(barbershop_id)));
create policy "conv update" on public.support_conversations
  for update to authenticated using (user_id = auth.uid() or public.is_support())
  with check (user_id = auth.uid() or public.is_support());

create trigger update_support_conversations_updated_at
  before update on public.support_conversations
  for each row execute function public.update_updated_at_column();

-- Barbeiro não pode mexer em campos administrativos
create or replace function public.support_conv_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_support() and auth.uid() is not null then
    new.status := old.status;
    new.urgent := old.urgent;
    new.assigned_to := old.assigned_to;
    new.resolved_at := old.resolved_at;
    new.support_unread := old.support_unread;
    new.user_id := old.user_id;
    new.barbershop_id := old.barbershop_id;
  end if;
  if new.status = 'resolved' and old.status <> 'resolved' then new.resolved_at := now(); end if;
  if new.status <> 'resolved' then new.resolved_at := null; end if;
  return new;
end; $$;
create trigger support_conv_guard before update on public.support_conversations
  for each row execute function public.support_conv_guard();

-- ===== Mensagens =====
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null default 'barber' check (sender_role in ('barber','support')),
  body text not null default '',
  attachment_path text,
  created_at timestamptz not null default now()
);
create index on public.support_messages (conversation_id, created_at);
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;

create policy "msg select" on public.support_messages
  for select to authenticated using (public.can_access_conversation(conversation_id));
create policy "msg insert" on public.support_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.can_access_conversation(conversation_id)
              and (length(body) > 0 or attachment_path is not null));

-- ===== Notificações =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'support',
  title text not null,
  body text,
  link text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read_at, created_at desc);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== Ao enviar mensagem: papel, conversa, contadores e notificações =====
create or replace function public.support_message_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_role := case when public.is_support() then 'support' else 'barber' end;
  new.body := left(coalesce(new.body, ''), 4000);
  return new;
end; $$;
create trigger support_message_before before insert on public.support_messages
  for each row execute function public.support_message_before();

create or replace function public.support_message_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv public.support_conversations; v_shop text; v_preview text; r record;
begin
  select * into v_conv from public.support_conversations where id = new.conversation_id for update;
  v_preview := case when new.body <> '' then left(new.body, 120) else '📎 Imagem' end;
  if new.sender_role = 'barber' then
    update public.support_conversations
       set last_message_at = new.created_at, last_message_preview = v_preview,
           support_unread = support_unread + 1,
           status = case when status = 'resolved' then 'new' else status end
     where id = v_conv.id;
    select name into v_shop from public.barbershops where id = v_conv.barbershop_id;
    for r in select user_id from public.platform_roles where role in ('support','admin') loop
      insert into public.notifications (user_id, type, title, body, link, entity_id)
      values (r.user_id, 'support', coalesce(v_shop, 'Barbearia') || ' enviou uma mensagem', v_preview,
              '/suporte-inbox?c=' || v_conv.id, v_conv.id);
    end loop;
  else
    update public.support_conversations
       set last_message_at = new.created_at, last_message_preview = v_preview,
           barber_unread = barber_unread + 1,
           status = case when status = 'new' then 'open' else status end,
           assigned_to = coalesce(assigned_to, new.sender_id)
     where id = v_conv.id;
    insert into public.notifications (user_id, type, title, body, link, entity_id)
    values (v_conv.user_id, 'support', 'Suporte respondeu', v_preview, '/suporte-chat?c=' || v_conv.id, v_conv.id);
  end if;
  return new;
end; $$;
create trigger support_message_after after insert on public.support_messages
  for each row execute function public.support_message_after();

-- Marcar conversa como lida (zera o contador do lado de quem chama)
create or replace function public.support_mark_read(_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_conversation(_conv) then raise exception 'Sem permissão'; end if;
  if public.is_support() then
    update public.support_conversations set support_unread = 0 where id = _conv;
  else
    update public.support_conversations set barber_unread = 0 where id = _conv and user_id = auth.uid();
  end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and entity_id = _conv and read_at is null;
end; $$;
revoke all on function public.support_mark_read(uuid) from public;
grant execute on function public.support_mark_read(uuid) to authenticated, service_role;

-- Funções de trigger não são chamadas por usuários
revoke all on function public.support_conv_guard() from public, anon, authenticated;
revoke all on function public.support_message_before() from public, anon, authenticated;
revoke all on function public.support_message_after() from public, anon, authenticated;

-- ===== Tempo real =====
alter publication supabase_realtime add table public.support_messages;
alter publication supabase_realtime add table public.support_conversations;
alter publication supabase_realtime add table public.notifications;
alter table public.support_messages replica identity full;
alter table public.support_conversations replica identity full;

-- ===== Anexos (bucket privado) — políticas =====
create policy "support attachments read" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments' and public.can_access_conversation(((storage.foldername(name))[1])::uuid));
create policy "support attachments upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and public.can_access_conversation(((storage.foldername(name))[1])::uuid));