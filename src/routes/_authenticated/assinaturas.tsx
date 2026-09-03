import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock3, Crown, Plus, Search, Settings2, Users } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";

import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { brl, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  cancelSubscription,
  cpfDigits,
  cpfMask,
  daysUntil,
  friendlyError,
  PAYMENT_STATUS,
  SUB_STATUS,
  type CycleBalance,
  type Plan,
  type Subscription,
} from "@/lib/subscriptions";
import {
  buildAlerts,
  pendingPaymentOf,
  type AlertCustomer,
  type PaymentRow,
  type SubscriptionRow,
} from "@/lib/subscription-alerts";
import { registerPayment, renewSubscription } from "@/lib/subscription-actions";
import { SubscriptionAlerts } from "@/components/subscriptions/SubscriptionAlerts";
import { PlansPanel } from "@/components/subscriptions/PlansPanel";
import { NewSubscriberDialog } from "@/components/subscriptions/NewSubscriberDialog";
import { ManageSubscriberDialog } from "@/components/subscriptions/ManageSubscriberDialog";

type Tab = "assinantes" | "planos";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: SubscriptionsPage,
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    s["tab"] === "planos" ? { tab: "planos" } : {},
  head: () => ({
    meta: [
      { title: "Assinaturas — planos, assinantes e alertas | Navalha Pro" },
      {
        name: "description",
        content:
          "Gerencie planos de assinatura, assinantes e receba alertas de pagamentos pendentes, atrasos, vencimentos e renovações da sua barbearia.",
      },
      { property: "og:title", content: "Assinaturas | Navalha Pro" },
      {
        property: "og:description",
        content:
          "Planos, assinantes e alertas inteligentes de cobrança e renovação em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type StatusFilter = "all" | "attention" | "active" | "inactive";

function SubscriptionsPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const activeTab: Tab = tab ?? "assinantes";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subscriptions", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [subs, plans, customers, balances, payments] = await Promise.all([
        supabase.from("customer_subscriptions").select("*").eq("barbershop_id", shop!.id),
        supabase.from("subscription_plans").select("*").eq("barbershop_id", shop!.id),
        supabase.from("customers").select("id, name, phone, cpf").eq("barbershop_id", shop!.id),
        supabase.from("subscription_cycle_balances").select("*").eq("barbershop_id", shop!.id),
        supabase
          .from("subscription_payments")
          .select("id, subscription_id, amount_cents, status, due_date, paid_at")
          .eq("barbershop_id", shop!.id),
      ]);
      return {
        subs: (subs.data ?? []) as unknown as Subscription[],
        plans: (plans.data ?? []) as unknown as Plan[],
        customers: (customers.data ?? []) as unknown as AlertCustomer[],
        balances: (balances.data ?? []) as unknown as CycleBalance[],
        payments: (payments.data ?? []) as unknown as PaymentRow[],
      };
    },
  });

  const rows = useMemo<SubscriptionRow[]>(() => {
    const subs = data?.subs ?? [];
    return subs
      .map((s) => ({
        sub: s,
        customer: (data?.customers ?? []).find((c) => c.id === s.customer_id) ?? null,
        plan: (data?.plans ?? []).find((p) => p.id === s.plan_id) ?? null,
        balance:
          (data?.balances ?? [])
            .filter((b) => b.subscription_id === s.id)
            .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0] ?? null,
        payments: (data?.payments ?? []).filter((p) => p.subscription_id === s.id),
      }))
      .sort((a, b) => (a.customer?.name ?? "").localeCompare(b.customer?.name ?? ""));
  }, [data]);

  const alerts = useMemo(() => buildAlerts(rows), [rows]);
  const attentionIds = useMemo(() => new Set(alerts.map((a) => a.row.sub.id)), [alerts]);
  const activeCustomerIds = useMemo(
    () =>
      new Set(
        rows
          .filter((r) => r.sub.status === "active" || r.sub.status === "pending")
          .map((r) => r.sub.customer_id),
      ),
    [rows],
  );
  const manageRow = useMemo(
    () => rows.find((r) => r.sub.id === manageId) ?? null,
    [rows, manageId],
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const digits = cpfDigits(search);
    return rows.filter((r) => {
      if (statusFilter === "attention" && !attentionIds.has(r.sub.id)) return false;
      if (statusFilter === "active" && r.sub.status !== "active") return false;
      if (statusFilter === "inactive" && r.sub.status === "active") return false;
      if (!term) return true;
      return (
        (r.customer?.name ?? "").toLowerCase().includes(term) ||
        (r.customer?.phone ?? "").includes(term) ||
        (digits && (r.customer?.cpf ?? "").includes(digits)) ||
        (r.plan?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, search, statusFilter, attentionIds]);

  const metrics = useMemo(() => {
    const subs = data?.subs ?? [];
    const active = subs.filter((s) => s.status === "active");
    const mrr = active.reduce((sum, s) => sum + (s.price_cents || 0), 0);
    const monthAgo = Date.now() - 30 * 86400000;
    const received = (data?.payments ?? [])
      .filter((p) => p.status === "paid" && p.paid_at && +new Date(p.paid_at) >= monthAgo)
      .reduce((s, p) => s + p.amount_cents, 0);
    const toReceive = active
      .filter((s) => s.payment_status !== "paid")
      .reduce((s, x) => s + (x.price_cents || 0), 0);
    return { mrr, active: active.length, received, toReceive };
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["subscriptions"] });
    qc.invalidateQueries({ queryKey: ["plans"] });
  };

  const markPaid = useMutation({
    mutationFn: async (row: SubscriptionRow) => {
      setBusyId(row.sub.id);
      await registerPayment(row, "manual");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pagamento registrado");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
    onSettled: () => setBusyId(null),
  });

  const renew = useMutation({
    mutationFn: async (row: SubscriptionRow) => {
      setBusyId(row.sub.id);
      return renewSubscription(row);
    },
    onSuccess: (renewed) => {
      invalidate();
      toast.success(
        renewed
          ? "Ciclo renovado — créditos liberados e cobrança gerada"
          : "Ciclo atual ainda está em vigor",
      );
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
    onSettled: () => setBusyId(null),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      await cancelSubscription(cancelTarget.id, reason.trim() || "Cancelamento manual");
    },
    onSuccess: () => {
      invalidate();
      setCancelTarget(null);
      setReason("");
      toast.success("Assinatura cancelada");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const shopName = shop?.name ?? "barbearia";
  const pixKey = (shop as { pix_key?: string | null } | undefined)?.pix_key ?? null;

  return (
    <AppShell title="Assinaturas" subtitle="Planos, assinantes e alertas em um só lugar">
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          navigate({
            to: "/assinaturas",
            search: v === "planos" ? { tab: "planos" } : {},
            replace: true,
          })
        }
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
          <TabsTrigger value="assinantes" className="gap-2">
            <Users className="size-4" /> Assinantes
            {alerts.length > 0 && (
              <span className="ml-0.5 grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {alerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-2">
            <Crown className="size-4" /> Planos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assinantes" className="space-y-4">
          {isError ? (
            <ErrorState
              title="Não foi possível carregar as assinaturas"
              description="Tente novamente em instantes."
              onRetry={() => refetch()}
            />
          ) : isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-xl" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <SubscriptionAlerts
                alerts={alerts}
                shopName={shopName}
                pixKey={pixKey}
                busyId={busyId}
                onMarkPaid={(row) => markPaid.mutate(row)}
                onRenew={(row) => renew.mutate(row)}
                onCancel={(row) => setCancelTarget(row.sub)}
              />

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                  label="Receita recorrente"
                  value={brl(metrics.mrr)}
                  tone="gold"
                  icon={Crown}
                />
                <StatCard label="Assinantes ativos" value={String(metrics.active)} icon={Users} />
                <StatCard
                  label="Recebido (30 dias)"
                  value={brl(metrics.received)}
                  tone="success"
                  icon={Clock3}
                />
                <StatCard
                  label="A receber"
                  value={brl(metrics.toReceive)}
                  tone={metrics.toReceive > 0 ? "danger" : "default"}
                  icon={Clock3}
                />
              </div>
            </>
          )}

          <div className="surface-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl leading-tight">Assinantes</p>
                <p className="text-xs text-muted-foreground">{rows.length} cadastrado(s)</p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por CPF, nome ou plano"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  <Plus className="size-4" /> Novo assinante
                </Button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Todos"],
                  ["attention", "Com alerta"],
                  ["active", "Ativos"],
                  ["inactive", "Inativos"],
                ] as Array<[StatusFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    statusFilter === key
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {isLoading && <ListSkeleton rows={4} />}

            {!isLoading && filtered.length === 0 && (
              <EmptyState
                icon={rows.length === 0 ? Users : Search}
                title={rows.length === 0 ? "Nenhum assinante ainda" : "Nenhuma assinatura encontrada"}
                description={
                  rows.length === 0
                    ? "Crie um plano e vincule seu primeiro cliente para começar a recorrência."
                    : "Ajuste os filtros ou o termo de busca."
                }
                action={
                  rows.length === 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate({ to: "/assinaturas", search: { tab: "planos" } })}
                    >
                      <Crown className="size-4" /> Ir para Planos
                    </Button>
                  ) : undefined
                }
              />
            )}

            <div className="space-y-2">
              {!isLoading && filtered.map((row) => {
                const { sub, customer, plan, balance } = row;
                const status = SUB_STATUS[sub.status] ?? SUB_STATUS.pending;
                const dueIn = daysUntil(balance?.period_end ?? sub.next_payment);
                const dueLabel = balance?.period_end
                  ? dateLabel(balance.period_end)
                  : sub.next_payment
                    ? dateLabel(sub.next_payment)
                    : "—";
                const pending = sub.payment_status !== "paid" ? pendingPaymentOf(row) : null;
                const hasAlert = attentionIds.has(sub.id);
                const closed = sub.status === "cancelled" || sub.status === "expired";
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setManageId(sub.id)}
                    className={cn(
                      "group flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between",
                      hasAlert ? "border-primary/30 bg-primary/[0.03]" : "border-border",
                      closed && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{customer?.name ?? "Cliente"}</p>
                        <Badge
                          variant="outline"
                          className={cn("h-5 px-1.5 text-[10px]", status.tone)}
                        >
                          {status.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px]",
                            sub.payment_status === "paid"
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-warning/40 bg-warning/15 text-warning",
                          )}
                        >
                          {PAYMENT_STATUS[sub.payment_status]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {plan?.name ?? "—"} · {brl(sub.price_cents)} ·{" "}
                        {customer?.cpf ? cpfMask(customer.cpf) : "sem CPF"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Vence:{" "}
                          <b
                            className={cn(
                              "text-foreground",
                              dueIn !== null && dueIn <= 5 && "text-warning",
                              dueIn !== null && dueIn < 0 && "text-destructive",
                            )}
                          >
                            {dueLabel}
                          </b>
                        </span>
                        <span>
                          Cortes:{" "}
                          <b className="text-foreground">
                            {balance ? `${balance.cuts_left}/${balance.cuts_credits}` : "—"}
                          </b>
                        </span>
                        <span>
                          Barbas:{" "}
                          <b className="text-foreground">
                            {balance ? `${balance.beards_left}/${balance.beards_credits}` : "—"}
                          </b>
                        </span>
                        {pending && (
                          <span className="inline-flex items-center gap-1 text-warning">
                            <Clock3 className="size-3" /> Pendente {brl(pending.amount_cents)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors group-hover:border-primary/50 group-hover:text-primary sm:self-center">
                      <Settings2 className="size-3.5" /> Gerenciar
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="planos">
          <PlansPanel />
        </TabsContent>
      </Tabs>

      <NewSubscriberDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        shopId={shop?.id}
        plans={data?.plans ?? []}
        customers={data?.customers ?? []}
        activeCustomerIds={activeCustomerIds}
        onCreated={invalidate}
      />

      <ManageSubscriberDialog
        row={manageRow}
        plans={data?.plans ?? []}
        shopName={shopName}
        pixKey={pixKey}
        onOpenChange={(v) => !v && setManageId(null)}
        onChanged={invalidate}
        onCancel={(row) => setCancelTarget(row.sub)}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico é preservado e o cliente deixa de consumir benefícios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Motivo do cancelamento"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>
              Cancelar assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
