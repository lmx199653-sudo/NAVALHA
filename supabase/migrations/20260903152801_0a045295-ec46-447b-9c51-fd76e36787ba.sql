drop view if exists public.public_barbershops;

create or replace function public.public_shop(_slug text)
returns table(
  id uuid, name text, slug text, description text, address text, phone text,
  whatsapp text, instagram text, logo_url text, cover_url text, accent_color text,
  secondary_color text, bg_color text, font_family text, has_pix boolean
)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.slug, b.description, b.address, b.phone, b.whatsapp, b.instagram,
         b.logo_url, b.cover_url, b.accent_color, b.secondary_color, b.bg_color, b.font_family,
         (coalesce(b.pix_key, '') <> '') as has_pix
  from public.barbershops b
  where b.slug = _slug;
$$;
revoke all on function public.public_shop(text) from public;
grant execute on function public.public_shop(text) to anon, authenticated, service_role;