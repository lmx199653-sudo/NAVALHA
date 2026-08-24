/**
 * Base de demonstração usada quando o visitante navega pelo sistema sem login.
 * Nada aqui toca o banco de dados real — é apenas conteúdo de visualização.
 */
import type { Shop } from "@/hooks/useShop";

export const DEMO_SHOP_ID = "demo-shop";

export const demoShop: Shop = {
  id: DEMO_SHOP_ID,
  
  name: "Navalha Pro",
  slug: "navalha-pro",
  description: "Barbearia demonstração — explore o sistema à vontade.",
  address: "Av. Paulista, 1000 — São Paulo/SP",
  phone: "11999990000",
  whatsapp: "11999990000",
  instagram: "navalhapro",
  logo_url: null,
  cover_url: null,
  accent_color: "#d4a017",
  secondary_color: "#1c1c1c",
  bg_color: "#0d0d0d",
  font_family: "Bebas Neue",
  brand_style: null,
  brand_symbol: null,
  template: "classic",
  onboarding_done: true,
};

const SERVICES = [
  { name: "Navalhado", price_cents: 5000, duration_min: 40 },
  { name: "Corte Máquina", price_cents: 4000, duration_min: 30 },
  { name: "Corte Tesoura", price_cents: 5500, duration_min: 45 },
  { name: "Barba", price_cents: 3500, duration_min: 30 },
  { name: "Sobrancelha", price_cents: 2000, duration_min: 15 },
  { name: "Corte Infantil", price_cents: 4000, duration_min: 30 },
  { name: "Pigmentação", price_cents: 4500, duration_min: 30 },
  { name: "Reflexo", price_cents: 9000, duration_min: 60 },
  { name: "Nevou", price_cents: 12000, duration_min: 90 },
];

const BARBER_NAMES = ["João Ferraz", "Pedro Alves", "Caio Mendes"];

const CUSTOMER_NAMES = [
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
  "Renan Batista",
];

function iso(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const services = SERVICES.map((s, i) => ({
  id: `demo-service-${i + 1}`,
  barbershop_id: DEMO_SHOP_ID,
  created_at: iso(-90, 9),
  description: null,
  duration_min: s.duration_min,
  image_url: null,
  name: s.name,
  price_cents: s.price_cents,
  sort_order: i + 1,
  active: true,
}));

const barbers = BARBER_NAMES.map((name, i) => ({
  id: `demo-barber-${i + 1}`,
  barbershop_id: DEMO_SHOP_ID,
  name,
  bio: "Profissional da casa",
  photo_url: null,
  active: true,
  commission_pct: 40,
  created_at: iso(-120, 9),
  start_time: "09:00",
  end_time: "20:00",
  work_days: [1, 2, 3, 4, 5, 6],
}));

const customers = CUSTOMER_NAMES.map((name, i) => ({
  id: `demo-customer-${i + 1}`,
  barbershop_id: DEMO_SHOP_ID,
  name,
  phone: `1198${String(700000 + i * 137).slice(0, 6)}`,
  email: null,
  cpf: `${String(12345678900 + i * 111).slice(0, 11)}`,
  notes: null,
  birth_date: iso(-((i % 12) * 30) - 9000, 12).slice(0, 10),
  created_at: iso(-(i * 4 + 3), 10),
  points: 120 - i * 8,
}));

const appointments = (() => {
  const rows: Record<string, unknown>[] = [];
  let seq = 0;
  for (let offset = -30; offset <= 7; offset++) {
    const past = offset < 0;
    const perDay = past ? 6 + (Math.abs(offset) % 3) : 4 + (Math.abs(offset) % 3);
    for (let i = 0; i < perDay; i++) {
      seq += 1;
      const service = services[(i + Math.abs(offset)) % services.length]!;
      const barber = barbers[(i + Math.abs(offset)) % barbers.length]!;
      const customer = customers[seq % customers.length]!;
      const hour = 9 + ((i * 2 + Math.abs(offset)) % 10);
      const minute = i % 2 === 0 ? 0 : 30;
      rows.push({
        id: `demo-appt-${seq}`,
        barbershop_id: DEMO_SHOP_ID,
        barber_id: barber.id,
        service_id: service.id,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_cpf: null,
        notes: null,
        source: "online",
        price_cents: service.price_cents,
        status: past
          ? seq % 17 === 0
            ? "no_show"
            : seq % 23 === 0
              ? "canceled"
              : "done"
          : "scheduled",
        starts_at: iso(offset, hour, minute),
        ends_at: iso(offset, hour + 1, minute),
        created_at: iso(offset - 2, 12),
      });
    }
  }
  return rows;
})();

const business_hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: `demo-hours-${weekday}`,
  barbershop_id: DEMO_SHOP_ID,
  weekday,
  open_time: "09:00",
  close_time: weekday === 6 ? "18:00" : "20:00",
  closed: weekday === 0,
}));

const schedule_breaks = [
  {
    id: "demo-break-1",
    barbershop_id: DEMO_SHOP_ID,
    barber_id: null,
    name: "Almoço",
    start_time: "12:00",
    end_time: "13:00",
    weekdays: [1, 2, 3, 4, 5],
    specific_date: null,
    created_at: iso(-60, 9),
    updated_at: iso(-60, 9),
  },
];

const subscription_plans = [
  {
    id: "demo-plan-1",
    barbershop_id: DEMO_SHOP_ID,
    name: "Clube do Corte",
    price_cents: 8900,
    cuts_included: 4,
    beards_included: 2,
    benefits: "4 cortes + 2 barbas por mês",
    active: true,
    created_at: iso(-90, 9),
  },
  {
    id: "demo-plan-2",
    barbershop_id: DEMO_SHOP_ID,
    name: "Clube Premium",
    price_cents: 14900,
    cuts_included: 8,
    beards_included: 4,
    benefits: "Cortes ilimitados na semana + barba",
    active: true,
    created_at: iso(-90, 9),
  },
];

const loyalty_rewards = [
  {
    id: "demo-reward-1",
    barbershop_id: DEMO_SHOP_ID,
    name: "Corte grátis",
    points_cost: 100,
    active: true,
    created_at: iso(-90, 9),
  },
];

export const demoTables: Record<string, Record<string, unknown>[]> = {
  barbershops: [demoShop as unknown as Record<string, unknown>],
  services,
  barbers,
  customers,
  appointments,
  business_hours,
  schedule_breaks,
  subscription_plans,
  loyalty_rewards,
  barbershop_members: [],
  push_subscriptions: [],
  user_subscriptions: [],
};
