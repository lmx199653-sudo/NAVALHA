DO $$
DECLARE
  v_shop uuid;
BEGIN
  SELECT id INTO v_shop FROM public.barbershops WHERE slug = 'navalha-pro';
  IF v_shop IS NULL THEN
    INSERT INTO public.barbershops (
      owner_id, name, slug, description, address, phone, whatsapp, instagram,
      accent_color, secondary_color, bg_color, font_family, template, onboarding_done
    ) VALUES (
      '03838bb2-ceae-4c76-a10a-826ac8b07d3e',
      'Navalha Pro',
      'navalha-pro',
      'Barbearia demonstração — explore o agendamento à vontade.',
      'Av. Paulista, 1000 — São Paulo/SP',
      '11999990000',
      '11999990000',
      'navalhapro',
      '#d4a017',
      '#1c1c1c',
      '#0d0d0d',
      'Bebas Neue',
      'classic',
      true
    )
    RETURNING id INTO v_shop;

    -- A loja demo não aparece na conta de ninguém: remove o vínculo criado pelo trigger.
    DELETE FROM public.barbershop_members WHERE barbershop_id = v_shop;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.services WHERE barbershop_id = v_shop) THEN
    INSERT INTO public.services (barbershop_id, name, price_cents, duration_min, sort_order) VALUES
      (v_shop, 'Navalhado', 5000, 40, 1),
      (v_shop, 'Corte Máquina', 4000, 30, 2),
      (v_shop, 'Corte Tesoura', 5500, 45, 3),
      (v_shop, 'Barba', 3500, 30, 4),
      (v_shop, 'Sobrancelha', 2000, 15, 5),
      (v_shop, 'Corte Infantil', 4000, 30, 6),
      (v_shop, 'Pigmentação', 4500, 30, 7),
      (v_shop, 'Reflexo', 9000, 60, 8),
      (v_shop, 'Nevou', 12000, 90, 9);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE barbershop_id = v_shop) THEN
    INSERT INTO public.barbers (barbershop_id, name, bio) VALUES
      (v_shop, 'João Ferraz', 'Especialista em cortes clássicos e navalhado.'),
      (v_shop, 'Pedro Alves', 'Mestre da barba e dos degradês.'),
      (v_shop, 'Caio Mendes', 'Pigmentação, reflexo e visagismo.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.business_hours WHERE barbershop_id = v_shop) THEN
    INSERT INTO public.business_hours (barbershop_id, weekday, open_time, close_time, closed)
    SELECT v_shop, d, '09:00'::time, '20:00'::time, (d = 0)
    FROM generate_series(0, 6) AS d;
  END IF;
END $$;