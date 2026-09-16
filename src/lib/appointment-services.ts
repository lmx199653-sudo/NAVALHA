import { supabase } from "@/lib/supabase-guard";

export type AppointmentServiceRow = {
  id: string;
  appointment_id: string;
  service_id: string | null;
  name: string;
  price_cents: number;
  duration_min: number;
};

/** Itens (serviços) de um conjunto de agendamentos, agrupados por agendamento. */
export async function fetchAppointmentServices(appointmentIds: string[]) {
  const map: Record<string, AppointmentServiceRow[]> = {};
  if (!appointmentIds.length) return map;
  const { data } = await supabase
    .from("appointment_services")
    .select("id, appointment_id, service_id, name, price_cents, duration_min")
    .in("appointment_id", appointmentIds);
  for (const row of (data ?? []) as AppointmentServiceRow[]) {
    (map[row.appointment_id] ??= []).push(row);
  }
  return map;
}

/** Regrava os serviços do agendamento sem gerar duplicidade. */
export async function saveAppointmentServices(
  appointmentId: string,
  barbershopId: string,
  items: { service_id: string; name: string; price_cents: number; duration_min: number }[],
) {
  await supabase.from("appointment_services").delete().eq("appointment_id", appointmentId);
  if (!items.length) return;
  const unique = new Map(items.map((i) => [i.service_id, i]));
  const { error } = await supabase.from("appointment_services").insert(
    Array.from(unique.values()).map((i) => ({
      appointment_id: appointmentId,
      barbershop_id: barbershopId,
      service_id: i.service_id,
      name: i.name,
      price_cents: i.price_cents,
      duration_min: i.duration_min,
    })),
  );
  if (error) throw error;
}

/** Resumo curto para os cards da agenda: "Corte + Barba". */
export function serviceSummary(rows: AppointmentServiceRow[] | undefined, fallback?: string) {
  if (!rows?.length) return fallback ?? "";
  return rows.map((r) => r.name).join(" + ");
}
