
DO $$
DECLARE
  shop record;
  svc_ids uuid[]; svc_dur int[]; svc_price int[];
  cust_ids uuid[]; cust_names text[]; cust_phones text[];
  bar_ids uuid[];
  n_svc int; n_cust int; n_bar int;
  d date; slot int; b_idx int; pick int; pseudo int;
  st timestamptz; en timestamptz; busy_until timestamptz;
  stat text; total bigint; factor numeric; diff bigint; adj_id uuid;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  month_start date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
FOR shop IN SELECT id FROM public.barbershops LOOP
  DELETE FROM public.appointments WHERE barbershop_id = shop.id;
  DELETE FROM public.services WHERE barbershop_id = shop.id;

  INSERT INTO public.services (barbershop_id, name, description, price_cents, duration_min, sort_order, active) VALUES
    (shop.id, 'Navalhado', 'Acabamento na navalha', 5000, 40, 1, true),
    (shop.id, 'Corte Máquina', 'Corte todo na máquina', 4000, 30, 2, true),
    (shop.id, 'Corte Tesoura', 'Corte clássico na tesoura', 5500, 40, 3, true),
    (shop.id, 'Barba', 'Toalha quente e navalha', 3500, 30, 4, true),
    (shop.id, 'Sobrancelha', 'Design masculino', 2000, 15, 5, true),
    (shop.id, 'Corte Infantil', 'Atendimento para crianças', 4000, 30, 6, true),
    (shop.id, 'Pigmentação', 'Preenchimento de barba', 4500, 45, 7, true),
    (shop.id, 'Reflexo', 'Luzes e reflexos', 9000, 60, 8, true),
    (shop.id, 'Nevou', 'Descoloração global', 12000, 90, 9, true);

  SELECT array_agg(id ORDER BY sort_order), array_agg(duration_min ORDER BY sort_order), array_agg(price_cents ORDER BY sort_order)
    INTO svc_ids, svc_dur, svc_price FROM public.services WHERE barbershop_id = shop.id;
  SELECT array_agg(id ORDER BY created_at), array_agg(name ORDER BY created_at), array_agg(coalesce(phone,'') ORDER BY created_at)
    INTO cust_ids, cust_names, cust_phones FROM public.customers WHERE barbershop_id = shop.id;
  SELECT array_agg(id ORDER BY created_at) INTO bar_ids FROM public.barbers WHERE barbershop_id = shop.id AND active;

  IF bar_ids IS NULL OR cust_ids IS NULL THEN CONTINUE; END IF;
  n_svc := array_length(svc_ids,1); n_cust := array_length(cust_ids,1); n_bar := array_length(bar_ids,1);

  d := month_start;
  WHILE d <= today + 7 LOOP
    IF extract(dow from d)::int <> 0 THEN
      FOR b_idx IN 1..n_bar LOOP
        busy_until := NULL;
        FOR slot IN 0..21 LOOP
          st := (d::timestamp + interval '9 hours' + (slot * interval '30 minutes')) AT TIME ZONE 'America/Sao_Paulo';
          pseudo := (extract(day from d)::int * 7 + slot * 3 + b_idx * 5) % 10;
          IF (d < today AND pseudo < 6) OR (d >= today AND pseudo < 5) THEN
            IF busy_until IS NULL OR st >= busy_until THEN
              pick := ((slot + b_idx + extract(day from d)::int) % n_svc) + 1;
              en := st + (svc_dur[pick] * interval '1 minute');
              IF st < now() THEN
                IF (slot + extract(day from d)::int) % 17 = 0 THEN stat := 'no_show';
                ELSIF (slot + extract(day from d)::int) % 13 = 0 THEN stat := 'canceled';
                ELSE stat := 'done'; END IF;
              ELSE
                stat := 'scheduled';
              END IF;
              INSERT INTO public.appointments (barbershop_id, barber_id, service_id, customer_id, customer_name, customer_phone, starts_at, ends_at, price_cents, status, source)
              VALUES (shop.id, bar_ids[b_idx], svc_ids[pick],
                cust_ids[((slot * 3 + b_idx + extract(day from d)::int) % n_cust) + 1],
                cust_names[((slot * 3 + b_idx + extract(day from d)::int) % n_cust) + 1],
                cust_phones[((slot * 3 + b_idx + extract(day from d)::int) % n_cust) + 1],
                st, en, svc_price[pick], stat,
                CASE WHEN (slot + b_idx) % 2 = 0 THEN 'online' ELSE 'internal' END);
              busy_until := en;
            END IF;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
    d := d + 1;
  END LOOP;

  SELECT coalesce(sum(price_cents),0) INTO total FROM public.appointments
   WHERE barbershop_id = shop.id AND status = 'done' AND starts_at >= month_start::timestamp AT TIME ZONE 'America/Sao_Paulo';
  IF total > 0 THEN
    factor := 3000000::numeric / total;
    UPDATE public.appointments SET price_cents = greatest(1000, (round(price_cents * factor / 500) * 500)::int)
     WHERE barbershop_id = shop.id AND status = 'done' AND starts_at >= month_start::timestamp AT TIME ZONE 'America/Sao_Paulo';
    SELECT coalesce(sum(price_cents),0) INTO total FROM public.appointments
     WHERE barbershop_id = shop.id AND status = 'done' AND starts_at >= month_start::timestamp AT TIME ZONE 'America/Sao_Paulo';
    diff := 3000000 - total;
    SELECT id INTO adj_id FROM public.appointments
     WHERE barbershop_id = shop.id AND status = 'done' AND starts_at >= month_start::timestamp AT TIME ZONE 'America/Sao_Paulo'
     ORDER BY price_cents DESC LIMIT 1;
    IF adj_id IS NOT NULL AND diff <> 0 THEN
      UPDATE public.appointments SET price_cents = greatest(1000, price_cents + diff)::int WHERE id = adj_id;
    END IF;
  END IF;
END LOOP;
END $$;
