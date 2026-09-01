DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booked_slots(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_breaks(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_payment_enabled(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appointment_payment_status(uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.barbershop_billing_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mercado_pago_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_by_cpf(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_appointment_benefit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_subscription_cycle(uuid) TO authenticated;