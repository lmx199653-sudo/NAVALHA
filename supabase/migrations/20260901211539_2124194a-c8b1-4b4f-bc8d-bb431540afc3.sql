ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_holder_name text;

GRANT SELECT (pix_key, pix_key_type, pix_holder_name) ON public.barbershops TO anon, authenticated;

-- book_appointment: aceita forma de pagamento escolhida pelo cliente (pix | on_site)
DROP FUNCTION IF EXISTS public.book_appointment(text, uuid, uuid, timestamptz, text, text, text);

CREATE OR REPLACE FUNCTION public.book_appointment(_slug text, _service_id uuid, _barber_id uuid, _starts_at timestamp with time zone, _name text, _phone text, _cpf text DEFAULT NULL::text, _payment_method text DEFAULT 'on_site')
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

  v_method := case when _payment_method = 'pix' and coalesce(v_shop.pix_key,'') <> '' then 'pix' else 'on_site' end;

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

  insert into public.appointments (barbershop_id, barber_id, service_id, customer_id, customer_name, customer_phone, customer_cpf, starts_at, ends_at, price_cents, source, payment_method, payment_state)
  values (v_shop.id, _barber_id, _service_id, v_customer_id, left(_name,80), _phone, v_cpf, _starts_at, v_end, v_service.price_cents, 'online', v_method, 'pending')
  returning id into v_id;

  update public.customers set points = points + greatest(0, v_service.price_cents / 1000) where id = v_customer_id;

  return json_build_object('id', v_id, 'starts_at', _starts_at, 'ends_at', v_end, 'payment_method', v_method);
end;
$function$;

REVOKE ALL ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text, text) TO anon, authenticated;

-- complete_appointment: registra como o cliente pagou (pix | card | cash)
DROP FUNCTION IF EXISTS public.complete_appointment(uuid);

CREATE OR REPLACE FUNCTION public.complete_appointment(_appointment_id uuid, _payment_method text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt public.appointments;
  v_sub public.customer_subscriptions;
  v_cycle public.subscription_cycles;
  v_bal public.subscription_cycle_balances;
  v_left int := 0;
  v_consumed boolean := false;
  v_method text;
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

  v_method := CASE
    WHEN v_consumed THEN 'subscription'
    WHEN _payment_method IN ('pix','card','cash') THEN _payment_method
    WHEN v_appt.payment_method IN ('pix','card','cash') THEN v_appt.payment_method
    ELSE 'cash' END;

  UPDATE public.appointments
     SET status = 'done', payment_method = v_method, payment_state = 'paid', paid_at = now()
   WHERE id = _appointment_id;

  INSERT INTO public.audit_logs (barbershop_id, user_id, action, entity, entity_id, after_data)
  VALUES (v_appt.barbershop_id, auth.uid(), 'appointment.completed', 'appointments', _appointment_id,
          json_build_object('consumed', v_consumed, 'benefit_kind', v_appt.benefit_kind, 'payment_method', v_method)::jsonb);

  RETURN json_build_object('consumed', v_consumed, 'benefit_kind', v_appt.benefit_kind, 'left', v_left, 'payment_method', v_method);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_appointment(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid, text) TO authenticated;