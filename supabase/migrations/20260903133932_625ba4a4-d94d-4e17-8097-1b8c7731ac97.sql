-- =====================================================================
-- COBRANÇA POR ATENDIMENTO (plataforma Navalha Pro)
-- =====================================================================
create extension if not exists pg_cron;

-- ---------- configurações da plataforma ----------
create table public.billing_settings (
  id boolean primary key default true check (id),
  unit_price_cents integer not null default 20,
  free_quota integer not null default 250,
  cycle_days integer not null default 30,
  payment_days integer not null default 5,
  pending_days integer not null default 5,
  pix_key text,
  pix_key_type text,
  pix_holder_name text,
  updated_at timestamptz not null default now()
);
grant all on public.billing_settings to service_role;
alter table public.billing_settings enable row level security;
create policy "billing_settings_service_only" on public.billing_settings
  for all to service_role using (true) with check (true);
insert into public.billing_settings (id) values (true);

-- ---------- conta de cobrança por barbearia ----------
create table public.billing_accounts (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  free_quota integer not null default 250,
  free_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.billing_accounts to authenticated;
grant all on public.billing_accounts to service_role;
alter table public.billing_accounts enable row level security;
create policy "billing_accounts_member_read" on public.billing_accounts
  for select to authenticated using (public.is_member(barbershop_id));
create trigger update_billing_accounts_updated_at before update on public.billing_accounts
  for each row execute function public.update_updated_at_column();

-- ---------- ciclos de 30 dias ----------
create table public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  billed_count integer not null default 0,
  amount_cents integer not null default 0,
  unit_price_cents integer not null default 20,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_cycles_shop_idx on public.billing_cycles (barbershop_id, status);
grant select on public.billing_cycles to authenticated;
grant all on public.billing_cycles to service_role;
alter table public.billing_cycles enable row level security;
create policy "billing_cycles_member_read" on public.billing_cycles
  for select to authenticated using (public.is_member(barbershop_id));
create trigger update_billing_cycles_updated_at before update on public.billing_cycles
  for each row execute function public.update_updated_at_column();

-- ---------- registro por atendimento concluído ----------
create table public.billing_usages (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  cycle_id uuid references public.billing_cycles(id) on delete set null,
  is_free boolean not null default true,
  unit_price_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index billing_usages_shop_idx on public.billing_usages (barbershop_id, created_at);
grant select on public.billing_usages to authenticated;
grant all on public.billing_usages to service_role;
alter table public.billing_usages enable row level security;
create policy "billing_usages_member_read" on public.billing_usages
  for select to authenticated using (public.is_member(barbershop_id));

-- ---------- cobranças ----------
create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  cycle_id uuid references public.billing_cycles(id) on delete set null,
  amount_cents integer not null,
  appointments_count integer not null default 0,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  suspend_at date not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  pix_txid text not null unique,
  paid_at timestamptz,
  paid_amount_cents integer,
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_invoices_shop_idx on public.billing_invoices (barbershop_id, status);
grant select on public.billing_invoices to authenticated;
grant all on public.billing_invoices to service_role;
alter table public.billing_invoices enable row level security;
create policy "billing_invoices_member_read" on public.billing_invoices
  for select to authenticated using (public.is_member(barbershop_id));
create trigger update_billing_invoices_updated_at before update on public.billing_invoices
  for each row execute function public.update_updated_at_column();

-- ---------- eventos de webhook (idempotência) ----------
create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  payload jsonb,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  result text,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
grant all on public.billing_webhook_events to service_role;
alter table public.billing_webhook_events enable row level security;
create policy "billing_webhook_events_service_only" on public.billing_webhook_events
  for all to service_role using (true) with check (true);

-- =====================================================================
-- FUNÇÕES
-- =====================================================================

-- Status da conta derivado das cobranças em aberto (sem depender de cron).
create or replace function public.billing_account_status(_shop uuid)
returns text
language sql stable security definer set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.billing_invoices i
                 where i.barbershop_id = _shop and i.status = 'pending' and i.suspend_at <= current_date)
      then 'suspended'
    when exists (select 1 from public.billing_invoices i
                 where i.barbershop_id = _shop and i.status = 'pending' and i.due_date < current_date)
      then 'pending'
    else 'active' end;
$$;

create or replace function public.billing_is_suspended(_shop uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$ select public.billing_account_status(_shop) = 'suspended'; $$;

-- Garante a conta de cobrança da barbearia.
create or replace function public.billing_ensure_account(_shop uuid)
returns public.billing_accounts
language plpgsql security definer set search_path to 'public'
as $$
declare v_acc public.billing_accounts; v_cfg public.billing_settings;
begin
  select * into v_acc from public.billing_accounts where barbershop_id = _shop;
  if v_acc is null then
    select * into v_cfg from public.billing_settings where id;
    insert into public.billing_accounts (barbershop_id, free_quota)
    values (_shop, coalesce(v_cfg.free_quota, 250))
    on conflict (barbershop_id) do nothing;
    select * into v_acc from public.billing_accounts where barbershop_id = _shop;
  end if;
  return v_acc;
end;
$$;

-- Fecha ciclos vencidos de uma barbearia (ou de todas) e gera as cobranças.
create or replace function public.billing_close_due_cycles(_shop uuid default null)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_cycle public.billing_cycles; v_cfg public.billing_settings; v_n int := 0; v_txid text;
begin
  select * into v_cfg from public.billing_settings where id;
  for v_cycle in
    select * from public.billing_cycles
    where status = 'open' and period_end <= current_date
      and (_shop is null or barbershop_id = _shop)
    for update
  loop
    update public.billing_cycles set status = 'closed' where id = v_cycle.id;
    if v_cycle.amount_cents > 0 then
      v_txid := 'NP' || upper(replace(v_cycle.id::text, '-', ''));
      v_txid := left(v_txid, 25);
      insert into public.billing_invoices
        (barbershop_id, cycle_id, amount_cents, appointments_count, period_start, period_end,
         due_date, suspend_at, pix_txid)
      values
        (v_cycle.barbershop_id, v_cycle.id, v_cycle.amount_cents, v_cycle.billed_count,
         v_cycle.period_start, v_cycle.period_end,
         v_cycle.period_end + (coalesce(v_cfg.payment_days, 5) - 1),
         v_cycle.period_end + (coalesce(v_cfg.payment_days, 5) - 1) + coalesce(v_cfg.pending_days, 5) + 1,
         v_txid)
      on conflict (pix_txid) do nothing;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Tarefa diária (pg_cron).
create or replace function public.billing_run_daily()
returns void
language sql security definer set search_path to 'public'
as $$ select public.billing_close_due_cycles(null); $$;

revoke all on function public.billing_run_daily() from public, anon, authenticated;
revoke all on function public.billing_close_due_cycles(uuid) from public, anon, authenticated;
revoke all on function public.billing_ensure_account(uuid) from public, anon, authenticated;

-- Registra/reverte o uso quando um atendimento é concluído (ou desfeito).
create or replace function public.billing_register_usage()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_acc public.billing_accounts;
  v_cfg public.billing_settings;
  v_cycle public.billing_cycles;
  v_usage public.billing_usages;
begin
  -- Concluído agora
  if new.status = 'done' and old.status is distinct from 'done' then
    if exists (select 1 from public.billing_usages where appointment_id = new.id) then return new; end if;
    v_acc := public.billing_ensure_account(new.barbershop_id);
    select * into v_cfg from public.billing_settings where id;

    if v_acc.free_used < v_acc.free_quota then
      insert into public.billing_usages (barbershop_id, appointment_id, is_free, unit_price_cents)
      values (new.barbershop_id, new.id, true, 0);
      update public.billing_accounts set free_used = free_used + 1 where barbershop_id = new.barbershop_id;
    else
      -- fecha ciclo vencido antes de abrir outro
      perform public.billing_close_due_cycles(new.barbershop_id);
      select * into v_cycle from public.billing_cycles
        where barbershop_id = new.barbershop_id and status = 'open'
        order by period_start desc limit 1 for update;
      if v_cycle is null then
        insert into public.billing_cycles (barbershop_id, period_start, period_end, unit_price_cents)
        values (new.barbershop_id, current_date,
                current_date + coalesce(v_cfg.cycle_days, 30), coalesce(v_cfg.unit_price_cents, 20))
        returning * into v_cycle;
      end if;
      insert into public.billing_usages (barbershop_id, appointment_id, cycle_id, is_free, unit_price_cents)
      values (new.barbershop_id, new.id, v_cycle.id, false, v_cycle.unit_price_cents);
      update public.billing_cycles
         set billed_count = billed_count + 1, amount_cents = amount_cents + v_cycle.unit_price_cents
       where id = v_cycle.id;
    end if;

  -- Conclusão desfeita (ex.: marcado como concluído por engano)
  elsif old.status = 'done' and new.status is distinct from 'done' then
    select * into v_usage from public.billing_usages where appointment_id = old.id;
    if v_usage is null then return new; end if;
    if v_usage.is_free then
      delete from public.billing_usages where id = v_usage.id;
      update public.billing_accounts set free_used = greatest(0, free_used - 1)
       where barbershop_id = old.barbershop_id;
    else
      select * into v_cycle from public.billing_cycles where id = v_usage.cycle_id for update;
      if v_cycle is not null and v_cycle.status = 'open' then
        delete from public.billing_usages where id = v_usage.id;
        update public.billing_cycles
           set billed_count = greatest(0, billed_count - 1),
               amount_cents = greatest(0, amount_cents - v_usage.unit_price_cents)
         where id = v_cycle.id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger appointments_billing_usage
  after update of status on public.appointments
  for each row execute function public.billing_register_usage();

-- Bloqueio de funções administrativas quando a conta está suspensa.
create or replace function public.billing_block_when_suspended()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare v_shop uuid;
begin
  -- Operações do próprio sistema (servidor/webhook/exclusão de conta) não são bloqueadas.
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'barbershops' then
    v_shop := coalesce(new.id, old.id);
  else
    v_shop := coalesce(new.barbershop_id, old.barbershop_id);
  end if;
  if v_shop is not null and public.billing_is_suspended(v_shop) then
    raise exception 'Conta suspensa por cobrança pendente. Regularize o pagamento para continuar.';
  end if;
  return coalesce(new, old);
end;
$$;

-- Novos agendamentos bloqueados; os existentes podem ser concluídos/cancelados.
create trigger billing_block_appointments before insert on public.appointments
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_services before insert or update or delete on public.services
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_barbers before insert or update or delete on public.barbers
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_plans before insert or update or delete on public.subscription_plans
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_subscriptions before insert or update or delete on public.customer_subscriptions
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_hours before insert or update or delete on public.business_hours
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_breaks before insert or update or delete on public.schedule_breaks
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_campaigns before insert or update or delete on public.campaigns
  for each row execute function public.billing_block_when_suspended();
create trigger billing_block_rewards before insert or update or delete on public.loyalty_rewards
  for each row execute function public.billing_block_when_suspended();

-- Confirmação de pagamento (somente servidor). Reativa a conta automaticamente,
-- pois o status é derivado das cobranças em aberto.
create or replace function public.billing_mark_invoice_paid(
  _txid text, _amount_cents integer default null, _provider text default 'manual',
  _reference text default null, _external_id text default null, _payload jsonb default null)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_inv public.billing_invoices; v_ext text;
begin
  v_ext := coalesce(_external_id, _reference, _txid);
  if exists (select 1 from public.billing_webhook_events where provider = _provider and external_id = v_ext) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;

  select * into v_inv from public.billing_invoices where pix_txid = upper(_txid) for update;
  if v_inv is null then
    insert into public.billing_webhook_events (provider, external_id, payload, result)
    values (_provider, v_ext, _payload, 'invoice_not_found');
    return json_build_object('ok', false, 'error', 'invoice_not_found');
  end if;
  if v_inv.status = 'paid' then
    insert into public.billing_webhook_events (provider, external_id, payload, invoice_id, result)
    values (_provider, v_ext, _payload, v_inv.id, 'already_paid');
    return json_build_object('ok', true, 'already_paid', true, 'invoice_id', v_inv.id);
  end if;
  if _amount_cents is not null and _amount_cents < v_inv.amount_cents then
    insert into public.billing_webhook_events (provider, external_id, payload, invoice_id, result)
    values (_provider, v_ext, _payload, v_inv.id, 'amount_mismatch');
    return json_build_object('ok', false, 'error', 'amount_mismatch', 'expected', v_inv.amount_cents);
  end if;

  update public.billing_invoices
     set status = 'paid', paid_at = now(), paid_amount_cents = coalesce(_amount_cents, amount_cents),
         payment_provider = _provider, payment_reference = _reference
   where id = v_inv.id;

  insert into public.billing_webhook_events (provider, external_id, payload, invoice_id, result)
  values (_provider, v_ext, _payload, v_inv.id, 'paid');

  insert into public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  values (v_inv.barbershop_id, null, 'billing.invoice_paid', 'billing_invoices', v_inv.id,
          json_build_object('provider', _provider, 'reference', _reference, 'amount_cents', coalesce(_amount_cents, v_inv.amount_cents))::jsonb);

  return json_build_object('ok', true, 'invoice_id', v_inv.id, 'barbershop_id', v_inv.barbershop_id);
end;
$$;
revoke all on function public.billing_mark_invoice_paid(text, integer, text, text, text, jsonb) from public, anon, authenticated;

-- Visão geral para o painel do barbeiro (somente membros).
create or replace function public.my_billing_overview(_shop uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_acc public.billing_accounts; v_cfg public.billing_settings; v_cycle public.billing_cycles;
  v_open public.billing_invoices; v_status text; v_billed_total int; v_billed_amount int;
begin
  if not public.is_member(_shop) then raise exception 'Sem permissão'; end if;
  perform public.billing_close_due_cycles(_shop);
  v_acc := public.billing_ensure_account(_shop);
  select * into v_cfg from public.billing_settings where id;
  select * into v_cycle from public.billing_cycles
    where barbershop_id = _shop and status = 'open' order by period_start desc limit 1;
  select * into v_open from public.billing_invoices
    where barbershop_id = _shop and status = 'pending' order by due_date asc limit 1;
  v_status := public.billing_account_status(_shop);
  select count(*), coalesce(sum(unit_price_cents), 0) into v_billed_total, v_billed_amount
    from public.billing_usages where barbershop_id = _shop and not is_free;

  return json_build_object(
    'status', v_status,
    'free_quota', v_acc.free_quota,
    'free_used', v_acc.free_used,
    'free_left', greatest(0, v_acc.free_quota - v_acc.free_used),
    'unit_price_cents', coalesce(v_cfg.unit_price_cents, 20),
    'cycle_days', coalesce(v_cfg.cycle_days, 30),
    'payment_days', coalesce(v_cfg.payment_days, 5),
    'pending_days', coalesce(v_cfg.pending_days, 5),
    'billed_total', v_billed_total,
    'billed_amount_cents', v_billed_amount,
    'cycle', case when v_cycle is null then null else json_build_object(
      'id', v_cycle.id, 'period_start', v_cycle.period_start, 'period_end', v_cycle.period_end,
      'billed_count', v_cycle.billed_count, 'amount_cents', v_cycle.amount_cents) end,
    'open_invoice', case when v_open is null then null else json_build_object(
      'id', v_open.id, 'amount_cents', v_open.amount_cents, 'appointments_count', v_open.appointments_count,
      'period_start', v_open.period_start, 'period_end', v_open.period_end,
      'due_date', v_open.due_date, 'suspend_at', v_open.suspend_at, 'pix_txid', v_open.pix_txid) end,
    'platform_pix', case when coalesce(v_cfg.pix_key, '') = '' then null else json_build_object(
      'key', v_cfg.pix_key, 'key_type', v_cfg.pix_key_type, 'holder_name', v_cfg.pix_holder_name) end
  );
end;
$$;
grant execute on function public.my_billing_overview(uuid) to authenticated;

-- Bloqueio de novos agendamentos online quando a conta está suspensa.
create or replace function public.book_appointment(_slug text, _service_id uuid, _barber_id uuid, _starts_at timestamp with time zone, _name text, _phone text, _cpf text DEFAULT NULL::text, _payment_method text DEFAULT 'on_site'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shop public.barbershops;
  v_service public.services;
  v_customer_id uuid;
  v_end timestamptz;
  v_id uuid;
  v_dow int;
  v_day date;
  v_start_t time;
  v_end_t time;
  v_hours public.business_hours;
  v_cpf text;
  v_method text;
  v_sub_id uuid;
  v_use_benefit boolean := false;
  v_elig json;
  v_item json;
begin
  select * into v_shop from public.barbershops where slug = _slug;
  if v_shop is null then raise exception 'Barbearia não encontrada'; end if;
  if public.billing_is_suspended(v_shop.id) then
    raise exception 'Esta barbearia está temporariamente indisponível para novos agendamentos';
  end if;
  select * into v_service from public.services where id = _service_id and barbershop_id = v_shop.id and active;
  if v_service is null then raise exception 'Serviço inválido'; end if;
  if length(coalesce(_name,'')) < 2 or length(coalesce(_phone,'')) < 8 then
    raise exception 'Nome e telefone obrigatórios';
  end if;

  v_cpf := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  if length(v_cpf) <> 11 then raise exception 'CPF inválido'; end if;

  if _payment_method = 'plan' then
    v_elig := public.public_plan_eligibility(_slug, v_cpf, array[_service_id]);
    for v_item in select * from json_array_elements(coalesce(v_elig->'services', '[]'::json)) loop
      if (v_item->>'service_id')::uuid = _service_id and (v_item->>'covered')::boolean then
        v_use_benefit := true;
      end if;
    end loop;
    if not v_use_benefit then raise exception 'Este serviço não está incluso no seu plano ou você não tem créditos disponíveis'; end if;
    select id into v_sub_id from public.customer_subscriptions cs
      where cs.barbershop_id = v_shop.id and cs.status = 'active'
        and cs.customer_id = (select id from public.customers where barbershop_id = v_shop.id and cpf = v_cpf limit 1)
      order by created_at desc limit 1;
    v_method := 'subscription';
  else
    v_method := case when _payment_method in ('pix','pix_qr') and coalesce(v_shop.pix_key,'') <> '' then _payment_method else 'on_site' end;
  end if;

  if _starts_at < now() then raise exception 'Horário no passado'; end if;

  v_end := _starts_at + make_interval(mins => v_service.duration_min);
  v_dow := extract(dow from _starts_at)::int;
  v_day := _starts_at::date;
  v_start_t := _starts_at::time;
  v_end_t := v_end::time;

  select * into v_hours from public.business_hours
    where barbershop_id = v_shop.id and weekday = v_dow;
  if v_hours is not null then
    if v_hours.closed then raise exception 'Barbearia fechada neste dia'; end if;
    if v_start_t < v_hours.open_time or v_end_t > v_hours.close_time then
      raise exception 'Fora do horário de funcionamento';
    end if;
  end if;

  if exists (
    select 1 from public.schedule_breaks b
    where b.barbershop_id = v_shop.id
      and (b.barber_id is null or b.barber_id = _barber_id)
      and (
        (b.specific_date is not null and b.specific_date = v_day)
        or (b.specific_date is null and v_dow = any(b.weekdays))
      )
      and v_start_t < b.end_time and v_end_t > b.start_time
  ) then raise exception 'Horário bloqueado'; end if;

  if exists (
    select 1 from public.appointments a
    where a.barbershop_id = v_shop.id and a.barber_id = _barber_id
      and a.status in ('scheduled','confirmed')
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(_starts_at, v_end)
  ) then raise exception 'Horário indisponível'; end if;

  select id into v_customer_id from public.customers
    where barbershop_id = v_shop.id and (cpf = v_cpf or phone = _phone) limit 1;
  if v_customer_id is null then
    insert into public.customers (barbershop_id, name, phone, cpf)
    values (v_shop.id, left(_name, 80), _phone, v_cpf) returning id into v_customer_id;
  else
    update public.customers set cpf = v_cpf where id = v_customer_id and cpf is distinct from v_cpf;
  end if;

  insert into public.appointments (barbershop_id, barber_id, service_id, customer_id, customer_name, customer_phone, customer_cpf, starts_at, ends_at, price_cents, source, payment_method, payment_state, subscription_id, use_benefit, benefit_kind, benefit_processed)
  values (v_shop.id, _barber_id, _service_id, v_customer_id, left(_name,80), _phone, v_cpf, _starts_at, v_end, v_service.price_cents, 'online', v_method, 'pending', v_sub_id, v_use_benefit, case when v_use_benefit then v_service.benefit_kind end, false)
  returning id into v_id;

  update public.customers set points = points + greatest(0, v_service.price_cents / 1000) where id = v_customer_id;

  return json_build_object('id', v_id, 'starts_at', _starts_at, 'ends_at', v_end, 'payment_method', v_method, 'use_benefit', v_use_benefit);
end;
$function$;

-- Status público da barbearia (usado na página de agendamento do cliente).
create or replace function public.public_shop_accepting(_slug text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select not public.billing_is_suspended(b.id) from public.barbershops b where b.slug = _slug;
$$;
grant execute on function public.public_shop_accepting(text) to anon, authenticated;

-- Contas de cobrança para barbearias já existentes.
insert into public.billing_accounts (barbershop_id)
select id from public.barbershops on conflict do nothing;

-- Tarefa diária: fecha ciclos vencidos e gera cobranças (06:00 UTC = 03:00 Brasília).
select cron.schedule('billing-daily-close', '0 6 * * *', $$select public.billing_run_daily();$$);