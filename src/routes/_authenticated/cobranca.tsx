import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Coins,
  Gift,
  Info,
  Receipt,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { PixQrCard } from "@/components/PixQrCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton, EmptyState, ErrorState, ListSkeleton, SectionHeader } from "@/components/ui/states";
import { useBilling } from "@/hooks/useBilling";
import { useShop } from "@/hooks/useShop";
import { BILLING_STATUS, daysTo, fetchBillingInvoices } from "@/lib/billing";
import { brl, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cobranca")({
  component: BillingPage,
});

function BillingPage() {
  const { data: shop } = useShop();
  const { data, isLoading, isError, refetch } = useBilling();
  const invoices = useQuery({
    queryKey: ["billing-invoices", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => fetchBillingInvoices(shop!.id),
  });

  const status = data ? BILLING_STATUS[data.status] : null;
  const inv = data?.open_invoice ?? null;
  const freePct = data ? Math.min(100, Math.round((data.free_used / data.free_quota) * 100)) : 0;
  const unit = data ? brl(data.unit_price_cents) : "R$ 0,20";

  return (
    <AppShell
      title="Cobrança"
      subtitle="Uso do Navalha Pro · pague apenas pelos atendimentos concluídos"
      action={
        status && (
          <Badge variant="outline" className={cn("border", status.tone)}>
            {status.label}
          </Badge>
        )
      }
    >
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <CardSkeleton count={4} />
      ) : (
        <>
          {/* Como funciona */}
          <div className="surface-card mb-4 flex items-start gap-3 border-primary/25 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Os primeiros <strong className="text-foreground">{data.free_quota}</strong>{" "}
              atendimentos concluídos são grátis. A partir do{" "}
              <strong className="text-foreground">{data.free_quota + 1}º</strong>, cada atendimento
              concluído custa <strong className="text-foreground">{unit}</strong>, acumulado em
              ciclos de {data.cycle_days} dias e pago via Pix. Cancelamentos, faltas e agendamentos
              não concluídos nunca são cobrados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              size="hero"
              label="Grátis utilizados"
              value={`${data.free_used}/${data.free_quota}`}
              icon={Gift}
              tone="gold"
              hint={
                data.free_left > 0
                  ? `${data.free_left} atendimentos grátis restantes`
                  : "Cota grátis esgotada"
              }
            />
            <StatCard
              size="hero"
              label="Atendimentos cobrados"
              value={data.cycle?.billed_count ?? 0}
              icon={Receipt}
              hint={
                data.cycle ? `ciclo atual · ${data.billed_total} no total` : "nenhum ciclo aberto"
              }
            />
            <StatCard
              size="hero"
              label="Valor acumulado"
              value={brl(data.cycle?.amount_cents ?? 0)}
              icon={Coins}
              tone={data.cycle?.amount_cents ? "success" : "default"}
              hint={`${unit} por atendimento`}
            />
            <StatCard
              size="hero"
              label={inv ? "Vencimento" : "Fecha o ciclo em"}
              value={
                inv
                  ? dateLabel(inv.due_date)
                  : data.cycle
                    ? dateLabel(data.cycle.period_end)
                    : "—"
              }
              icon={CalendarClock}
              tone={data.status === "active" ? "default" : "danger"}
              hint={status?.label ?? ""}
            />
          </div>

          {/* Barra de uso grátis */}
          <div className="surface-card mt-4 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Atendimentos gratuitos</span>
              <span className="text-muted-foreground">{freePct}% utilizado</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${freePct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.free_left > 0
                ? `O ciclo de ${data.cycle_days} dias só começa depois que os ${data.free_quota} atendimentos grátis forem usados.`
                : data.cycle
                  ? `Ciclo atual: ${dateLabel(data.cycle.period_start)} a ${dateLabel(data.cycle.period_end)}.`
                  : "Um novo ciclo começa no próximo atendimento concluído."}
            </p>
          </div>

          {/* Cobrança em aberto */}
          {inv && (
            <div
              className={cn(
                "surface-card mt-4 p-4 sm:p-5",
                data.status === "suspended"
                  ? "border-destructive/50"
                  : data.status === "pending"
                    ? "border-warning/50"
                    : "border-primary/40",
              )}
            >
              <SectionHeader
                title="Cobrança em aberto"
                description={`${inv.appointments_count} atendimentos · ${dateLabel(inv.period_start)} a ${dateLabel(inv.period_end)}`}
                icon={ScanLine}
              />
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div className="surface-row px-3.5 py-3">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-display text-2xl text-primary">{brl(inv.amount_cents)}</p>
                </div>
                <div className="surface-row px-3.5 py-3">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{dateLabel(inv.due_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {daysTo(inv.due_date) >= 0
                      ? `${daysTo(inv.due_date)} dia(s) restantes`
                      : `vencida há ${Math.abs(daysTo(inv.due_date))} dia(s)`}
                  </p>
                </div>
                <div className="surface-row px-3.5 py-3">
                  <p className="text-xs text-muted-foreground">Suspensão em</p>
                  <p className="font-medium">{dateLabel(inv.suspend_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.status === "suspended" ? "conta suspensa" : "se não houver pagamento"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{status?.description}</p>

              {data.platform_pix ? (
                <PixQrCard
                  className="mt-4"
                  pixKey={data.platform_pix.key}
                  pixKeyType={data.platform_pix.key_type}
                  holderName={data.platform_pix.holder_name ?? "NAVALHA PRO"}
                  amountCents={inv.amount_cents}
                  description={`Navalha Pro ${inv.pix_txid}`}
                  showKey
                />
              ) : (
                <EmptyState
                  className="mt-4"
                  icon={ScanLine}
                  title="Pix em preparação"
                  description="A chave Pix da plataforma ainda não foi liberada. Assim que estiver disponível, o QR Code aparece aqui."
                  compact
                />
              )}
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Identificador da cobrança: <code className="select-all">{inv.pix_txid}</code>. A
                confirmação do pagamento é automática e reativa a conta na hora.
              </p>
            </div>
          )}

          {!inv && data.status === "active" && (
            <div className="surface-card mt-4 flex items-center gap-3 border-success/30 p-4">
              <CheckCircle2 className="size-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium">Nenhuma cobrança em aberto</p>
                <p className="text-xs text-muted-foreground">
                  Ao fechar um ciclo com valor acumulado, a cobrança Pix aparece aqui e você
                  recebe o aviso no painel.
                </p>
              </div>
            </div>
          )}

          {/* Histórico */}
          <div className="surface-card mt-4 p-4">
            <SectionHeader title="Histórico de cobranças" icon={Receipt} />
            <div className="mt-3 space-y-2">
              {invoices.isLoading ? (
                <ListSkeleton rows={3} />
              ) : invoices.isError ? (
                <ErrorState onRetry={() => invoices.refetch()} />
              ) : (invoices.data ?? []).length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Sem cobranças até agora"
                  description="Enquanto você usa os atendimentos grátis, nada é cobrado."
                  compact
                />
              ) : (
                invoices.data!.map((i) => (
                  <div
                    key={i.id}
                    className="surface-row flex items-center justify-between gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {dateLabel(i.period_start)} – {dateLabel(i.period_end)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.appointments_count} atendimentos · vence {dateLabel(i.due_date)}
                        {i.paid_at ? ` · pago em ${dateLabel(i.paid_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-display text-xl">{brl(i.amount_cents)}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border",
                          i.status === "paid"
                            ? "border-success/40 bg-success/15 text-success"
                            : i.status === "cancelled"
                              ? "border-border bg-muted text-muted-foreground"
                              : "border-warning/40 bg-warning/15 text-warning",
                        )}
                      >
                        {i.status === "paid"
                          ? "Paga"
                          : i.status === "cancelled"
                            ? "Cancelada"
                            : "Em aberto"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
            {invoices.data && invoices.data.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  void invoices.refetch();
                  void refetch();
                }}
              >
                Atualizar
              </Button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
