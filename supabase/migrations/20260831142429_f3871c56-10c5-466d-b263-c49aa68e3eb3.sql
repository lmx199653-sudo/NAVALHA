ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS appointments_payment_pending_idx
  ON public.appointments (barbershop_id, payment_state, payment_expires_at);

DROP TABLE IF EXISTS public.user_subscriptions;

-- Libera horários cujo pagamento online expirou.
CREATE OR REPLACE FUNCTION public.expire_pending_payment_appointments(_shop uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.appointments a
       SET status = 'cancelled', payment_state = 'expired'
     WHERE a.payment_state = 'payment_pending'
       AND a.payment_expires_at IS NOT NULL
       AND a.payment_expires_at < now()
       AND a.status IN ('scheduled','confirmed')
       AND (_shop IS NULL OR a.barbershop_id = _shop)
    RETURNING a.id
  )
  SELECT count(*) INTO v_count FROM expired;

  UPDATE public.payments p
     SET status = 'cancelled'
   WHERE p.status = 'pending'
     AND p.type = 'customer_service'
     AND p.appointment_id IN (
       SELECT id FROM public.appointments WHERE payment_state = 'expired'
     );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_pending_payment_appointments(uuid) TO anon, authenticated, service_role;

-- Situação pública de um agendamento (tela de retorno do pagamento).
CREATE OR REPLACE FUNCTION public.appointment_payment_status(_appointment_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments;
  v_shop public.barbershops;
  v_service public.services;
  v_payment public.payments;
  v_state text;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = _appointment_id;
  IF v_appt IS NULL THEN RETURN json_build_object('found', false); END IF;

  SELECT * INTO v_shop FROM public.barbershops WHERE id = v_appt.barbershop_id;
  SELECT * INTO v_service FROM public.services WHERE id = v_appt.service_id;
  SELECT * INTO v_payment FROM public.payments
    WHERE appointment_id = v_appt.id AND type = 'customer_service'
    ORDER BY created_at DESC LIMIT 1;

  v_state := CASE
    WHEN v_appt.payment_state = 'paid' THEN 'approved'
    WHEN v_appt.payment_state = 'expired' THEN 'expired'
    WHEN v_appt.payment_state IN ('rejected','cancelled') THEN 'rejected'
    WHEN v_appt.payment_state = 'payment_pending'
      AND v_appt.payment_expires_at IS NOT NULL
      AND v_appt.payment_expires_at < now() THEN 'expired'
    WHEN v_appt.payment_state = 'payment_pending' THEN 'pending'
    ELSE 'none'
  END;

  RETURN json_build_object(
    'found', true,
    'appointment_id', v_appt.id,
    'payment_status', v_state,
    'appointment_status', v_appt.status,
    'starts_at', v_appt.starts_at,
    'ends_at', v_appt.ends_at,
    'price_cents', v_appt.price_cents,
    'customer_name', v_appt.customer_name,
    'service_name', v_service.name,
    'shop_name', v_shop.name,
    'shop_slug', v_shop.slug,
    'shop_whatsapp', coalesce(v_shop.whatsapp, v_shop.phone),
    'payment_amount', v_payment.amount,
    'payment_state', v_payment.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.appointment_payment_status(uuid) TO anon, authenticated, service_role;

-- booked_slots ignora horários com pagamento expirado.
CREATE OR REPLACE FUNCTION public.booked_slots(_slug text, _barber_id uuid, _day date)
RETURNS TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select a.starts_at, a.ends_at from public.appointments a
  join public.barbershops b on b.id = a.barbershop_id
  where b.slug = _slug and a.barber_id = _barber_id
    and a.status in ('scheduled','confirmed')
    and not (
      a.payment_state = 'payment_pending'
      and a.payment_expires_at is not null
      and a.payment_expires_at < now()
    )
    and a.starts_at >= _day::timestamptz and a.starts_at < (_day + 1)::timestamptz;
$$;

-- book_appointment libera expirados antes de verificar conflito.
CREATE OR REPLACE FUNCTION public.book_appointment(_slug text, _service_id uuid, _barber_id uuid, _starts_at timestamp with time zone, _name text, _phone text, _cpf text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
begin
  select * into v_shop from public.barbershops where slug = _slug;
  if v_shop is null then raise exception 'Barbearia não encontrada'; end if;
  select * into v_service from public.services where id = _service_id and barbershop_id = v_shop.id and active;
  if v_service is null then raise exception 'Serviço inválido'; end if;
  if length(coalesce(_name,'')) < 2 or length(coalesce(_phone,'')) < 8 then
    raise exception 'Nome e telefone obrigatórios';
  end if;

  v_cpf := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  if length(v_cpf) <> 11 then raise exception 'CPF inválido'; end if;

  if _starts_at < now() then raise exception 'Horário no passado'; end if;

  perform public.expire_pending_payment_appointments(v_shop.id);

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

  insert into public.appointments (barbershop_id, barber_id, service_id, customer_id, customer_name, customer_phone, customer_cpf, starts_at, ends_at, price_cents, source)
  values (v_shop.id, _barber_id, _service_id, v_customer_id, left(_name,80), _phone, v_cpf, _starts_at, v_end, v_service.price_cents, 'online')
  returning id into v_id;

  update public.customers set points = points + greatest(0, v_service.price_cents / 1000) where id = v_customer_id;

  return json_build_object('id', v_id, 'starts_at', _starts_at, 'ends_at', v_end);
end;
$function$;