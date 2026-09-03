import { Badge } from "@/components/ui/badge";
import { brl, dateLabel } from "@/lib/format";
import {
  canUseBenefits,
  daysUntil,
  SUB_STATUS,
  type CycleBalance,
  type Plan,
  type Subscription,
} from "@/lib/subscriptions";

function statusBadgeVariant(
  status: Subscription["status"],
): "success" | "warning" | "destructive" | "secondary" {
  if (status === "active") return "success";
  if (status === "pending" || status === "suspended") return "warning";
  if (status === "cancelled") return "secondary";
  return "destructive";
}

function Bar({ label, used, total }: { label: string; used: number; total: number }) {
  const left = Math.max(total - used, 0);
  const pct = total > 0 ? (left / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={left === 0 ? "text-destructive" : "font-medium"}>
          {left}/{total} disponíveis
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${left === 0 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SubscriptionCard({
  subscription,
  plan,
  balance,
  compact = false,
}: {
  subscription: Subscription | null | undefined;
  plan: Plan | null | undefined;
  balance: CycleBalance | null | undefined;
  compact?: boolean;
}) {
  if (!subscription || !plan) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Este cliente não possui assinatura ativa.
      </div>
    );
  }

  const usable = canUseBenefits(subscription, balance ?? null);
  const status = SUB_STATUS[subscription.status] ?? SUB_STATUS.pending;
  const renewIn = daysUntil(balance?.period_end ?? subscription.next_payment);
  const nearRenewal = usable && renewIn !== null && renewIn <= 3;

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Assinatura</p>
          <p className="font-display text-xl">{plan.name}</p>
          <p className="font-display text-lg text-primary">
            {brl(subscription.price_cents || plan.price_cents)}
            <span className="text-xs font-sans font-normal text-muted-foreground">
              {" "}
              / ciclo de {plan.cycle_days} dias
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusBadgeVariant(subscription.status)}>{status.label}</Badge>
          {nearRenewal && (
            <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">
              🟠 Renova em {renewIn} dia(s)
            </Badge>
          )}
        </div>
      </div>

      {balance ? (
        <div className="space-y-2">
          <Bar label="Cortes" used={balance.cuts_used} total={balance.cuts_credits} />
          <Bar label="Barbas" used={balance.beards_used} total={balance.beards_credits} />
          {balance.extras_credits > 0 && (
            <Bar label="Extras" used={balance.extras_used} total={balance.extras_credits} />
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum ciclo aberto.</p>
      )}

      {!compact && (
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted-foreground">Início</p>
            <p>{dateLabel(subscription.started_on)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Renovação</p>
            <p>{balance?.period_end ? dateLabel(balance.period_end) : "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
