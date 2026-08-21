/**
 * Dados de demonstração usados apenas na visualização pública do Dashboard
 * (visitante sem login). Não tocam no banco e não afetam a área logada.
 */

export type DemoAppt = {
  id: string;
  starts_at: string;
  price_cents: number;
  status: string;
  customer_name: string;
  barber_id: string | null;
  service_id: string | null;
};

const SERVICES = [
  { id: "s1", name: "Navalhado", price: 5000 },
  { id: "s2", name: "Corte Máquina", price: 4000 },
  { id: "s3", name: "Corte Tesoura", price: 5500 },
  { id: "s4", name: "Barba", price: 3500 },
  { id: "s5", name: "Sobrancelha", price: 2000 },
  { id: "s6", name: "Corte Infantil", price: 4000 },
  { id: "s7", name: "Pigmentação", price: 4500 },
  { id: "s8", name: "Reflexo", price: 9000 },
  { id: "s9", name: "Nevou", price: 12000 },
];

const BARBERS = [
  { id: "b1", name: "João Ferraz" },
  { id: "b2", name: "Pedro Alves" },
  { id: "b3", name: "Caio Mendes" },
];

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
];

export function demoDashboardData() {
  const appts: DemoAppt[] = [];
  let seq = 0;

  for (let offset = -30; offset <= 7; offset++) {
    const past = offset < 0;
    const perDay = past ? 6 + (Math.abs(offset) % 3) : 4 + (offset % 2);
    for (let i = 0; i < perDay; i++) {
      const start = new Date();
      start.setDate(start.getDate() + offset);
      start.setHours(9 + ((i * 2 + Math.abs(offset)) % 10), i % 2 === 0 ? 0 : 30, 0, 0);
      const service = SERVICES[(i + Math.abs(offset)) % SERVICES.length]!;
      const barber = BARBERS[(i + Math.abs(offset)) % BARBERS.length]!;
      seq += 1;
      appts.push({
        id: `demo-${seq}`,
        starts_at: start.toISOString(),
        price_cents: service.price,
        status: past ? (seq % 17 === 0 ? "no_show" : seq % 23 === 0 ? "canceled" : "done") : "scheduled",
        customer_name: NAMES[seq % NAMES.length]!,
        barber_id: barber.id,
        service_id: service.id,
      });
    }
  }

  const customers = NAMES.map((_, i) => {
    const created = new Date();
    created.setDate(created.getDate() - i * 4);
    return { id: `c${i}`, created_at: created.toISOString() };
  });

  return {
    appts,
    customers,
    barbers: BARBERS.map((b) => ({ id: b.id, name: b.name })),
    services: SERVICES.map((s) => ({ id: s.id, name: s.name })),
  };
}
