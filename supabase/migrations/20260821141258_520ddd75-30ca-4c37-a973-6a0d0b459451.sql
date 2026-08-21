-- 1) barbers: hide commission_pct from anonymous visitors
REVOKE SELECT ON public.barbers FROM anon;
GRANT SELECT (id, barbershop_id, name, bio, photo_url, work_days, start_time, end_time, active, created_at) ON public.barbers TO anon;

-- 2) barbershops: hide owner_id from signed-in visitors too
REVOKE SELECT ON public.barbershops FROM authenticated;
GRANT SELECT (id, name, slug, description, address, phone, whatsapp, instagram, logo_url, cover_url, accent_color, secondary_color, bg_color, font_family, brand_style, brand_symbol, template, onboarding_done, created_at) ON public.barbershops TO authenticated;

-- make sure every owner has a membership row so the app can find its own shop without owner_id
INSERT INTO public.barbershop_members (barbershop_id, user_id, role)
SELECT b.id, b.owner_id, 'owner'::app_role FROM public.barbershops b
ON CONFLICT (barbershop_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.add_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  insert into public.barbershop_members (barbershop_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (barbershop_id, user_id) do nothing;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS barbershops_owner_membership ON public.barbershops;
CREATE TRIGGER barbershops_owner_membership
AFTER INSERT ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.add_owner_membership();

-- 3) SECURITY DEFINER functions: remove blanket PUBLIC execute, grant only where needed
REVOKE EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booked_slots(text, uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_breaks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booked_slots(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_breaks(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_membership() FROM PUBLIC, anon, authenticated;