import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cpfMask, daysUntil, friendlyError, PAYMENT_STATUS, SUB_STATUS, type Plan } from "@/lib/subscriptions";
import { chargeMessage, pendingPaymentOf, type SubscriptionRow } from "@/lib/subscription-alerts";
import {
  changePlan,
  fetchHistory,
  PAY_METHOD_LABEL,
  registerPayment,
  renewSubscription,
  setSubscriptionStatus,
  updateSubscription,
  type PayMethod,
} from "@/lib/subscription-actions";

type View = "menu" | "pay" | "plan" | "edit" | "history";

export function ManageSubscriberDialog({
  row,
  plans,
  shopName,
  pixKey,
  onOpenChange,
  onChanged,
  onCancel,
}: {
  row: SubscriptionRow | null;
  plans: Plan[];
  shopName: string;
  pixKey?: string | null | undefined;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
  onCancel: (row: SubscriptionRow) => void;
}) {
  const [view, setView] = useState<View>("menu");
  useEffect(() => {
    if (row) setView("menu");
  }, [row?.sub.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {row && (
          <Body
            row={row}
            plans={plans}
            shopName={shopName}
            pixKey={pixKey}
            view={view}
            setView={setView}
            onChanged={onChanged}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  row,
  plans,
  shopName,
  pixKey,
  view,
  setView,
  onChanged,
  onCancel,
}: {
  row: SubscriptionRow;
  plans: Plan[];
  shopName: string;
  pixKey?: string | null | undefined;
  view: View;
  setView: (v: View) => void;
  onChanged: () => void;
  onCancel: (row: SubscriptionRow) => void;
}) {
  const { sub, customer, plan, balance } = row;
  const status = SUB_STATUS[sub.status] ?? SUB_STATUS.pending;
  const pending = pendingPaymentOf(row);
  const dueIn = daysUntil(balance?.period_end ?? sub.next_payment);
  const isPaid = sub.payment_status === "paid";
  const closed = sub.status === "cancelled" || sub.status === "expired";
  const phone = customer?.phone?.replace(/\D/g, "");

  const useAction = <T,>(fn: () => Promise<T>, ok: (r: T) => string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (r) => {
        toast.success(ok(r));
        onChanged();
        setView("menu");
      },
      onError: (e: Error) => toast.error(friendlyError(e.message)),
    });

  /* ---- pagamento ---- */
  const [method, setMethod] = useState<PayMethod>("pix");
  const [amount, setAmount] = useState((sub.price_cents / 100).toFixed(2).replace(".", ","));
  const pay = useAction(
    () => registerPayment(row, method, Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100)),
    () => "Pagamento registrado",
  );

  /* ---- renovar ---- */
  const renew = useAction(
    () => renewSubscription(row),
    (r) => (r ? "Ciclo renovado — créditos liberados e cobrança gerada" : "Ciclo atual ainda está em vigor"),
  );

  /* ---- plano ---- */
  const [newPlanId, setNewPlanId] = useState(plan?.id ?? "");
  const [applyNow, setApplyNow] = useState(true);
  const newPlan = plans.find((p) => p.id === newPlanId) ?? null;
  const change = useAction(
    async () => {
      if (!newPlan) throw new Error("Escolha um plano.");
      if (newPlan.id === plan?.id) throw new Error("Escolha um plano diferente do atual.");
      await changePlan(row, newPlan, applyNow);
    },
    () => "Plano alterado",
  );

  /* ---- editar ---- */
  const [startedOn, setStartedOn] = useState(sub.started_on);
  const [periodEnd, setPeriodEnd] = useState(balance?.period_end ?? sub.next_payment ?? "");
  const [price, setPrice] = useState((sub.price_cents / 100).toFixed(2).replace(".", ","));
  const edit = useAction(
    async () => {
      const cents = Math.round(Number(price.replace(/\./g, "").replace(",", ".")) * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("Informe um valor válido.");
      if (periodEnd && periodEnd <= startedOn) throw new Error("O vencimento deve ser depois do início.");
      await updateSubscription(row, { started_on: startedOn, price_cents: cents, period_end: periodEnd || null });
    },
    () => "Assinatura atualizada",
  );

  /* ---- suspender / reativar ---- */
  const toggle = useAction(
    () => setSubscriptionStatus(row, sub.status === "suspended" ? "active" : "suspended"),
    () => (sub.status === "suspended" ? "Assinatura reativada" : "Assinatura suspensa"),
  );

  /* ---- histórico ---- */
  const history = useQuery({
    queryKey: ["subscription-history", sub.id],
    enabled: view === "history",
    queryFn: () => fetchHistory(sub),
  });

  const busy = pay.isPending || renew.isPending || change.isPending || edit.isPending || toggle.isPending;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          {view !== "menu" && (
            <Button size="icon" variant="ghost" className="-ml-2 size-8" onClick={() => setView("menu")} aria-label="Voltar">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <DialogTitle className="font-display text-2xl">{customer?.name ?? "Cliente"}</DialogTitle>
        </div>
        <DialogDescription>
          {plan?.name ?? "Sem plano"} · {brl(sub.price_cents)} · {customer?.cpf ? cpfMask(customer.cpf) : "sem CPF"}
        </DialogDescription>
      </DialogHeader>

      {/* ---------- resumo ---------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info label="Status">
          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", status.tone)}>
            {status.label}
          </Badge>
        </Info>
        <Info label="Pagamento">
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 text-[10px]",
              isPaid ? "border-success/40 bg-success/15 text-success" : "border-warning/40 bg-warning/15 text-warning",
            )}
          >
            {PAYMENT_STATUS[sub.payment_status]}
          </Badge>
        </Info>
        <Info label="Vencimento">
          <span className={cn("text-sm font-medium", dueIn !== null && dueIn <= 5 && "text-warning", dueIn !== null && dueIn < 0 && "text-destructive")}>
            {balance?.period_end ? dateLabel(balance.period_end) : sub.next_payment ? dateLabel(sub.next_payment) : "—"}
          </span>
          {dueIn !== null && (
            <span className="block text-[10px] text-muted-foreground">
              {dueIn < 0 ? `há ${Math.abs(dueIn)} dia(s)` : dueIn === 0 ? "hoje" : `em ${dueIn} dia(s)`}
            </span>
          )}
        </Info>
        <Info label="Créditos">
          <span className="text-sm font-medium">
            {balance ? `${balance.cuts_left}/${balance.cuts_credits} cortes` : "—"}
          </span>
          {balance && (
            <span className="block text-[10px] text-muted-foreground">
              {balance.beards_left}/{balance.beards_credits} barbas
            </span>
          )}
        </Info>
      </div>

      {pending && !isPaid && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-warning" />
            <span>
              Pagamento pendente de <b>{brl(pending.amount_cents)}</b>
              {pending.due_date && <span className="text-muted-foreground"> · venceu {dateLabel(pending.due_date)}</span>}
            </span>
          </div>
          {phone && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={`https://wa.me/55${phone}?text=${encodeURIComponent(chargeMessage(row, shopName, pixKey))}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-3.5" /> Cobrar
              </a>
            </Button>
          )}
        </div>
      )}

      {/* ---------- ações ---------- */}
      {view === "menu" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Action icon={CheckCircle2} label="Registrar pagamento" primary={!isPaid} disabled={closed || busy} onClick={() => setView("pay")} />
          <Action icon={RefreshCw} label="Renovar ciclo" disabled={closed || busy} loading={renew.isPending} onClick={() => renew.mutate()} />
          <Action icon={ArrowLeftRight} label="Alterar plano" disabled={closed || busy} onClick={() => setView("plan")} />
          <Action icon={Pencil} label="Editar" disabled={closed || busy} onClick={() => setView("edit")} />
          <Action icon={History} label="Histórico" onClick={() => setView("history")} />
          <Action
            icon={sub.status === "suspended" ? Play : Pause}
            label={sub.status === "suspended" ? "Reativar" : "Suspender"}
            disabled={closed || busy}
            loading={toggle.isPending}
            onClick={() => toggle.mutate()}
          />
          {!closed && (
            <button
              type="button"
              onClick={() => onCancel(row)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive sm:col-span-3"
            >
              <XCircle className="size-3.5" /> Cancelar assinatura
            </button>
          )}
        </div>
      )}

      {view === "pay" && (
        <Panel title="Registrar pagamento">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PayMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAY_METHOD_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" disabled={pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirmar recebimento
          </Button>
        </Panel>
      )}

      {view === "plan" && (
        <Panel title="Alterar plano">
          <div className="space-y-1.5">
            <Label>Novo plano</Label>
            <Select value={newPlanId} onValueChange={setNewPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((p) => p.active || p.id === plan?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {brl(p.price_cents)}
                      {p.id === plan?.id ? " (atual)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {balance && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Aplicar créditos no ciclo atual</p>
                <p className="text-xs text-muted-foreground">Desligado: o novo plano vale a partir da próxima renovação.</p>
              </div>
              <Switch checked={applyNow} onCheckedChange={setApplyNow} />
            </div>
          )}
          <Button className="w-full" disabled={change.isPending || !newPlan || newPlan.id === plan?.id} onClick={() => change.mutate()}>
            {change.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
            Confirmar troca
          </Button>
        </Panel>
      )}

      {view === "edit" && (
        <Panel title="Editar assinatura">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" disabled={edit.isPending} onClick={() => edit.mutate()}>
            {edit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            Salvar alterações
          </Button>
        </Panel>
      )}

      {view === "history" && (
        <Panel title="Histórico">
          {history.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-2.5">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      h.kind === "payment" ? "bg-success" : h.kind === "usage" ? "bg-primary" : h.kind === "cycle" ? "bg-warning" : "bg-muted-foreground/60",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{h.title}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(h.at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {h.detail && <p className="text-xs text-muted-foreground">{h.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2.5">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{title}</p>
      {children}
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  primary,
  disabled,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20"
          : "border-border hover:border-primary/40 hover:bg-secondary/60",
      )}
    >
      <Icon className={cn("size-4", loading && "animate-spin")} />
      {label}
    </button>
  );
}
