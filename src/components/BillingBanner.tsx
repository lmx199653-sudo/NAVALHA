import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBilling } from "@/hooks/useBilling";
import { brl, dateLabel } from "@/lib/format";
import { daysTo } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** Aviso fixo no topo do app quando há cobrança pendente ou conta suspensa. */
export function BillingBanner() {
  const { data } = useBilling();
  if (!data || data.status === "active" || !data.open_invoice) return null;

  const inv = data.open_invoice;
  const suspended = data.status === "suspended";
  const days = daysTo(inv.suspend_at);

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center",
        suspended
          ? "border-destructive/50 bg-destructive/10"
          : "border-warning/50 bg-warning/10",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          suspended ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning",
        )}
      >
        {suspended ? <Lock className="size-4" /> : <AlertTriangle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {suspended
            ? "Conta suspensa por falta de pagamento"
            : `Cobrança pendente · ${brl(inv.amount_cents)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {suspended
            ? "Novos agendamentos e alterações estão bloqueados. Pague via Pix para reativar automaticamente."
            : `Venceu em ${dateLabel(inv.due_date)}. ${
                days > 0
                  ? `Sem pagamento, a conta será suspensa em ${days} dia${days === 1 ? "" : "s"}.`
                  : "A conta será suspensa hoje."
              }`}
        </p>
      </div>
      <Button
        size="sm"
        variant={suspended ? "destructive" : "default"}
        className="w-full sm:w-auto"
        asChild
      >
        <Link to="/cobranca">Pagar com Pix</Link>
      </Button>
    </div>
  );
}
