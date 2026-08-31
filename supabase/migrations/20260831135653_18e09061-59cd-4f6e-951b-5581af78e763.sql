-- ============ ENUMS ============
create type public.payment_type as enum ('subscription','usage_fee','customer_service');
create type public.payment_state as enum ('pending','approved','authorized','in_process','rejected','cancelled','refunded','charged_back');
create type public.usage_fee_status as enum ('pending','billed','paid','cancelled');
create type public.platform_subscription_status as enum ('active','pending','paused','cancelled','expired','rejected');

-- ============ PLANOS ============
create table public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  monthly_price numeric(10,2) not null default 0.00,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.platform_plans to anon, authenticated;
grant all on public.platform_plans to service_role;
alter table public.platform_plans enable row level security;
create policy "platform_plans_public_read" on public.platform_plans
  for select to anon, authenticated using (active);

create trigger update_platform_plans_updated_at before update on public.platform_plans
  for each row execute function public.update_updated_at_column();

insert into public.platform_plans (name, description, monthly_price, sort_order) values
  ('Plano Básico', 'Agenda, clientes e serviços essenciais.', 0.00, 1),
  ('Plano Profissional', 'Agenda completa, assinaturas de clientes e financeiro.', 0.00, 2),
  ('Plano Premium', 'Todos os recursos, marketing e pagamentos online.', 0.00, 3);

-- ============ CONFIGURAÇÕES ============
create table public.platform_settings (
  id boolean primary key default true,
  usage_fee_amount numeric(10,2) not null default 0.20,
  marketplace_fee_percentage numeric(5,2) not null default 0.00,
  marketplace_fee_fixed numeric(10,2) not null default 0.00,
  pending_balance_warning numeric(10,2) not null default 20.00,
  payment_due_days integer not null default 7,
  tolerance_days integer not null default 5,
  block_when_overdue boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_single_row check (id)
);
grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "platform_settings_read" on public.platform_settings
  for select to authenticated using (true);
create trigger update_platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.update_updated_at_column();
insert into public.platform_settings (id) values (true);

-- ============ PAGAMENTOS ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  type public.payment_type not null,
  amount numeric(10,2) not null,
  currency text not null default 'BRL',
  mercado_pago_payment_id text,
  mercado_pago_preference_id text,
  mercado_pago_subscription_id text,
  status public.payment_state not null default 'pending',
  payment_method text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments_member_read" on public.payments
  for select to authenticated using (public.is_member(barbershop_id));
create unique index payments_mp_payment_id_key on public.payments (mercado_pago_payment_id)
  where mercado_pago_payment_id is not null;
create index payments_shop_idx on public.payments (barbershop_id, created_at desc);
create index payments_type_status_idx on public.payments (type, status);
create index payments_appointment_idx on public.payments (appointment_id);
create trigger update_payments_updated_at before update on public.payments
  for each row execute function public.update_updated_at_column();

-- ============ ASSINATURA DA PLATAFORMA ============
create table public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null unique references public.barbershops(id) on delete cascade,
  plan_id uuid references public.platform_plans(id),
  status public.platform_subscription_status not null default 'pending',
  price_amount numeric(10,2) not null default 0.00,
  mercado_pago_user_id text,
  mercado_pago_subscription_id text,
  mercado_pago_preference_id text,
  subscription_start_date timestamptz,
  subscription_next_billing_date timestamptz,
  subscription_end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.platform_subscriptions to authenticated;
grant all on public.platform_subscriptions to service_role;
alter table public.platform_subscriptions enable row level security;
create policy "platform_subscriptions_member_read" on public.platform_subscriptions
  for select to authenticated using (public.is_member(barbershop_id));
create unique index platform_subscriptions_mp_sub_key on public.platform_subscriptions (mercado_pago_subscription_id)
  where mercado_pago_subscription_id is not null;
create trigger update_platform_subscriptions_updated_at before update on public.platform_subscriptions
  for each row execute function public.update_updated_at_column();

-- ============ TAXAS DE USO ============
create table public.usage_fees (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete set null,
  amount numeric(10,2) not null default 0.20,
  status public.usage_fee_status not null default 'pending',
  payment_id uuid references public.payments(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.usage_fees to authenticated;
grant all on public.usage_fees to service_role;
alter table public.usage_fees enable row level security;
create policy "usage_fees_member_read" on public.usage_fees
  for select to authenticated using (public.is_member(barbershop_id));
create unique index usage_fees_appointment_key on public.usage_fees (appointment_id);
create index usage_fees_shop_status_idx on public.usage_fees (barbershop_id, status);
create index usage_fees_created_idx on public.usage_fees (created_at desc);
create index usage_fees_payment_idx on public.usage_fees (payment_id);
create trigger update_usage_fees_updated_at before update on public.usage_fees
  for each row execute function public.update_updated_at_column();

-- ============ CONTAS MERCADO PAGO ============
create table public.mercado_pago_accounts (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null unique references public.barbershops(id) on delete cascade,
  mp_user_id text,
  access_token text,
  refresh_token text,
  public_key text,
  expires_at timestamptz,
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Tokens ficam acessíveis somente ao servidor: nenhum grant para anon/authenticated.
grant all on public.mercado_pago_accounts to service_role;
alter table public.mercado_pago_accounts enable row level security;
create trigger update_mercado_pago_accounts_updated_at before update on public.mercado_pago_accounts
  for each row execute function public.update_updated_at_column();

-- Status da conexão sem expor tokens
create or replace function public.mercado_pago_status(_shop uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_acc public.mercado_pago_accounts;
begin
  if not public.is_member(_shop) then raise exception 'Sem permissão'; end if;
  select * into v_acc from public.mercado_pago_accounts where barbershop_id = _shop;
  if v_acc is null then return json_build_object('connected', false); end if;
  return json_build_object(
    'connected', v_acc.connected,
    'mp_user_id', v_acc.mp_user_id,
    'expires_at', v_acc.expires_at,
    'updated_at', v_acc.updated_at
  );
end;
$$;
revoke all on function public.mercado_pago_status(uuid) from public, anon;
grant execute on function public.mercado_pago_status(uuid) to authenticated;

-- ============ EVENTOS DE WEBHOOK ============
create table public.mercado_pago_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  type text not null,
  resource_id text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
grant all on public.mercado_pago_webhook_events to service_role;
alter table public.mercado_pago_webhook_events enable row level security;
create unique index mp_webhook_events_event_key on public.mercado_pago_webhook_events (event_id);
create index mp_webhook_events_resource_idx on public.mercado_pago_webhook_events (resource_id);

-- ============ AGENDAMENTOS: PAGAMENTO ============
alter table public.appointments
  add column if not exists payment_method text not null default 'cash_or_on_site',
  add column if not exists payment_state text not null default 'pending',
  add column if not exists paid_at timestamptz;
create index if not exists appointments_payment_state_idx on public.appointments (barbershop_id, payment_state);

-- ============ LEGADO STRIPE ============
alter table public.user_subscriptions
  add column if not exists legacy_provider text not null default 'legacy_stripe';
comment on table public.user_subscriptions is 'legacy_stripe: histórico de assinaturas do Stripe. Somente leitura, não usar em novas operações.';

-- ============ GERAÇÃO DA TAXA AO CONCLUIR ATENDIMENTO ============
create or replace function public.complete_appointment(_appointment_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_appt public.appointments;
  v_sub public.customer_subscriptions;
  v_cycle public.subscription_cycles;
  v_bal public.subscription_cycle_balances;
  v_left int := 0;
  v_consumed boolean := false;
  v_fee numeric(10,2);
  v_fee_created boolean := false;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = _appointment_id;
  IF v_appt IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF NOT public.is_member(v_appt.barbershop_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  IF v_appt.use_benefit AND NOT v_appt.benefit_processed AND v_appt.subscription_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = v_appt.subscription_id;
    IF v_sub.status <> 'active' THEN RAISE EXCEPTION 'Assinatura não está ativa'; END IF;
    v_cycle := public.ensure_subscription_cycle(v_sub.id);
    IF v_cycle IS NULL THEN RAISE EXCEPTION 'Assinatura sem ciclo válido'; END IF;
    IF v_cycle.period_end <= current_date THEN RAISE EXCEPTION 'Ciclo da assinatura expirado'; END IF;

    SELECT * INTO v_bal FROM public.subscription_cycle_balances WHERE cycle_id = v_cycle.id;
    v_left := CASE v_appt.benefit_kind
      WHEN 'cut' THEN v_bal.cuts_left WHEN 'beard' THEN v_bal.beards_left ELSE v_bal.extras_left END;
    IF v_left <= 0 THEN RAISE EXCEPTION 'Cliente sem créditos disponíveis neste ciclo'; END IF;

    INSERT INTO public.subscription_usages
      (barbershop_id, subscription_id, cycle_id, customer_id, appointment_id, service_id, barber_id,
       benefit_kind, kind, quantity, created_by)
    VALUES (v_appt.barbershop_id, v_sub.id, v_cycle.id, v_appt.customer_id, v_appt.id, v_appt.service_id,
            v_appt.barber_id, v_appt.benefit_kind, 'debit', 1, auth.uid());

    UPDATE public.appointments SET benefit_processed = true, price_cents = 0 WHERE id = _appointment_id;
    v_consumed := true;
    v_left := v_left - 1;
  END IF;

  -- Taxa de utilização: somente quando o atendimento é concluído, uma única vez.
  IF v_appt.status <> 'done' THEN
    SELECT usage_fee_amount INTO v_fee FROM public.platform_settings WHERE id;
    INSERT INTO public.usage_fees (barbershop_id, appointment_id, barber_id, amount)
    VALUES (v_appt.barbershop_id, v_appt.id, v_appt.barber_id, COALESCE(v_fee, 0.20))
    ON CONFLICT (appointment_id) DO NOTHING;
    v_fee_created := FOUND;
  END IF;

  UPDATE public.appointments SET status = 'done' WHERE id = _appointment_id;

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  VALUES (v_appt.barbershop_id, auth.uid(), 'appointment.completed', 'appointments', _appointment_id,
          json_build_object('consumed', v_consumed, 'benefit_kind', v_appt.benefit_kind,
                            'usage_fee_created', v_fee_created)::jsonb);

  RETURN json_build_object('consumed', v_consumed, 'benefit_kind', v_appt.benefit_kind, 'left', v_left,
                           'usage_fee_created', v_fee_created);
END;
$function$;

-- ============ RESUMO FINANCEIRO DA BARBEARIA ============
create or replace function public.barbershop_billing_summary(_shop uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.platform_settings;
  v_sub public.platform_subscriptions;
  v_plan public.platform_plans;
  v_completed int;
  v_accrued numeric(10,2);
  v_paid numeric(10,2);
  v_pending numeric(10,2);
  v_last_payment public.payments;
begin
  if not public.is_member(_shop) then raise exception 'Sem permissão'; end if;
  select * into v_settings from public.platform_settings where id;
  select * into v_sub from public.platform_subscriptions where barbershop_id = _shop;
  if v_sub.plan_id is not null then
    select * into v_plan from public.platform_plans where id = v_sub.plan_id;
  end if;

  select count(*) into v_completed from public.appointments
    where barbershop_id = _shop and status = 'done';
  select coalesce(sum(amount),0) into v_accrued from public.usage_fees
    where barbershop_id = _shop and status <> 'cancelled';
  select coalesce(sum(amount),0) into v_paid from public.usage_fees
    where barbershop_id = _shop and status = 'paid';
  select coalesce(sum(amount),0) into v_pending from public.usage_fees
    where barbershop_id = _shop and status in ('pending','billed');
  select * into v_last_payment from public.payments
    where barbershop_id = _shop and status = 'approved' order by paid_at desc nulls last limit 1;

  return json_build_object(
    'usage_fee_amount', coalesce(v_settings.usage_fee_amount, 0.20),
    'pending_balance_warning', coalesce(v_settings.pending_balance_warning, 20.00),
    'subscription', to_jsonb(v_sub),
    'plan', to_jsonb(v_plan),
    'completed_appointments', v_completed,
    'fees_accrued', v_accrued,
    'fees_paid', v_paid,
    'fees_pending', v_pending,
    'last_payment', to_jsonb(v_last_payment)
  );
end;
$$;
revoke all on function public.barbershop_billing_summary(uuid) from public, anon;
grant execute on function public.barbershop_billing_summary(uuid) to authenticated;