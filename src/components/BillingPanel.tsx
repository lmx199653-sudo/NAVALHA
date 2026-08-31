import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MercadoPagoConnect } from "@/components/MercadoPagoConnect";
import { supabase } from "@/lib/supabase-guard";
import { dateLabel } from "@/lib/format";
import {
  getBillingSummary,
  listPlatformPlans,
  payUsageFees,
  startPlatformSubscription,
} from "@/lib/payments.functions";

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SUB_LABEL: Record<string, string> = {
  active: "Ativa",
  pending: "Pendente",
  paused: "Pausada",
  cancelled: "Cancelada",
  expired: "Expirada",
  rejected: "Recusada",
};

const FEE_LABEL: Record<string, string> = {
  pending: "Pendente",
  billed: "Em cobrança",
  paid: "Pago",
  cancelled: "Cancelado",
};

export function BillingPanel({ shopId }: { shopId: string | undefined }) {
  const summaryFn = useServerFn(getBillingSummary);
  const plansFn = useServerFn(listPlatformPlans);
  const subscribeFn = useServerFn(startPlatformSubscription);
  const payFn = useServerFn(payUsageFees);

  const summary = useQuery({
    queryKey: ["billing-summary", shopId],
    enabled: !!shopId,
    retry: false,
    queryFn: () => summaryFn({ data: { shopId: shopId! } }),
  });

  const plans = useQuery({
    queryKey: ["platform-plans"],
    retry: false,
    queryFn: () => plansFn(),
  });

  const ledger = useQuery({
    queryKey: ["billing-ledger", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const [fees, payments] = await Promise.all([
        supabase
          .from("usage_fees")
          .select("id, amount, status, created_at, appointment_id")
          .eq("barbershop_id", shopId!)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("payments")
          .select("id, amount, status, type, created_at, paid_at, metadata")
          .eq("barbershop_id", shopId!)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      return { fees: fees.data ?? [], payments: payments.data ?? [] };
    },
  });

  const subscribe = useMutation({
    mutationFn: (planId: string) => subscribeFn({ data: { shopId: shopId!, planId } }),
    onSuccess: (result) => {
      if (result?.checkoutUrl) window.location.href = result.checkoutUrl;
      else {
        toast.success("Plano ativado.");
        summary.refetch();
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pay = useMutation({
    mutationFn: () => payFn({ data: { shopId: shopId! } }),
    onSuccess: (result) => {
      if (result?.checkoutUrl) window.location.href = result.checkoutUrl;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const s = summary.data;
  const pending = Number(s?.fees_pending ?? 0);
  const warnAbove = Number(s?.pending_balance_warning ?? 20);

  const rows = [
    ...(ledger.data?.fees ?? []).map((f) => ({
      key: `f-${f.id}`,
      date: f.created_at,
      type: "Taxa de atendimento",
      description: `Atendimento #${String(f.appointment_id).slice(0, 8)}`,
      amount: f.amount,
      status: FEE_LABEL[f.status] ?? f.status,
    })),
    ...(ledger.data?.payments ?? []).map((p) => ({
      key: `p-${p.id}`,
      date: p.created_at,
      type:
        p.type === "usage_fee"
          ? "Pagamento de taxas"
          : p.type === "subscription"
            ? "Assinatura da plataforma"
            : "Pagamento do cliente",
      description:
        p.type === "usage_fee"
          ? `${(p.metadata as { fee_count?: number } | null)?.fee_count ?? 0} atendimentos`
          : "—",
      amount: p.amount,
      status: p.status === "approved" ? "Pago" : (p.status ?? ""),
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-4">
          <h3 className="font-display text-2xl">Assinatura da plataforma</h3>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Plano</dt>
              <dd>{s?.plan?.name ?? "Nenhum"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Assinatura</dt>
              <dd>{s?.subscription ? (SUB_LABEL[s.subscription.status] ?? s.subscription.status) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Valor</dt>
              <dd>{money(s?.subscription?.price_amount ?? s?.plan?.monthly_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Próxima cobrança</dt>
              <dd>
                {s?.subscription?.subscription_next_billing_date
                  ? dateLabel(s.subscription.subscription_next_billing_date)
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {(plans.data ?? []).map((plan) => (
              <Button
                key={plan.id}
                size="sm"
                variant={s?.plan?.id === plan.id ? "default" : "outline"}
                disabled={subscribe.isPending || !shopId}
                onClick={() => subscribe.mutate(plan.id)}
              >
                <CreditCard className="size-4" /> {plan.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="surface-card p-4">
          <h3 className="font-display text-2xl">Taxas de atendimento</h3>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Atendimentos concluídos</dt>
              <dd>{s?.completed_appointments ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxa por atendimento</dt>
              <dd>{money(s?.usage_fee_amount ?? 0.2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxas acumuladas</dt>
              <dd>{money(s?.fees_accrued)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxas pagas</dt>
              <dd>{money(s?.fees_paid)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Saldo pendente</dt>
              <dd className="text-primary">{money(pending)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Último pagamento</dt>
              <dd>
                {s?.last_payment?.paid_at ? dateLabel(s.last_payment.paid_at) : "—"}
              </dd>
            </div>
          </dl>
          {pending > warnAbove && (
            <p className="mt-2 text-xs text-warning">
              Saldo acima de {money(warnAbove)}. Regularize para manter todos os recursos.
            </p>
          )}
          <Button
            className="mt-3 w-full"
            disabled={pay.isPending || pending <= 0 || !shopId}
            onClick={() => pay.mutate()}
          >
            <Receipt className="size-4" /> PAGAR TAXAS
          </Button>
        </div>

        <MercadoPagoConnect shopId={shopId} />
      </div>

      <div className="surface-card overflow-x-auto p-4">
        <h3 className="font-display text-2xl">Extrato financeiro</h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th className="text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-muted-foreground">
                  Sem movimentações financeiras.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="py-2">{dateLabel(row.date)}</td>
                <td>{row.type}</td>
                <td>{row.description}</td>
                <td>{money(row.amount)}</td>
                <td className="text-right">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
