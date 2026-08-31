CREATE OR REPLACE FUNCTION public.public_payment_enabled(_shop uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT connected FROM public.mercado_pago_accounts WHERE barbershop_id = _shop),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.public_payment_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_payment_enabled(uuid) TO anon, authenticated;