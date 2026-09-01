/**
 * Regras e utilitários do módulo de assinaturas.
 * As validações críticas (saldo, consumo, estorno, permissão) ficam no banco;
 * aqui ficam apenas formatação, tipos e chamadas às funções do servidor.
 */
import { supabase } from "@/lib/supabase-guard";
import { friendlyError } from "@/lib/errors";

export type BenefitKind = "cut" | "beard" | "extra";


export const BENEFIT_LABEL: Record<BenefitKind, string> = {
  cut: "Corte",
  beard: "Barba",
  extra: "Outro benefício",
};

export type Plan = {
  id: string;
  barbershop_id: string;
  name: string;
  price_cents: number;
  cuts_included: number;
  beards_included: number;
  extras_included: number;
  cycle_days: number;
  usage_limit: number | null;
  benefits: string | null;
  active: boolean;
};

export type Subscription = {
  id: string;
  barbershop_id: string;
  customer_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  payment_status: PaymentStatus;
  price_cents: number;
  started_on: string;
  next_payment: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

export type CycleBalance = {
  cycle_id: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  cycle_status: string;
  cuts_credits: number;
  beards_credits: number;
  extras_credits: number;
  cuts_used: number;
  beards_used: number;
  extras_used: number;
  cuts_left: number;
  beards_left: number;
  extras_left: number;
};

export type SubscriptionStatus =
  | "active"
  | "pending"
  | "suspended"
  | "cancelled"
  | "expired";

export type PaymentStatus = "paid" | "pending" | "failed" | "refunded" | "cancelled";

export const SUB_STATUS: Record<SubscriptionStatus, { label: string; dot: string; tone: string }> = {
  active: { label: "Ativa", dot: "🟢", tone: "bg-success/15 text-success border-success/40" },
  pending: { label: "Pendente", dot: "🟡", tone: "bg-warning/15 text-warning border-warning/40" },
  suspended: { label: "Suspensa", dot: "🟠", tone: "bg-warning/15 text-warning border-warning/40" },
  cancelled: { label: "Cancelada", dot: "⚫", tone: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expirada", dot: "🔴", tone: "bg-destructive/15 text-destructive border-destructive/40" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  failed: "Falhou",
  refunded: "Estornado",
  cancelled: "Cancelado",
};

/* ---------- CPF ---------- */

export function cpfDigits(value: string) {
  return (value ?? "").replace(/\D/g, "").slice(0, 11);
}

export function cpfMask(value: string) {
  const d = cpfDigits(value);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Máscara parcial usada nas telas de atendimento: 123.***.***-00 */
export function cpfPartial(value: string | null | undefined) {
  const d = cpfDigits(value ?? "");
  if (d.length !== 11) return value ?? "—";
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

/** Validação real de CPF (dígitos verificadores). */
export function isValidCpf(value: string) {
  const d = cpfDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/* ---------- ciclo / saldo ---------- */

export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const diff = new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
}

export function creditsLeft(balance: CycleBalance | null | undefined, kind: BenefitKind) {
  if (!balance) return 0;
  if (kind === "cut") return balance.cuts_left;
  if (kind === "beard") return balance.beards_left;
  return balance.extras_left;
}

export function creditsTotal(balance: CycleBalance | null | undefined, kind: BenefitKind) {
  if (!balance) return 0;
  if (kind === "cut") return balance.cuts_credits;
  if (kind === "beard") return balance.beards_credits;
  return balance.extras_credits;
}

/** A assinatura só pode consumir benefícios se estiver ativa e dentro do ciclo. */
export function canUseBenefits(sub: Subscription | null, balance: CycleBalance | null) {
  if (!sub || sub.status !== "active" || !balance) return false;
  return new Date(`${balance.period_end}T23:59:59`).getTime() > Date.now();
}

/* ---------- chamadas ao servidor ---------- */

export type CpfLookup = {
  found: boolean;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    cpf: string | null;
    birth_date: string | null;
    notes: string | null;
    points: number;
  };
  subscription?: Subscription | null;
  plan?: Plan | null;
  balance?: CycleBalance | null;
};

export async function lookupCustomerByCpf(shopId: string, cpf: string): Promise<CpfLookup> {
  const { data, error } = await supabase.rpc("customer_by_cpf", { _shop: shopId, _cpf: cpfDigits(cpf) });
  if (error) throw new Error(friendlyError(error.message));
  return (data ?? { found: false }) as unknown as CpfLookup;
}

export type LocalPaymentMethod = "pix" | "pix_qr" | "card" | "cash";

export async function completeAppointment(appointmentId: string, paymentMethod?: LocalPaymentMethod) {
  const { data, error } = await supabase.rpc("complete_appointment", {
    _appointment_id: appointmentId,
    ...(paymentMethod ? { _payment_method: paymentMethod } : {}),
  });
  if (error) throw new Error(friendlyError(error.message));
  return data as unknown as {
    consumed: boolean;
    benefit_kind: BenefitKind | null;
    left: number;
    payment_method: string;
  };
}

export async function refundAppointmentBenefit(appointmentId: string, reason: string) {
  const { data, error } = await supabase.rpc("refund_appointment_benefit", {
    _appointment_id: appointmentId,
    _reason: reason,
  });
  if (error) throw new Error(friendlyError(error.message));
  return data as unknown as { refunded: boolean; already?: boolean };
}

export async function createSubscription(shopId: string, customerId: string, planId: string) {
  const { data, error } = await supabase.rpc("create_subscription", {
    _shop: shopId,
    _customer_id: customerId,
    _plan_id: planId,
  });
  if (error) throw new Error(friendlyError(error.message));
  return data as unknown as { subscription_id: string; cycle_id: string };
}

export async function cancelSubscription(subscriptionId: string, reason: string) {
  const { error } = await supabase.rpc("cancel_subscription", {
    _subscription_id: subscriptionId,
    _reason: reason,
  });
  if (error) throw new Error(friendlyError(error.message));
}

export async function renewCycle(subscriptionId: string) {
  const { error } = await supabase.rpc("ensure_subscription_cycle", {
    _subscription_id: subscriptionId,
  });
  if (error) throw new Error(friendlyError(error.message));
}

export { friendlyError };



