import { Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useBilling } from "@/hooks/useBilling";
import { BILLING_STATUS } from "@/lib/billing";
import { brl, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Resumo da cobrança da plataforma no Dashboard. */
export function BillingSummaryCard() {
  const { data, isLoading } = useBilling();

  if (isLoading || !data) {
    return (
      <div className="surface-card p-4">
        <Skeleton className="h-4 w-1/3" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  const status = BILLING_STATUS[data.status];
  const inv = data.open_invoice;
  const items = [
    { label: "Grátis utilizados", value: `${data.free_used}/${data.free_quota}` },
    { label: "Cobrados (ciclo)", value: String(data.cycle?.billed_count ?? 0) },
    { label: "Valor acumulado", value: brl(inv?.amount_cents ?? data.cycle?.amount_cents ?? 0) },
    {
      label: inv ? "Vencimento" : "Fecha em",
      value: inv
        ? dateLabel(inv.due_date)
        : data.cycle
          ? dateLabel(data.cycle.period_end)
          : "—",
    },
  ];

  return (
    <div
      className={cn(
        "surface-card p-4",
        data.status === "suspended" && "border-destructive/50",
        data.status === "pending" && "border-warning/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <SectionHeader
          title="Cobrança do Navalha Pro"
          description={`${brl(data.unit_price_cents)} por atendimento concluído após ${data.free_quota} grátis`}
          icon={CreditCard}
        />
        <Badge variant="outline" className={cn("shrink-0 border", status.tone)}>
          {status.label}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="surface-row px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{it.label}</p>
            <p className="mt-0.5 font-display text-xl leading-none">{it.value}</p>
          </div>
        ))}
      </div>
      <Link
        to="/cobranca"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {inv ? "Pagar com Pix" : "Ver detalhes"} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
