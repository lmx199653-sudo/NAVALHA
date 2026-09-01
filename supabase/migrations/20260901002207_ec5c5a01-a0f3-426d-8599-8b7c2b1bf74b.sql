-- 1. barbershops: hide owner_id from public/client reads (column-level)
REVOKE SELECT ON public.barbershops FROM anon, authenticated;
GRANT SELECT (id, name, slug, description, address, phone, whatsapp, instagram, logo_url, cover_url, accent_color, secondary_color, bg_color, font_family, brand_style, brand_symbol, template, onboarding_done, created_at) ON public.barbershops TO anon, authenticated;

-- 2. platform_settings: internal billing config, no client reads
DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

-- 3. mercado_pago_accounts: members may see connection status only, never tokens
REVOKE ALL ON public.mercado_pago_accounts FROM anon, authenticated;
GRANT SELECT (id, barbershop_id, mp_user_id, public_key, expires_at, connected, created_at, updated_at) ON public.mercado_pago_accounts TO authenticated;
GRANT ALL ON public.mercado_pago_accounts TO service_role;
DROP POLICY IF EXISTS "mp_accounts_member_read" ON public.mercado_pago_accounts;
CREATE POLICY "mp_accounts_member_read" ON public.mercado_pago_accounts
  FOR SELECT TO authenticated
  USING (public.is_member(barbershop_id));

-- 4. mercado_pago_webhook_events: service role only
REVOKE ALL ON public.mercado_pago_webhook_events FROM anon, authenticated;
GRANT ALL ON public.mercado_pago_webhook_events TO service_role;
DROP POLICY IF EXISTS "mp_webhook_events_service_role" ON public.mercado_pago_webhook_events;
CREATE POLICY "mp_webhook_events_service_role" ON public.mercado_pago_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. SECURITY DEFINER functions: restrict EXECUTE to intended callers
REVOKE EXECUTE ON FUNCTION public.add_owner_membership() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_pending_payment_appointments(uuid) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.barbershop_billing_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mercado_pago_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.customer_by_cpf(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_appointment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_appointment_benefit(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_subscription(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_subscription_cycle(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_shop_admin(uuid) FROM anon;

-- keep public booking surface callable by visitors
GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booked_slots(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_breaks(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_payment_enabled(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appointment_payment_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_admin(uuid) TO authenticated;