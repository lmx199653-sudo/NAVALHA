/**
 * Ações de gerenciamento de assinantes (criar, pagar, renovar, trocar plano,
 * editar, suspender/reativar e histórico). Todas passam pelo RLS da barbearia.
 */
import { supabase } from "@/lib/supabase-guard";
import { toDayKey } from "@/lib/format";
import {
  createSubscription,
  friendlyError,
  renewCycle,
  type Plan,
  type Subscription,
} from "@/lib/subscriptions";
import type { SubscriptionRow } from "@/lib/subscription-alerts";

export type PayMethod = "pix" | "card" | "cash" | "manual";

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  cash: "Dinheiro",
  manual: "Outro",
};

export function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDayKey(d);
}

export const today = () => toDayKey(new Date());

async function audit(shopId: string, action: string, entityId: string, after: unknown) {
  // Registro best-effort: nunca bloqueia a ação principal.
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    barbershop_id: shopId,
    user_id: auth.user?.id ?? null,
    action,
    entity: "customer_subscriptions",
    entity_id: entityId,
    after_data: after as never,
  });
}

function fail(message: string): never {
  throw new Error(friendlyError(message));
}

/* ---------- pagamento ---------- */

export async function registerPayment(row: SubscriptionRow, method: PayMethod, amountCents?: number) {
  const now = new Date().toISOString();
  const amount = amountCents ?? row.sub.price_cents;
  const { error } = await supabase
    .from("customer_subscriptions")
    .update({ payment_status: "paid", last_payment_at: now, status: row.sub.status === "pending" ? "active" : row.sub.status })
    .eq("id", row.sub.id);
  if (error) fail(error.message);

  const pending = row.payments.find((p) => p.status === "pending" || p.status === "failed");
  if (pending) {
    const { error: upErr } = await supabase
      .from("subscription_payments")
      .update({ status: "paid", method, paid_at: now, amount_cents: amount })
      .eq("id", pending.id);
    if (upErr) fail(upErr.message);
  } else {
    const { error: insErr } = await supabase.from("subscription_payments").insert({
      barbershop_id: row.sub.barbershop_id,
      subscription_id: row.sub.id,
      cycle_id: row.balance?.cycle_id ?? null,
      amount_cents: amount,
      status: "paid",
      method,
      paid_at: now,
    });
    if (insErr) fail(insErr.message);
  }
  await audit(row.sub.barbershop_id, "subscription.payment_registered", row.sub.id, { method, amount });
}

/* ---------- renovação ---------- */

export async function renewSubscription(row: SubscriptionRow) {
  const cycle = await renewCycle(row.sub.id);
  const isNewCycle = !!cycle && cycle.id !== row.balance?.cycle_id;
  if (isNewCycle) {
    const { error } = await supabase
      .from("customer_subscriptions")
      .update({ payment_status: "pending" })
      .eq("id", row.sub.id);
    if (error) fail(error.message);
    const { error: payErr } = await supabase.from("subscription_payments").insert({
      barbershop_id: row.sub.barbershop_id,
      subscription_id: row.sub.id,
      cycle_id: cycle!.id,
      amount_cents: row.sub.price_cents,
      status: "pending",
      due_date: cycle!.period_start,
    });
    if (payErr) fail(payErr.message);
  }
  return isNewCycle;
}

/* ---------- plano ---------- */

export async function changePlan(row: SubscriptionRow, plan: Plan, applyNow: boolean) {
  const { error } = await supabase
    .from("customer_subscriptions")
    .update({ plan_id: plan.id, price_cents: plan.price_cents })
    .eq("id", row.sub.id);
  if (error) fail(error.message);

  if (applyNow && row.balance) {
    const { error: cycErr } = await supabase
      .from("subscription_cycles")
      .update({
        cuts_credits: plan.cuts_included,
        beards_credits: plan.beards_included,
        extras_credits: plan.extras_included ?? 0,
      })
      .eq("id", row.balance.cycle_id);
    if (cycErr) fail(cycErr.message);
  }
  await audit(row.sub.barbershop_id, "subscription.plan_changed", row.sub.id, {
    from: row.plan?.id ?? null,
    to: plan.id,
    applied_now: applyNow,
  });
}

/* ---------- edição ---------- */

export async function updateSubscription(
  row: SubscriptionRow,
  patch: { started_on: string; price_cents: number; period_end: string | null },
) {
  const { error } = await supabase
    .from("customer_subscriptions")
    .update({
      started_on: patch.started_on,
      price_cents: patch.price_cents,
      ...(patch.period_end ? { next_payment: patch.period_end } : {}),
    })
    .eq("id", row.sub.id);
  if (error) fail(error.message);

  if (row.balance && patch.period_end && patch.period_end !== row.balance.period_end) {
    const { error: cycErr } = await supabase
      .from("subscription_cycles")
      .update({ period_end: patch.period_end })
      .eq("id", row.balance.cycle_id);
    if (cycErr) fail(cycErr.message);
  }
  await audit(row.sub.barbershop_id, "subscription.updated", row.sub.id, patch);
}

/* ---------- suspender / reativar ---------- */

export async function setSubscriptionStatus(row: SubscriptionRow, status: "active" | "suspended") {
  const { error } = await supabase.from("customer_subscriptions").update({ status }).eq("id", row.sub.id);
  if (error) fail(error.message);
  if (status === "active") {
    // Garante ciclo vigente ao reativar (não cria cobrança se o ciclo atual ainda vale).
    await renewCycle(row.sub.id).catch(() => null);
  }
  await audit(row.sub.barbershop_id, status === "active" ? "subscription.reactivated" : "subscription.suspended", row.sub.id, {});
}

/* ---------- criação ---------- */

export async function createSubscriber(input: {
  shopId: string;
  customerId: string;
  plan: Plan;
  startedOn: string;
  dueDate: string;
  payNow: boolean;
  method: PayMethod;
}) {
  const { subscription_id, cycle_id } = await createSubscription(input.shopId, input.customerId, input.plan.id);
  const defaultDue = addDays(today(), input.plan.cycle_days ?? 30);
  const customDates = input.startedOn !== today() || input.dueDate !== defaultDue;

  if (customDates) {
    const { error } = await supabase
      .from("customer_subscriptions")
      .update({ started_on: input.startedOn, next_payment: input.dueDate })
      .eq("id", subscription_id);
    if (error) fail(error.message);
    const { error: cycErr } = await supabase
      .from("subscription_cycles")
      .update({ period_start: input.startedOn, period_end: input.dueDate })
      .eq("id", cycle_id);
    if (cycErr) fail(cycErr.message);
    await supabase
      .from("subscription_payments")
      .update({ due_date: input.startedOn })
      .eq("subscription_id", subscription_id)
      .eq("status", "pending");
  }

  if (input.payNow) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("customer_subscriptions")
      .update({ payment_status: "paid", last_payment_at: now })
      .eq("id", subscription_id);
    if (error) fail(error.message);
    const { error: payErr } = await supabase
      .from("subscription_payments")
      .update({ status: "paid", method: input.method, paid_at: now })
      .eq("subscription_id", subscription_id)
      .eq("status", "pending");
    if (payErr) fail(payErr.message);
  }
  return subscription_id;
}

/* ---------- histórico ---------- */

export type HistoryItem = {
  id: string;
  at: string;
  kind: "payment" | "usage" | "cycle" | "event";
  title: string;
  detail: string;
};

const ACTION_LABEL: Record<string, string> = {
  "subscription.created": "Assinatura criada",
  "subscription.cancelled": "Assinatura cancelada",
  "subscription.cycle_renewed": "Ciclo renovado",
  "subscription.payment_registered": "Pagamento registrado",
  "subscription.plan_changed": "Plano alterado",
  "subscription.updated": "Dados editados",
  "subscription.suspended": "Assinatura suspensa",
  "subscription.reactivated": "Assinatura reativada",
  "subscription.usage_refunded": "Crédito estornado",
};

export async function fetchHistory(sub: Subscription): Promise<HistoryItem[]> {
  const [payments, usages, cycles, logs] = await Promise.all([
    supabase
      .from("subscription_payments")
      .select("id, amount_cents, status, method, due_date, paid_at, created_at")
      .eq("subscription_id", sub.id),
    supabase
      .from("subscription_usages")
      .select("id, benefit_kind, kind, quantity, created_at, reason")
      .eq("subscription_id", sub.id),
    supabase
      .from("subscription_cycles")
      .select("id, period_start, period_end, status, created_at")
      .eq("subscription_id", sub.id),
    supabase
      .from("audit_logs")
      .select("id, action, created_at, after_data")
      .eq("entity_id", sub.id)
      .in("action", Object.keys(ACTION_LABEL)),
  ]);

  const fmt = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
  const BENEFIT: Record<string, string> = { cut: "Corte", beard: "Barba", extra: "Extra" };

  const items: HistoryItem[] = [];
  for (const p of payments.data ?? []) {
    items.push({
      id: `pay-${p.id}`,
      at: p.paid_at ?? p.created_at,
      kind: "payment",
      title: p.status === "paid" ? `Pagamento de ${fmt(p.amount_cents)}` : `Cobrança de ${fmt(p.amount_cents)}`,
      detail:
        p.status === "paid"
          ? `Recebido via ${PAY_METHOD_LABEL[(p.method as PayMethod) ?? "manual"] ?? p.method ?? "manual"}`
          : `Status: ${p.status === "pending" ? "pendente" : p.status}${p.due_date ? ` · vence ${day(p.due_date)}` : ""}`,
    });
  }
  for (const u of usages.data ?? []) {
    items.push({
      id: `use-${u.id}`,
      at: u.created_at,
      kind: "usage",
      title: u.kind === "refund" ? `Estorno de ${BENEFIT[u.benefit_kind] ?? u.benefit_kind}` : `${BENEFIT[u.benefit_kind] ?? u.benefit_kind} utilizado`,
      detail: u.reason ?? `${u.quantity} crédito(s)`,
    });
  }
  for (const c of cycles.data ?? []) {
    items.push({
      id: `cyc-${c.id}`,
      at: c.created_at,
      kind: "cycle",
      title: "Ciclo aberto",
      detail: `${day(c.period_start)} até ${day(c.period_end)} · ${c.status === "open" ? "em vigor" : "encerrado"}`,
    });
  }
  for (const l of logs.data ?? []) {
    if (l.action === "subscription.cycle_renewed" || l.action === "subscription.payment_registered") continue;
    const after = (l.after_data ?? {}) as Record<string, unknown>;
    items.push({
      id: `log-${l.id}`,
      at: l.created_at,
      kind: "event",
      title: ACTION_LABEL[l.action] ?? l.action,
      detail: typeof after["reason"] === "string" ? String(after["reason"]) : "",
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}
