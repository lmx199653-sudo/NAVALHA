-- Elegibilidade pública do plano (por CPF) para os serviços escolhidos.
CREATE OR REPLACE FUNCTION public.public_plan_eligibility(_slug text, _cpf text, _service_ids uuid[])
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  v_shop_id uuid;
  v_customer_id uuid;
  v_sub public.customer_subscriptions;
  v_plan public.subscription_plans;
  v_bal public.subscription_cycle_balances;
  v_svc record;
  v_left int;
  v_reserved int;
  v_items json[] := '{}';
  v_any boolean := false;
BEGIN
  IF length(v_cpf) <> 11 THEN RETURN json_build_object('eligible', false); END IF;
  SELECT id INTO v_shop_id FROM public.barbershops WHERE slug = _slug;
  IF v_shop_id IS NULL THEN RETURN json_build_object('eligible', false); END IF;
  SELECT id INTO v_customer_id FROM public.customers WHERE barbershop_id = v_shop_id AND cpf = v_cpf LIMIT 1;
  IF v_customer_id IS NULL THEN RETURN json_build_object('eligible', false); END IF;

  SELECT * INTO v_sub FROM public.customer_subscriptions
   WHERE customer_id = v_customer_id AND barbershop_id = v_shop_id AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;
  IF v_sub IS NULL THEN RETURN json_build_object('eligible', false); END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
  SELECT * INTO v_bal FROM public.subscription_cycle_balances
    WHERE subscription_id = v_sub.id ORDER BY period_start DESC LIMIT 1;
  IF v_bal IS NULL OR v_bal.period_end < current_date THEN
    RETURN json_build_object('eligible', false, 'plan_name', v_plan.name, 'reason', 'ciclo_expirado');
  END IF;

  FOR v_svc IN SELECT s.id, s.name, s.benefit_kind FROM public.services s
               WHERE s.id = ANY(_service_ids) AND s.barbershop_id = v_shop_id LOOP
    v_left := CASE v_svc.benefit_kind
      WHEN 'cut' THEN v_bal.cuts_left WHEN 'beard' THEN v_bal.beards_left
      WHEN 'extra' THEN v_bal.extras_left ELSE 0 END;
    -- Reservas já agendadas com o plano (ainda não concluídas) contam como comprometidas.
    SELECT count(*) INTO v_reserved FROM public.appointments a
     WHERE a.subscription_id = v_sub.id AND a.use_benefit AND NOT a.benefit_processed
       AND a.status IN ('scheduled','confirmed') AND a.benefit_kind = v_svc.benefit_kind;
    v_left := greatest(0, v_left - v_reserved);
    IF v_svc.benefit_kind IS NOT NULL AND v_left > 0 THEN v_any := true; END IF;
    v_items := v_items || json_build_object(
      'service_id', v_svc.id, 'covered', (v_svc.benefit_kind IS NOT NULL AND v_left > 0),
      'benefit_kind', v_svc.benefit_kind, 'left', v_left);
  END LOOP;

  RETURN json_build_object(
    'eligible', v_any, 'plan_name', v_plan.name,
    'period_end', v_bal.period_end, 'services', to_json(v_items));
END;
$$;
REVOKE ALL ON FUNCTION public.public_plan_eligibility(text, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.public_plan_eligibility(text, text, uuid[]) TO anon, authenticated, service_role;

-- Agendamento com opção "plan": reserva o benefício; o desconto só ocorre em complete_appointment.
CREATE OR REPLACE FUNCTION public.book_appointment(_slug text, _service_id uuid, _barber_id uuid, _starts_at timestamp with time zone, _name text, _phone text, _cpf text DEFAULT NULL::text, _payment_method text DEFAULT 'on_site'::text)
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