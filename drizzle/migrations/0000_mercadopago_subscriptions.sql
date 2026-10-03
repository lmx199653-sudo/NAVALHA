-- ==============================================================================
-- MIGRAÇÃO: ASSINATURAS RECORRENTES MERCADO PAGO PARA BARBEARIAS (NAVALHA PRO)
-- ==============================================================================

-- 1. Tabela principal de assinaturas das barbearias
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mercadopago_preapproval_id text UNIQUE,
  mercadopago_plan_id text,
  status text NOT NULL DEFAULT 'payment_pending' CHECK (status IN ('active', 'payment_pending', 'restricted', 'suspended', 'cancelled')),
  monthly_amount numeric(10,2) NOT NULL DEFAULT 49.90,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_date timestamptz,
  last_payment_date timestamptz,
  last_payment_status text,
  payment_failed_at timestamptz,
  grace_until timestamptz,
  restricted_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_barbershop_id_key UNIQUE (barbershop_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_barbershop_idx ON public.subscriptions(barbershop_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_mp_preapproval_idx ON public.subscriptions(mercadopago_preapproval_id);

-- 2. Tabela de histórico de faturas / pagamentos das assinaturas
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  mp_payment_id text UNIQUE,
  amount numeric(10,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'approved',
  date_approved timestamptz,
  billing_type text NOT NULL DEFAULT 'regular',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_invoices_barbershop_idx ON public.subscription_invoices(barbershop_id);
CREATE INDEX IF NOT EXISTS subscription_invoices_sub_idx ON public.subscription_invoices(subscription_id);

-- 3. Tabela de idempotência de eventos e webhooks do Mercado Pago
CREATE TABLE IF NOT EXISTS public.mercadopago_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  resource_id text,
  payload jsonb,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mp_events_event_id_idx ON public.mercadopago_events(event_id);

-- Permissões básicas
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;

GRANT ALL ON public.subscription_invoices TO service_role;
GRANT SELECT ON public.subscription_invoices TO authenticated;

GRANT ALL ON public.mercadopago_events TO service_role;
GRANT SELECT ON public.mercadopago_events TO authenticated;

-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercadopago_events ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para subscriptions:
DROP POLICY IF EXISTS "barbershop members or support select subscription" ON public.subscriptions;
CREATE POLICY "barbershop members or support select subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.barbershop_members bm WHERE bm.barbershop_id = subscriptions.barbershop_id AND bm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = subscriptions.barbershop_id AND b.owner_id = auth.uid())
  OR (SELECT coalesce(public.is_support(), false))
);

DROP POLICY IF EXISTS "barbershop owners or support update subscription" ON public.subscriptions;
CREATE POLICY "barbershop owners or support update subscription"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = subscriptions.barbershop_id AND b.owner_id = auth.uid())
  OR (SELECT coalesce(public.is_support(), false))
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = subscriptions.barbershop_id AND b.owner_id = auth.uid())
  OR (SELECT coalesce(public.is_support(), false))
);

DROP POLICY IF EXISTS "barbershop owners or support insert subscription" ON public.subscriptions;
CREATE POLICY "barbershop owners or support insert subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = subscriptions.barbershop_id AND b.owner_id = auth.uid())
  OR (SELECT coalesce(public.is_support(), false))
);

-- Políticas de RLS para subscription_invoices:
DROP POLICY IF EXISTS "barbershop members or support select invoices" ON public.subscription_invoices;
CREATE POLICY "barbershop members or support select invoices"
ON public.subscription_invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.barbershop_members bm WHERE bm.barbershop_id = subscription_invoices.barbershop_id AND bm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = subscription_invoices.barbershop_id AND b.owner_id = auth.uid())
  OR (SELECT coalesce(public.is_support(), false))
);

-- Políticas de RLS para mercadopago_events (apenas suporte pode ver):
DROP POLICY IF EXISTS "support can view mercadopago events" ON public.mercadopago_events;
CREATE POLICY "support can view mercadopago events"
ON public.mercadopago_events
FOR SELECT
TO authenticated
USING (
  (SELECT coalesce(public.is_support(), false))
);

-- ==============================================================================
-- 4. FUNÇÃO CENTRAL DE VERIFICAÇÃO DE ACESSO: check_subscription_access
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_subscription_access(_barbershop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_created_at timestamptz;
  v_now timestamptz := now();
  v_status text;
  v_access text := 'full';
  v_days_past_due integer := 0;
  v_days_until_restriction integer := 0;
  v_days_until_suspension integer := 0;
  v_message text := 'Assinatura ativa.';
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE barbershop_id = _barbershop_id;

  IF v_sub.id IS NULL THEN
    SELECT created_at INTO v_created_at FROM public.barbershops WHERE id = _barbershop_id;
    IF v_created_at IS NOT NULL AND v_created_at + interval '7 days' > v_now THEN
      RETURN jsonb_build_object(
        'access', 'full',
        'status', 'trial',
        'is_trial', true,
        'trial_ends_at', v_created_at + interval '7 days',
        'days_left', GREATEST(0, EXTRACT(DAY FROM (v_created_at + interval '7 days' - v_now))::integer),
        'message', 'Período de avaliação gratuito ativo.'
      );
    ELSE
      RETURN jsonb_build_object(
        'access', 'suspended',
        'status', 'no_subscription',
        'is_trial', false,
        'message', 'Nenhuma assinatura ativa encontrada. Ative sua assinatura para utilizar o sistema.'
      );
    END IF;
  END IF;

  v_status := v_sub.status;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'access', 'suspended',
      'status', 'cancelled',
      'subscription', row_to_json(v_sub),
      'message', 'Assinatura cancelada. Ative um novo plano para reativar o acesso.'
    );
  END IF;

  IF v_status = 'suspended' OR (v_sub.suspended_at IS NOT NULL AND v_sub.suspended_at <= v_now) THEN
    RETURN jsonb_build_object(
      'access', 'suspended',
      'status', 'suspended',
      'subscription', row_to_json(v_sub),
      'message', 'Acesso suspenso por pendência financeira. Regularize para reativar imediatamente.'
    );
  END IF;

  IF v_status = 'restricted' OR (v_sub.restricted_at IS NOT NULL AND v_sub.restricted_at <= v_now) THEN
    IF v_sub.suspended_at IS NOT NULL AND v_sub.suspended_at > v_now THEN
      v_days_until_suspension := GREATEST(0, EXTRACT(DAY FROM (v_sub.suspended_at - v_now))::integer);
    ELSE
      v_days_until_suspension := 0;
    END IF;

    RETURN jsonb_build_object(
      'access', 'restricted',
      'status', 'restricted',
      'subscription', row_to_json(v_sub),
      'days_until_suspension', v_days_until_suspension,
      'message', 'Acesso restrito. Não é possível cadastrar novos agendamentos ou serviços. Regularize o pagamento.'
    );
  END IF;

  IF v_status = 'payment_pending' THEN
    IF v_sub.restricted_at IS NOT NULL AND v_sub.restricted_at > v_now THEN
      v_days_until_restriction := GREATEST(0, EXTRACT(DAY FROM (v_sub.restricted_at - v_now))::integer);
    END IF;
    IF v_sub.suspended_at IS NOT NULL AND v_sub.suspended_at > v_now THEN
      v_days_until_suspension := GREATEST(0, EXTRACT(DAY FROM (v_sub.suspended_at - v_now))::integer);
    END IF;

    RETURN jsonb_build_object(
      'access', 'full',
      'status', 'payment_pending',
      'in_grace_period', true,
      'subscription', row_to_json(v_sub),
      'days_until_restriction', v_days_until_restriction,
      'days_until_suspension', v_days_until_suspension,
      'message', 'Seu pagamento está pendente. Regularize para manter seu acesso sem bloqueios.'
    );
  END IF;

  RETURN jsonb_build_object(
    'access', 'full',
    'status', 'active',
    'subscription', row_to_json(v_sub),
    'message', 'Assinatura ativa e em dia.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_subscription_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_access(uuid) TO service_role;