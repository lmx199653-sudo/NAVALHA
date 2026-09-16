CREATE TABLE IF NOT EXISTS public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  duration_min integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, service_id)
);

CREATE INDEX IF NOT EXISTS appointment_services_appointment_idx ON public.appointment_services(appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;
GRANT ALL ON public.appointment_services TO service_role;

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members manage appointment services" ON public.appointment_services;
CREATE POLICY "members manage appointment services"
ON public.appointment_services
FOR ALL
TO authenticated
USING (public.is_member(barbershop_id))
WITH CHECK (public.is_member(barbershop_id));