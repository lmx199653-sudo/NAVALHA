-- 1. Restrict anon column access on barbershops (hide owner_id and other internals)
REVOKE SELECT ON public.barbershops FROM anon;
GRANT SELECT (id, name, slug, description, address, phone, whatsapp, instagram, logo_url, cover_url, accent_color, secondary_color, bg_color, font_family, template, created_at) ON public.barbershops TO anon;

-- 2. schedule_breaks: remove public read, expose only what booking needs via a function
DROP POLICY IF EXISTS "public read breaks" ON public.schedule_breaks;
REVOKE SELECT ON public.schedule_breaks FROM anon;

CREATE OR REPLACE FUNCTION public.public_breaks(_slug text)
RETURNS TABLE(id uuid, name text, barber_id uuid, start_time time, end_time time, weekdays integer[], specific_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select sb.id, sb.name, sb.barber_id, sb.start_time, sb.end_time, sb.weekdays, sb.specific_date
  from public.schedule_breaks sb
  join public.barbershops b on b.id = sb.barbershop_id
  where b.slug = _slug
    and (sb.barber_id is null or exists (
      select 1 from public.barbers br where br.id = sb.barber_id and br.active
    ));
$$;

REVOKE ALL ON FUNCTION public.public_breaks(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_breaks(text) TO anon, authenticated;

-- 3. Lock down internal SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- keep public booking RPCs callable
GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booked_slots(text, uuid, date) TO anon, authenticated;