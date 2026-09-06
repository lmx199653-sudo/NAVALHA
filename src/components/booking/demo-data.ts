import type { BreakRow, HoursRow } from "@/lib/slots";
import type { Barber, Service, Shop } from "./types";

export const DEMO_SHOP: Shop = {
  id: "demo-shop-001",
  name: "Barbearia Demo",
  slug: "demo",
  description: "Experimente o agendamento online da Navalha Pro sem compromisso.",
  address: "Rua Demo, 123 - Centro",
  phone: "11999999999",
  whatsapp: null,
  instagram: null,
  logo_url: null,
  cover_url: null,
  accent_color: "#E3B341",
  secondary_color: "#C08A2E",
  bg_color: "#0D0D10",
  font_family: "Bebas Neue",
  pix_key: "demo@navalhapro.app",
  pix_key_type: "email",
  pix_holder_name: "Barbearia Demo",
};

export const DEMO_SERVICES: Service[] = [
  {
    id: "demo-svc-01",
    name: "Corte Tesoura",
    description: "Corte tradicional com tesoura.",
    price_cents: 4500,
    duration_min: 45,
    image_url: null,
  },
  {
    id: "demo-svc-02",
    name: "Corte Máquina",
    description: "Corte com máquina e acabamento.",
    price_cents: 4000,
    duration_min: 40,
    image_url: null,
  },
  {
    id: "demo-svc-03",
    name: "Barba",
    description: "Barba completa com toalha quente.",
    price_cents: 3000,
    duration_min: 30,
    image_url: null,
  },
  {
    id: "demo-svc-04",
    name: "Navalhado",
    description: "Acabamento navalhado na zero.",
    price_cents: 2500,
    duration_min: 25,
    image_url: null,
  },
  {
    id: "demo-svc-05",
    name: "Sobrancelha",
    description: "Design de sobrancelha masculina.",
    price_cents: 2000,
    duration_min: 20,
    image_url: null,
  },
  {
    id: "demo-svc-06",
    name: "Pigmentação",
    description: "Pigmentação de barba ou cabelo.",
    price_cents: 6000,
    duration_min: 60,
    image_url: null,
  },
  {
    id: "demo-svc-07",
    name: "Reflexo",
    description: "Reflexo com produtos profissionais.",
    price_cents: 8000,
    duration_min: 90,
    image_url: null,
  },
  {
    id: "demo-svc-08",
    name: "Nevou",
    description: "Platinado/nevou masculino.",
    price_cents: 9000,
    duration_min: 120,
    image_url: null,
  },
];

export const DEMO_BARBERS: Barber[] = [
  {
    id: "demo-barber-01",
    name: "Barbeiro Demo",
    bio: "Especialista em cortes modernos e atendimento premium.",
    photo_url: null,
    work_days: [0, 1, 2, 3, 4, 5, 6],
    start_time: "09:00",
    end_time: "20:00",
  },
];

export const DEMO_HOURS: HoursRow[] = Array.from({ length: 7 }, (_, weekday) => ({
  id: `demo-hr-${weekday}`,
  barbershop_id: "demo-shop-001",
  weekday,
  open_time: "09:00:00",
  close_time: "20:00:00",
  closed: false,
}));

export const DEMO_BREAKS: BreakRow[] = [];

export const isDemo = (slug: string) => slug === "demo";
