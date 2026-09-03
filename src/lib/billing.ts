/**
 * Cobrança por atendimento da plataforma Navalha Pro.
 *
 * Regras (aplicadas no banco):
 *  - 250 atendimentos concluídos grátis por barbearia.
 *  - Depois disso, R$ 0,20 por atendimento concluído, acumulado em ciclos de 30 dias.
 *  - Cancelamentos, faltas e agendamentos não concluídos não geram cobrança.
 *  - Fim do ciclo: cobrança Pix. Prazo de 5 dias; depois "Cobrança pendente" por 5 dias;
 *    depois "Suspensa" (bloqueia novos agendamentos e funções administrativas).
 *  - Pagamento confirmado por webhook reativa a conta automaticamente.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

export type BillingStatus = "active" | "pending" | "suspended";

export type BillingOverview = {
  status: BillingStatus;
  free_quota: number;
  free_used: number;
  free_left: number;
  unit_price_cents: number;
  cycle_days: number;
  payment_days: number;
  pending_days: number;
  billed_total: number;
  billed_amount_cents: number;
  cycle: {
    id: string;
    period_start: string;
    period_end: string;
    billed_count: number;
    amount_cents: number;
  } | null;
  open_invoice: {
    id: string;
    amount_cents: number;
    appointments_count: number;
    period_start: string;
    period_end: string;
    due_date: string;
    suspend_at: string;
    pix_txid: string;
  } | null;
  platform_pix: { key: string; key_type: string | null; holder_name: string | null } | null;
};

export type BillingInvoice = {
  id: string;
  amount_cents: number;
  appointments_count: number;
  period_start: string;
  period_end: string;
  due_date: string;
  suspend_at: string;
  status: "pending" | "paid" | "cancelled";
  pix_txid: string;
  paid_at: string | null;
  created_at: string;
};

export const BILLING_STATUS: Record<
  BillingStatus,
  { label: string; tone: string; description: string }
> = {
  active: {
    label: "Em dia",
    tone: "bg-success/15 text-success border-success/40",
    description: "Sua conta está regular.",
  },
  pending: {
    label: "Cobrança pendente",
    tone: "bg-warning/15 text-warning border-warning/40",
    description: "Há uma cobrança vencida. Pague via Pix para evitar a suspensão.",
  },
  suspended: {
    label: "Suspensa",
    tone: "bg-destructive/15 text-destructive border-destructive/40",
    description:
      "Novos agendamentos e funções administrativas estão bloqueados até a confirmação do pagamento. Seus dados estão preservados.",
  },
};

export async function fetchBillingOverview(shopId: string): Promise<BillingOverview> {
  const { data, error } = await supabase.rpc("my_billing_overview", { _shop: shopId });
  if (error) throw new Error(friendlyError(error.message));
  return data as unknown as BillingOverview;
}

export async function fetchBillingInvoices(shopId: string): Promise<BillingInvoice[]> {
  const { data, error } = await supabase
    .from("billing_invoices")
    .select(
      "id, amount_cents, appointments_count, period_start, period_end, due_date, suspend_at, status, pix_txid, paid_at, created_at",
    )
    .eq("barbershop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(friendlyError(error.message));
  return (data ?? []) as BillingInvoice[];
}

/** Dias restantes até a data (negativo = já passou). */
export function daysTo(date: string) {
  const target = new Date(`${date}T00:00:00`).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}
