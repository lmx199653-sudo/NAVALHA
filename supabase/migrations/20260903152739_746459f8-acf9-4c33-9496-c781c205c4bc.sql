-- 1) Visão pública sem campos sensíveis
create or replace view public.public_barbershops
with (security_invoker = false) as
  select id, name, slug, description, address, phone, whatsapp, instagram,
         logo_url, cover_url, accent_color, secondary_color, bg_color, font_family,
         brand_style, brand_symbol, template, onboarding_done, created_at,
         (coalesce(pix_key, '') <> '') as has_pix
  from public.barbershops;

revoke all on public.public_barbershops from public;
grant select on public.public_barbershops to anon, authenticated, service_role;

-- 2) Dados Pix por slug (só o necessário para o cliente pagar)
create or replace function public.public_shop_pix(_slug text)
returns table(pix_key text, pix_key_type text, pix_holder_name text)
language sql stable security definer set search_path = public as $$
  select b.pix_key, b.pix_key_type, b.pix_holder_name
  from public.barbershops b
  where b.slug = _slug and coalesce(b.pix_key, '') <> '';
$$;
revoke all on function public.public_shop_pix(text) from public;
grant execute on function public.public_shop_pix(text) to anon, authenticated, service_role;

-- 3) Tabela base: leitura apenas para dono/equipe
drop policy if exists "public read shops" on public.barbershops;
create policy "members read shop" on public.barbershops
  for select to authenticated using (public.is_member(id));

-- 4) Funções internas: revogar execução de anon/authenticated
revoke execute on function public.my_billing_overview(uuid) from anon;
revoke execute on function public.is_member(uuid) from anon, authenticated;
revoke execute on function public.is_shop_admin(uuid) from anon, authenticated;
revoke execute on function public.ensure_subscription_cycle(uuid) from anon, authenticated;
revoke execute on function public.billing_account_status(uuid) from anon, authenticated;
revoke execute on function public.billing_is_suspended(uuid) from anon, authenticated;
revoke execute on function public.billing_close_due_cycles(uuid) from anon, authenticated;
revoke execute on function public.billing_ensure_account(uuid) from anon, authenticated;
revoke execute on function public.billing_mark_invoice_paid(text, integer, text, text, text, jsonb) from anon, authenticated;
revoke execute on function public.billing_run_daily() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.billing_register_usage() from anon, authenticated;
revoke execute on function public.billing_block_when_suspended() from anon, authenticated;