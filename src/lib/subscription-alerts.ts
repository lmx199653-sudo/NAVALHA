/**
 * Motor de alertas do módulo de assinaturas.
 * Puro (sem chamadas ao servidor): recebe os dados carregados e devolve
 * uma lista priorizada de alertas com as ações rápidas cabíveis.
 */
import { daysUntil, type CycleBalance, type Plan, type Subscription } from "@/lib/subscriptions";

export type AlertCustomer = { id: string; name: string; phone: string | null; cpf: string | null };

export type PaymentRow = {
  id: string;
  subscription_id: string;
  amount_cents: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
};

export type SubscriptionRow = {
  sub: Subscription;
  customer: AlertCustomer | null;
  plan: Plan | null;
  balance: CycleBalance | null;
  payments: PaymentRow[];
};

export type AlertKind =
  | "payment_overdue"
  | "payment_pending"
  | "renewal_due"
  | "due_soon"
  | "ending_soon"
  | "credits_out";

export type AlertAction = "charge" | "mark_paid" | "renew" | "cancel" | "notify";

export type SubscriptionAlert = {
  id: string;
  kind: AlertKind;
  priority: number; // menor = mais urgente
  title: string;
  detail: string;
  actions: AlertAction[];
  row: SubscriptionRow;
  days?: number;
};

export const ALERT_META: Record<
  AlertKind,
  { label: string; tone: "danger" | "warning" | "info" | "gold" }
> = {
  payment_overdue: { label: "Pagamento atrasado", tone: "danger" },
  payment_pending: { label: "Pagamento pendente", tone: "warning" },
  renewal_due: { label: "Renovação", tone: "gold" },
  due_soon: { label: "Vencimento próximo", tone: "warning" },
  ending_soon: { label: "Assinatura terminando", tone: "info" },
  credits_out: { label: "Sem créditos", tone: "info" },
};

/** Quantos dias de tolerância antes de um pagamento pendente virar "atrasado". */
export const OVERDUE_AFTER_DAYS = 3;
/** Janela de aviso de vencimento / fim de ciclo. */
export const SOON_WINDOW_DAYS = 5;

export function pendingPaymentOf(row: SubscriptionRow) {
  return (
    row.payments
      .filter((p) => p.status === "pending" || p.status === "failed")
      .sort((a, b) => ((a.due_date ?? "") < (b.due_date ?? "") ? 1 : -1))[0] ?? null
  );
}

export function buildAlerts(rows: SubscriptionRow[]): SubscriptionAlert[] {
  const out: SubscriptionAlert[] = [];

  for (const row of rows) {
    const { sub, customer, balance } = row;
    if (sub.status !== "active" && sub.status !== "pending") continue;
    const name = customer?.name ?? "Cliente";

    /* -------- pagamento -------- */
    if (sub.payment_status !== "paid") {
      const pending = pendingPaymentOf(row);
      const dueDays = daysUntil(pending?.due_date ?? sub.started_on);
      const overdue = dueDays !== null && dueDays < -OVERDUE_AFTER_DAYS;
      out.push({
        id: `${sub.id}-pay`,
        kind: overdue ? "payment_overdue" : "payment_pending",
        priority: overdue ? 0 : 2,
        title: name,
        detail: overdue
          ? `Em atraso há ${Math.abs(dueDays!)} dias`
          : dueDays !== null && dueDays < 0
            ? `Aguardando há ${Math.abs(dueDays)} dia(s)`
            : "Aguardando pagamento do ciclo",
        actions: overdue ? ["charge", "mark_paid", "cancel"] : ["charge", "mark_paid"],
        row,
        days: dueDays ?? undefined,
      });
    }

    /* -------- ciclo / renovação -------- */
    if (balance) {
      const left = daysUntil(balance.period_end);
      if (left !== null && left <= 0) {
        out.push({
          id: `${sub.id}-renew`,
          kind: "renewal_due",
          priority: 1,
          title: name,
          detail:
            left === 0 ? "Ciclo termina hoje — renove para liberar créditos" : `Ciclo encerrado há ${Math.abs(left)} dia(s)`,
          actions: ["renew", "notify", "cancel"],
          row,
          days: left,
        });
      } else if (left !== null && left <= SOON_WINDOW_DAYS) {
        const paid = sub.payment_status === "paid";
        out.push({
          id: `${sub.id}-soon`,
          kind: paid ? "ending_soon" : "due_soon",
          priority: 3,
          title: name,
          detail: paid
            ? `Assinatura termina em ${left} dia(s) — confirme a renovação`
            : `Vence em ${left} dia(s)`,
          actions: paid ? ["notify"] : ["charge", "notify"],
          row,
          days: left,
        });
      }

      if (left !== null && left > 0 && balance.cuts_left === 0 && balance.cuts_credits > 0) {
        out.push({
          id: `${sub.id}-credits`,
          kind: "credits_out",
          priority: 4,
          title: name,
          detail: `Sem cortes restantes neste ciclo (renova em ${left} dia(s))`,
          actions: ["notify"],
          row,
          days: left,
        });
      }
    } else {
      out.push({
        id: `${sub.id}-nocycle`,
        kind: "renewal_due",
        priority: 1,
        title: name,
        detail: "Nenhum ciclo aberto — renove para liberar créditos",
        actions: ["renew"],
        row,
      });
    }
  }

  return out.sort((a, b) => a.priority - b.priority || (a.days ?? 0) - (b.days ?? 0));
}

export function summarizeAlerts(alerts: SubscriptionAlert[]) {
  const count = (k: AlertKind) => alerts.filter((a) => a.kind === k).length;
  return {
    overdue: count("payment_overdue"),
    pending: count("payment_pending"),
    renewal: count("renewal_due"),
    dueSoon: count("due_soon") + count("ending_soon"),
    total: alerts.length,
  };
}

/** Mensagem de cobrança amigável enviada via WhatsApp. */
export function chargeMessage(row: SubscriptionRow, shopName: string, pixKey?: string | null) {
  const name = row.customer?.name?.split(" ")[0] ?? "";
  const plan = row.plan?.name ?? "assinatura";
  const value = (row.sub.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pix = pixKey ? `\n\nChave Pix: ${pixKey}` : "";
  return `Olá, ${name}! Aqui é da ${shopName}. O pagamento do seu plano ${plan} (${value}) está pendente. Pode regularizar quando puder para manter seus benefícios ativos?${pix}`;
}

export function renewalMessage(row: SubscriptionRow, shopName: string) {
  const name = row.customer?.name?.split(" ")[0] ?? "";
  const plan = row.plan?.name ?? "assinatura";
  const end = row.balance?.period_end
    ? new Date(`${row.balance.period_end}T00:00:00`).toLocaleDateString("pt-BR")
    : "em breve";
  return `Olá, ${name}! Aqui é da ${shopName}. Seu plano ${plan} renova em ${end}. Quer garantir a renovação e continuar com seus benefícios?`;
}
