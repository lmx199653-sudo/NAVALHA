import { timeLabel } from "@/lib/format";

export type View = "day" | "week" | "month";

export const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);

export const statusTone: Record<string, string> = {
  scheduled: "border-warning/30 bg-warning/10 text-warning",
  confirmed: "border-primary/40 bg-primary/10 text-primary",
  done: "border-success/30 bg-success/10 text-success",
  canceled: "border-border bg-muted/50 text-muted-foreground",
  no_show: "border-destructive/30 bg-destructive/10 text-destructive",
  blocked: "border-border bg-secondary text-muted-foreground",
};

export const statusDot: Record<string, string> = {
  scheduled: "bg-warning",
  confirmed: "bg-primary",
  done: "bg-success",
  canceled: "bg-muted-foreground",
  no_show: "bg-destructive",
  blocked: "bg-muted-foreground",
};

export const FALLBACK_STATUS = "blocked";

export type Appointment = {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  service_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_cpf?: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  payment_method?: string | null;
  payment_state?: string | null;
  source?: string | null;
  use_benefit?: boolean | null;
  benefit_kind?: string | null;
  benefit_processed?: boolean | null;
  subscription_id?: string | null;
};

export type BarberSummary = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export type ServiceSummary = {
  id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  benefit_kind?: string | null;
  [key: string]: unknown;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
};

export function durationMin(startsAt: string, endsAt: string) {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
}

export function isToday(d: Date) {
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function reminderText(shopName: string, name: string, iso: string) {
  return `Olá ${name}! Seu horário na ${shopName} é às ${timeLabel(iso)} — já pode vir vindo, te esperamos em 10 minutos. 💈`;
}

export function waLink(phone: string | null | undefined, text: string) {
  return `https://wa.me/55${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
