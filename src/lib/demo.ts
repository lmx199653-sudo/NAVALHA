import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

const NAMES = [
  "Lucas Prado",
  "Rafael Dias",
  "Bruno Camargo",
  "Diego Nunes",
  "Felipe Rocha",
  "Marcos Vinícius",
  "Thiago Lemos",
  "Gustavo Reis",
  "André Salles",
  "Caio Bernardes",
  "Vitor Hugo",
  "Renan Barros",
];

export async function seedDemoData(shopId: string) {
  const { data: services } = await supabase
    .from("services")
    .insert(defaultServiceRows(shopId))
    .select();


  const { data: barbers } = await supabase
    .from("barbers")
    .insert([
      { barbershop_id: shopId, name: "João Ferraz", bio: "Especialista em degradê", commission_pct: 45 },
      { barbershop_id: shopId, name: "Pedro Alves", bio: "Barba e navalha", commission_pct: 40 },
      { barbershop_id: shopId, name: "Caio Mendes", bio: "Cortes clássicos", commission_pct: 40 },
    ])
    .select();

  await supabase.from("business_hours").upsert(
    Array.from({ length: 7 }, (_, weekday) => ({
      barbershop_id: shopId,
      weekday,
      open_time: "09:00",
      close_time: weekday === 6 ? "18:00" : "20:00",
      closed: weekday === 0,
    })),
    { onConflict: "barbershop_id,weekday" },
  );

  const { data: customers } = await supabase
    .from("customers")
    .insert(
      NAMES.map((name, i) => ({
        barbershop_id: shopId,
        name,
        phone: `1199${String(100000 + i * 7311).slice(0, 6)}`,
        email: `${name.split(" ")[0]?.toLowerCase()}@email.com`,
        points: 10 + i * 7,
      })),
    )
    .select();

  if (!services?.length || !barbers?.length || !customers?.length) return;

  const appointments: TablesInsert<"appointments">[] = [];
  for (let dayOffset = -30; dayOffset <= 7; dayOffset++) {
    const perDay = dayOffset <= 0 ? 3 + (Math.abs(dayOffset) % 4) : 2;
    for (let i = 0; i < perDay; i++) {
      const start = new Date();
      start.setDate(start.getDate() + dayOffset);
      start.setHours(9 + ((i * 2 + Math.abs(dayOffset)) % 9), i % 2 === 0 ? 0 : 30, 0, 0);
      const service = services[(i + Math.abs(dayOffset)) % services.length]!;
      const barber = barbers[(i + Math.abs(dayOffset)) % barbers.length]!;
      const customer = customers[(i * 3 + Math.abs(dayOffset)) % customers.length]!;
      const end = new Date(start.getTime() + service.duration_min * 60000);
      const past = dayOffset < 0;
      appointments.push({
        barbershop_id: shopId,
        barber_id: barber.id,
        service_id: service.id,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        price_cents: service.price_cents,
        status: past ? (i % 9 === 0 ? "no_show" : i % 11 === 0 ? "canceled" : "done") : "scheduled",
        source: i % 2 === 0 ? "online" : "internal",
      });
    }
  }
  await supabase.from("appointments").insert(appointments);

  await supabase.from("subscription_plans").insert([
    { barbershop_id: shopId, name: "Plano Corte Mensal", price_cents: 7990, cuts_included: 4, benefits: "4 cortes por mês + prioridade na agenda" },
    { barbershop_id: shopId, name: "Plano Black", price_cents: 11990, cuts_included: 4, beards_included: 4, benefits: "4 cortes + 4 barbas + 10% em produtos" },
  ]);

  await supabase.from("loyalty_rewards").insert([
    { barbershop_id: shopId, name: "Corte grátis", points_cost: 100 },
    { barbershop_id: shopId, name: "Barba grátis", points_cost: 70 },
    { barbershop_id: shopId, name: "20% de desconto", points_cost: 40 },
  ]);
}
