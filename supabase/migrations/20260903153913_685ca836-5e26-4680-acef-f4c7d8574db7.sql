create or replace function public.support_conv_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('navalha.support_system', true), '') <> '1'
     and not public.is_support() and auth.uid() is not null then
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

create or replace function public.support_message_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv public.support_conversations; v_shop text; v_preview text; r record;
begin
  perform set_config('navalha.support_system', '1', true);
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
  perform set_config('navalha.support_system', '0', true);
  return new;
end; $$;