/**
 * Dados iniciais de uma barbearia recém-criada: serviços, barbeiros, 3 planos
 * de teste, 2 clientes de demonstração com assinaturas ativas e agendamentos.
 *
 * Cada etapa verifica se já existem registros na barbearia antes de inserir,
 * portanto nunca duplica dados em barbearias existentes.
 */
import { supabase } from "@/lib/supabase-guard";
import type { TablesInsert } from "@/integrations/supabase/types";
import { defaultServiceRows } from "@/lib/default-services";
import { createSubscription } from "@/lib/subscriptions";

const STARTER_PLANS = [
  {
    name: "Básico",
    price_cents: 9990,
    cycle_days: 30,
    cuts_included: 2,
    beards_included: 0,
    extras_included: 1,
    usage_limit: 3,
    benefits: "2 cortes por mês + 1 benefício extra",
  },
  {
    name: "Completo",
    price_cents: 13990,
    cycle_days: 30,
    cuts_included: 4,
    beards_included: 2,
    extras_included: 2,
    usage_limit: 8,
    benefits: "4 cortes + 2 barbas + 2 benefícios extras",
  },
  {
    name: "Premium",
    price_cents: 29990,
    cycle_days: 30,
    cuts_included: 20,
    beards_included: 20,
    extras_included: 10,
    usage_limit: 50,
    benefits: "Cortes e barbas à vontade + 10 benefícios extras",
  },
] as const;

const STARTER_BARBERS = [
  {
    name: "Barbeiro 1",
    commission_pct: 50,
    work_days: [1, 2, 3, 4, 5, 6],
    start_time: "09:00",
    end_time: "20:00",
    bio: "Especialista em cortes clássicos.",
  },
  {
    name: "Barbeiro 2",
    commission_pct: 50,
    work_days: [1, 2, 3, 4, 5],
    start_time: "10:00",
    end_time: "19:00",
    bio: "Fade, degradê e barba.",
  },
];

const DEMO_CUSTOMERS = [
  {
    name: "Cliente Demonstração 1",
    phone: "11999990001",
    email: "cliente1@exemplo.com",
    cpf: "11144477735",
    notes: "Cliente fictício criado automaticamente para demonstração.",
    points: 20,
  },
  {
    name: "Cliente Demonstração 2",
    phone: "11999990002",
    email: "cliente2@exemplo.com",
    cpf: "52998224725",
    notes: "Cliente fictício criado automaticamente para demonstração.",
    points: 35,
  },
];

async function countOf(table: "services" | "barbers" | "subscription_plans" | "customers" | "appointments", shopId: string) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", shopId);
  return count ?? 0;
}

function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export async function seedStarterData(shopId: string) {
  /* ---------- serviços ---------- */
  if ((await countOf("services", shopId)) === 0) {
    await supabase.from("services").insert(defaultServiceRows(shopId));
  }
  const { data: services } = await supabase
    .from("services")
    .select("id, name, price_cents, duration_min, benefit_kind")
    .eq("barbershop_id", shopId)
    .eq("active", true)
    .order("sort_order");

  /* ---------- barbeiros ---------- */
  if ((await countOf("barbers", shopId)) === 0) {
    await supabase
      .from("barbers")
      .insert(STARTER_BARBERS.map((b) => ({ ...b, barbershop_id: shopId })));
  }
  const { data: barbers } = await supabase
    .from("barbers")
    .select("id")
    .eq("barbershop_id", shopId)
    .eq("active", true)
    .order("created_at");

  /* ---------- planos de teste ---------- */
  if ((await countOf("subscription_plans", shopId)) === 0) {
    await supabase
      .from("subscription_plans")
      .insert(STARTER_PLANS.map((p) => ({ ...p, barbershop_id: shopId, active: true })));
  }
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("id, name")
    .eq("barbershop_id", shopId)
    .eq("active", true)
    .order("price_cents");

  /* ---------- clientes de demonstração ---------- */
  if ((await countOf("customers", shopId)) > 0) return; // barbearia já tem clientes: nada a fazer
  const { data: customers } = await supabase
    .from("customers")
    .insert(DEMO_CUSTOMERS.map((c) => ({ ...c, barbershop_id: shopId })))
    .select("id, name, phone, cpf");
  if (!customers?.length || !plans?.length) return;

  /* ---------- assinaturas fictícias ativas (uma por cliente) ---------- */
  const subscriptionIds: (string | null)[] = [];
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i]!;
    const plan = plans[Math.min(i + 1, plans.length - 1)]!; // Completo e Premium
    try {
      const { subscription_id } = await createSubscription(shopId, customer.id, plan.id);
      const now = new Date().toISOString();
      await supabase
        .from("customer_subscriptions")
        .update({ payment_status: "paid", last_payment_at: now })
        .eq("id", subscription_id);
      await supabase
        .from("subscription_payments")
        .update({ status: "paid", method: "pix", paid_at: now })
        .eq("subscription_id", subscription_id)
        .eq("status", "pending");
      subscriptionIds.push(subscription_id);
    } catch {
      subscriptionIds.push(null);
    }
  }

  /* ---------- agendamentos de demonstração ---------- */
  if (!services?.length || !barbers?.length) return;
  if ((await countOf("appointments", shopId)) > 0) return;

  const cutService = services.find((s) => s.benefit_kind === "cut") ?? services[0]!;
  const beardService = services.find((s) => s.benefit_kind === "beard") ?? services[0]!;
  const slots: { customer: number; dayOffset: number; hour: number; minute: number; service: typeof cutService; done: boolean }[] = [
    { customer: 0, dayOffset: -3, hour: 10, minute: 0, service: cutService, done: true },
    { customer: 1, dayOffset: -1, hour: 15, minute: 30, service: beardService, done: true },
    { customer: 0, dayOffset: 0, hour: 14, minute: 0, service: cutService, done: false },
    { customer: 1, dayOffset: 0, hour: 16, minute: 0, service: beardService, done: false },
    { customer: 0, dayOffset: 2, hour: 11, minute: 0, service: beardService, done: false },
    { customer: 1, dayOffset: 3, hour: 17, minute: 0, service: cutService, done: false },
  ];

  const rows: TablesInsert<"appointments">[] = slots.map((s, i) => {
    const customer = customers[s.customer]!;
    const start = at(s.dayOffset, s.hour, s.minute);
    const end = new Date(start.getTime() + s.service.duration_min * 60000);
    const subId = subscriptionIds[s.customer];
    const useBenefit = !!subId && !!s.service.benefit_kind;
    const isPast = start.getTime() < Date.now();
    return {
      barbershop_id: shopId,
      barber_id: barbers[i % barbers.length]!.id,
      service_id: s.service.id,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_cpf: customer.cpf,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      price_cents: s.done && useBenefit ? 0 : s.service.price_cents,
      status: s.done || isPast ? "done" : "scheduled",
      source: i % 2 === 0 ? "online" : "internal",
      subscription_id: subId ?? null,
      use_benefit: useBenefit,
      benefit_kind: useBenefit ? s.service.benefit_kind : null,
      benefit_processed: false,
      payment_method: useBenefit ? "subscription" : i % 2 === 0 ? "pix" : "on_site",
      payment_state: s.done || isPast ? "paid" : "pending",
      notes: "Agendamento de demonstração",
    };
  });
  await supabase.from("appointments").insert(rows);
}
