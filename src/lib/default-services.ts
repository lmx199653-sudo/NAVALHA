import { serviceImage } from "@/lib/service-images";

/** Serviços padrão de toda barbearia nova — ordem fixa. O barbeiro pode editar, excluir e adicionar livremente. */
export const DEFAULT_SERVICES = [
  { name: "NAVALHADO", description: "Acabamento na navalha", price_cents: 5000, duration_min: 40, benefit_kind: "cut" },
  { name: "CORTE MÁQUINA", description: "Corte todo na máquina", price_cents: 4000, duration_min: 30, benefit_kind: "cut" },
  { name: "CORTE TESOURA", description: "Corte clássico na tesoura", price_cents: 5500, duration_min: 40, benefit_kind: "cut" },
  { name: "SOBRANCELHA", description: "Design masculino", price_cents: 2000, duration_min: 15, benefit_kind: "extra" },
  { name: "INFANTIL", description: "Atendimento para crianças", price_cents: 4000, duration_min: 30, benefit_kind: "cut" },
  { name: "BARBA", description: "Toalha quente e navalha", price_cents: 3500, duration_min: 30, benefit_kind: "beard" },
  { name: "REFLEXO", description: "Luzes e reflexos", price_cents: 9000, duration_min: 60, benefit_kind: "extra" },
  { name: "PIGMENTAÇÃO", description: "Preenchimento de barba", price_cents: 4500, duration_min: 45, benefit_kind: "extra" },
  { name: "NEVOU", description: "Descoloração global", price_cents: 12000, duration_min: 90, benefit_kind: "extra" },
] as const;

export function defaultServiceRows(shopId: string) {
  return DEFAULT_SERVICES.map((s, i) => ({
    barbershop_id: shopId,
    name: s.name,
    description: s.description,
    price_cents: s.price_cents,
    duration_min: s.duration_min,
    benefit_kind: s.benefit_kind,
    sort_order: i + 1,
    active: true,
    image_url: serviceImage(s.name),
  }));
}
