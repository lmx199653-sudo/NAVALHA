-- ============ PLANOS ============
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS cycle_days int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS extras_included int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_limit int,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SERVIÇOS: mapeamento de benefício ============
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS benefit_kind text;
ALTER TABLE public.services ADD CONSTRAINT services_benefit_kind_check
  CHECK (benefit_kind IS NULL OR benefit_kind IN ('cut','beard','extra'));

UPDATE public.services SET benefit_kind = 'cut'
  WHERE benefit_kind IS NULL AND (name ILIKE '%corte%' OR name ILIKE '%navalhado%');
UPDATE public.services SET benefit_kind = 'beard'
  WHERE benefit_kind IS NULL AND name ILIKE '%barba%';

-- ============ CLIENTES: CPF único + índice ============
UPDATE public.customers SET cpf = NULLIF(regexp_replace(coalesce(cpf,''), '\D', '', 'g'), '');

CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_cpf_unique
  ON public.customers (barbershop_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_cpf_idx ON public.customers (cpf);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON public.customers (barbershop_id, phone);

-- ============ ASSINATURAS ============
ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS started_on date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS price_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.customer_subscriptions ADD CONSTRAINT customer_subscriptions_status_check
  CHECK (status IN ('active','pending','suspended','cancelled','expired'));
ALTER TABLE public.customer_subscriptions ADD CONSTRAINT customer_subscriptions_payment_status_check
  CHECK (payment_status IN ('paid','pending','failed','refunded','cancelled'));

CREATE TRIGGER update_customer_subscriptions_updated_at BEFORE UPDATE ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS customer_subscriptions_customer_idx ON public.customer_subscriptions (customer_id, status);
CREATE INDEX IF NOT EXISTS customer_subscriptions_shop_idx ON public.customer_subscriptions (barbershop_id, status);

-- ============ CICLOS ============
CREATE TABLE public.subscription_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT current_date,
  period_end date NOT NULL,
  cuts_credits int NOT NULL DEFAULT 0,
  beards_credits int NOT NULL DEFAULT 0,
  extras_credits int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_cycles TO authenticated;
GRANT ALL ON public.subscription_cycles TO service_role;
ALTER TABLE public.subscription_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage cycles" ON public.subscription_cycles FOR ALL TO authenticated
  USING (public.is_member(barbershop_id)) WITH CHECK (public.is_member(barbershop_id));
CREATE TRIGGER update_subscription_cycles_updated_at BEFORE UPDATE ON public.subscription_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX subscription_cycles_sub_idx ON public.subscription_cycles (subscription_id, period_start DESC);

-- ============ UTILIZAÇÕES (ledger) ============
CREATE TABLE public.subscription_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  benefit_kind text NOT NULL CHECK (benefit_kind IN ('cut','beard','extra')),
  kind text NOT NULL DEFAULT 'debit' CHECK (kind IN ('debit','refund')),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.subscription_usages TO authenticated;
GRANT ALL ON public.subscription_usages TO service_role;
ALTER TABLE public.subscription_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read usages" ON public.subscription_usages FOR SELECT TO authenticated
  USING (public.is_member(barbershop_id));
CREATE INDEX subscription_usages_cycle_idx ON public.subscription_usages (cycle_id);
CREATE INDEX subscription_usages_customer_idx ON public.subscription_usages (customer_id, created_at DESC);
CREATE UNIQUE INDEX subscription_usages_appt_debit_unique
  ON public.subscription_usages (appointment_id) WHERE kind = 'debit' AND appointment_id IS NOT NULL;

-- ============ PAGAMENTOS ============
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.subscription_cycles(id) ON DELETE SET NULL,
  amount_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending','failed','refunded','cancelled')),
  method text,
  transaction_id text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage payments" ON public.subscription_payments FOR ALL TO authenticated
  USING (public.is_member(barbershop_id)) WITH CHECK (public.is_member(barbershop_id));
CREATE TRIGGER update_subscription_payments_updated_at BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX subscription_payments_sub_idx ON public.subscription_payments (subscription_id, created_at DESC);

-- ============ AUDITORIA ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_member(barbershop_id));
CREATE POLICY "members write audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_member(barbershop_id));
CREATE INDEX audit_logs_shop_idx ON public.audit_logs (barbershop_id, created_at DESC);

-- ============ AGENDAMENTOS ============
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS benefit_kind text,
  ADD COLUMN IF NOT EXISTS use_benefit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS benefit_processed boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_benefit_kind_check
  CHECK (benefit_kind IS NULL OR benefit_kind IN ('cut','beard','extra'));
CREATE INDEX IF NOT EXISTS appointments_customer_idx ON public.appointments (customer_id, starts_at DESC);

-- ============ VIEW DE SALDOS ============
CREATE OR REPLACE VIEW public.subscription_cycle_balances
WITH (security_invoker = true) AS
SELECT
  c.id AS cycle_id,
  c.subscription_id,
  c.barbershop_id,
  c.period_start,
  c.period_end,
  c.status AS cycle_status,
  c.cuts_credits,
  c.beards_credits,
  c.extras_credits,
  COALESCE(u.cuts_used, 0) AS cuts_used,
  COALESCE(u.beards_used, 0) AS beards_used,
  COALESCE(u.extras_used, 0) AS extras_used,
  GREATEST(c.cuts_credits - COALESCE(u.cuts_used, 0), 0) AS cuts_left,
  GREATEST(c.beards_credits - COALESCE(u.beards_used, 0), 0) AS beards_left,
  GREATEST(c.extras_credits - COALESCE(u.extras_used, 0), 0) AS extras_left
FROM public.subscription_cycles c
LEFT JOIN (
  SELECT cycle_id,
    SUM(CASE WHEN benefit_kind='cut' THEN CASE WHEN kind='debit' THEN quantity ELSE -quantity END ELSE 0 END) AS cuts_used,
    SUM(CASE WHEN benefit_kind='beard' THEN CASE WHEN kind='debit' THEN quantity ELSE -quantity END ELSE 0 END) AS beards_used,
    SUM(CASE WHEN benefit_kind='extra' THEN CASE WHEN kind='debit' THEN quantity ELSE -quantity END ELSE 0 END) AS extras_used
  FROM public.subscription_usages GROUP BY cycle_id
) u ON u.cycle_id = c.id;

GRANT SELECT ON public.subscription_cycle_balances TO authenticated;
GRANT ALL ON public.subscription_cycle_balances TO service_role;

-- ============ FUNÇÕES DE NEGÓCIO ============
CREATE OR REPLACE FUNCTION public.is_shop_admin(_shop uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = _shop AND b.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.barbershop_members m WHERE m.barbershop_id = _shop
                 AND m.user_id = auth.uid() AND m.role IN ('owner','admin'));
$$;
REVOKE ALL ON FUNCTION public.is_shop_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_admin(uuid) TO authenticated;

-- garante ciclo aberto da assinatura (cria/renova quando vencido)
CREATE OR REPLACE FUNCTION public.ensure_subscription_cycle(_subscription_id uuid)
RETURNS public.subscription_cycles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.customer_subscriptions;
  v_plan public.subscription_plans;
  v_cycle public.subscription_cycles;
  v_start date;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = _subscription_id;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;
  IF NOT public.is_member(v_sub.barbershop_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;

  SELECT * INTO v_cycle FROM public.subscription_cycles
   WHERE subscription_id = _subscription_id ORDER BY period_start DESC LIMIT 1;

  IF v_cycle IS NULL THEN
    v_start := v_sub.started_on;
  ELSIF v_cycle.period_end > current_date THEN
    RETURN v_cycle;
  ELSE
    v_start := v_cycle.period_end;
    UPDATE public.subscription_cycles SET status = 'closed' WHERE id = v_cycle.id;
  END IF;

  IF v_sub.status NOT IN ('active','pending') THEN RETURN v_cycle; END IF;

  INSERT INTO public.subscription_cycles
    (barbershop_id, subscription_id, period_start, period_end, cuts_credits, beards_credits, extras_credits)
  VALUES (v_sub.barbershop_id, _subscription_id, v_start,
          v_start + make_interval(days => COALESCE(v_plan.cycle_days, 30))::interval,
          COALESCE(v_plan.cuts_included,0), COALESCE(v_plan.beards_included,0), COALESCE(v_plan.extras_included,0))
  RETURNING * INTO v_cycle;

  UPDATE public.customer_subscriptions SET next_payment = v_cycle.period_end WHERE id = _subscription_id;

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  VALUES (v_sub.barbershop_id, auth.uid(), 'subscription.cycle_renewed', 'subscription_cycles', v_cycle.id, to_jsonb(v_cycle));

  RETURN v_cycle;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_subscription_cycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_subscription_cycle(uuid) TO authenticated;

-- resumo do cliente por CPF (com saldo)
CREATE OR REPLACE FUNCTION public.customer_by_cpf(_shop uuid, _cpf text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  v_customer public.customers;
  v_sub public.customer_subscriptions;
  v_plan public.subscription_plans;
  v_bal public.subscription_cycle_balances;
BEGIN
  IF NOT public.is_member(_shop) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF length(v_cpf) <> 11 THEN RETURN json_build_object('found', false); END IF;

  SELECT * INTO v_customer FROM public.customers WHERE barbershop_id = _shop AND cpf = v_cpf;
  IF v_customer IS NULL THEN RETURN json_build_object('found', false); END IF;

  SELECT * INTO v_sub FROM public.customer_subscriptions
   WHERE customer_id = v_customer.id AND barbershop_id = _shop
   ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1;

  IF v_sub IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
    SELECT * INTO v_bal FROM public.subscription_cycle_balances
      WHERE subscription_id = v_sub.id ORDER BY period_start DESC LIMIT 1;
  END IF;

  RETURN json_build_object(
    'found', true,
    'customer', to_jsonb(v_customer),
    'subscription', to_jsonb(v_sub),
    'plan', to_jsonb(v_plan),
    'balance', to_jsonb(v_bal)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.customer_by_cpf(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_by_cpf(uuid, text) TO authenticated;

-- conclui atendimento e consome crédito (idempotente)
CREATE OR REPLACE FUNCTION public.complete_appointment(_appointment_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appt public.appointments;
  v_sub public.customer_subscriptions;
  v_cycle public.subscription_cycles;
  v_bal public.subscription_cycle_balances;
  v_left int := 0;
  v_consumed boolean := false;
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

  UPDATE public.appointments SET status = 'done' WHERE id = _appointment_id;

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  VALUES (v_appt.barbershop_id, auth.uid(), 'appointment.completed', 'appointments', _appointment_id,
          json_build_object('consumed', v_consumed, 'benefit_kind', v_appt.benefit_kind)::jsonb);

  RETURN json_build_object('consumed', v_consumed, 'benefit_kind', v_appt.benefit_kind, 'left', v_left);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid) TO authenticated;

-- estorno de crédito
CREATE OR REPLACE FUNCTION public.refund_appointment_benefit(_appointment_id uuid, _reason text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appt public.appointments;
  v_usage public.subscription_usages;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = _appointment_id;
  IF v_appt IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF NOT public.is_shop_admin(v_appt.barbershop_id) THEN RAISE EXCEPTION 'Apenas administradores podem estornar'; END IF;

  SELECT * INTO v_usage FROM public.subscription_usages
   WHERE appointment_id = _appointment_id AND kind = 'debit' LIMIT 1;
  IF v_usage IS NULL THEN RETURN json_build_object('refunded', false); END IF;

  IF EXISTS (SELECT 1 FROM public.subscription_usages
             WHERE appointment_id = _appointment_id AND kind = 'refund') THEN
    RETURN json_build_object('refunded', false, 'already', true);
  END IF;

  INSERT INTO public.subscription_usages
    (barbershop_id, subscription_id, cycle_id, customer_id, appointment_id, service_id, barber_id,
     benefit_kind, kind, quantity, reason, created_by)
  VALUES (v_usage.barbershop_id, v_usage.subscription_id, v_usage.cycle_id, v_usage.customer_id, NULL,
          v_usage.service_id, v_usage.barber_id, v_usage.benefit_kind, 'refund', v_usage.quantity,
          _reason, auth.uid());

  UPDATE public.appointments SET benefit_processed = false WHERE id = _appointment_id;

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  VALUES (v_usage.barbershop_id, auth.uid(), 'subscription.usage_refunded', 'appointments', _appointment_id,
          json_build_object('reason', _reason, 'benefit_kind', v_usage.benefit_kind)::jsonb);

  RETURN json_build_object('refunded', true, 'benefit_kind', v_usage.benefit_kind);
END;
$$;
REVOKE ALL ON FUNCTION public.refund_appointment_benefit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_appointment_benefit(uuid, text) TO authenticated;

-- cria assinatura (valida CPF/cliente/plano e abre 1º ciclo)
CREATE OR REPLACE FUNCTION public.create_subscription(_shop uuid, _customer_id uuid, _plan_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.subscription_plans;
  v_sub public.customer_subscriptions;
  v_cycle public.subscription_cycles;
BEGIN
  IF NOT public.is_member(_shop) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = _plan_id AND barbershop_id = _shop;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Plano não encontrado'; END IF;
  IF NOT v_plan.active THEN RAISE EXCEPTION 'Plano inativo não aceita novas assinaturas'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_subscriptions
             WHERE customer_id = _customer_id AND status = 'active') THEN
    RAISE EXCEPTION 'Cliente já possui uma assinatura ativa';
  END IF;

  INSERT INTO public.customer_subscriptions
    (barbershop_id, customer_id, plan_id, status, price_cents, started_on, payment_status, uses_left)
  VALUES (_shop, _customer_id, _plan_id, 'active', v_plan.price_cents, current_date, 'pending',
          COALESCE(v_plan.cuts_included,0) + COALESCE(v_plan.beards_included,0))
  RETURNING * INTO v_sub;

  v_cycle := public.ensure_subscription_cycle(v_sub.id);

  INSERT INTO public.subscription_payments (barbershop_id, subscription_id, cycle_id, amount_cents, status, due_date)
  VALUES (_shop, v_sub.id, v_cycle.id, v_plan.price_cents, 'pending', current_date);

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  VALUES (_shop, auth.uid(), 'subscription.created', 'customer_subscriptions', v_sub.id, to_jsonb(v_sub));

  RETURN json_build_object('subscription_id', v_sub.id, 'cycle_id', v_cycle.id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_subscription(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subscription(uuid, uuid, uuid) TO authenticated;

-- cancelar assinatura
CREATE OR REPLACE FUNCTION public.cancel_subscription(_subscription_id uuid, _reason text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub public.customer_subscriptions;
BEGIN
  SELECT * INTO v_sub FROM public.customer_subscriptions WHERE id = _subscription_id;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;
  IF NOT public.is_shop_admin(v_sub.barbershop_id) THEN RAISE EXCEPTION 'Apenas administradores podem cancelar'; END IF;

  UPDATE public.customer_subscriptions
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = _reason
   WHERE id = _subscription_id;
  UPDATE public.subscription_cycles SET status = 'closed'
   WHERE subscription_id = _subscription_id AND status = 'open';

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, before_data, after_data)
  VALUES (v_sub.barbershop_id, auth.uid(), 'subscription.cancelled', 'customer_subscriptions', _subscription_id,
          to_jsonb(v_sub), json_build_object('reason', _reason)::jsonb);

  RETURN json_build_object('cancelled', true);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid, text) TO authenticated;