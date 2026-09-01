import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageCircle, RefreshCw, Search, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  cancelSubscription,
  cpfDigits,
  cpfMask,
  daysUntil,
  friendlyError,
  PAYMENT_STATUS,
  renewCycle,
  SUB_STATUS,
  type CycleBalance,
  type PaymentStatus,
  type Plan,
  type Subscription,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: SubscriptionsPage,
  head: () => ({
    meta: [
      { title: "Assinaturas e financeiro recorrente | Navalha Pro" },
      {
        name: "description",
        content:
          "Painel de assinaturas da barbearia: receita recorrente, assinantes ativos, saldo de cortes e barbas, renovações e inadimplência.",
      },
      { property: "og:title", content: "Assinaturas e financeiro recorrente" },
      {
        property: "og:description",
        content: "Controle completo das assinaturas recorrentes da sua barbearia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PERIODS = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "3 meses", days: 90 },
  { key: "180", label: "6 meses", days: 180 },
  { key: "365", label: "12 meses", days: 365 },
];

type Customer = { id: string; name: string; phone: string | null; cpf: string | null };

function SubscriptionsPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [period, setPeriod] = useState("30");
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [subs, plans, customers, balances, payments] = await Promise.all([
        supabase.from("customer_subscriptions").select("*").eq("barbershop_id", shop!.id),
        supabase.from("subscription_plans").select("*").eq("barbershop_id", shop!.id),
        supabase.from("customers").select("id, name, phone, cpf").eq("barbershop_id", shop!.id),
        supabase.from("subscription_cycle_balances").select("*").eq("barbershop_id", shop!.id),
        supabase.from("subscription_payments").select("*").eq("barbershop_id", shop!.id),
      ]);
      return {
        subs: (subs.data ?? []) as unknown as Subscription[],
        plans: (plans.data ?? []) as unknown as Plan[],
        customers: (customers.data ?? []) as unknown as Customer[],
        balances: (balances.data ?? []) as unknown as CycleBalance[],
        payments: (payments.data ?? []) as unknown as Array<{
          id: string;
          subscription_id: string;
          amount_cents: number;
          status: PaymentStatus;
          paid_at: string | null;
        }>,
      };
    },
  });

  const days = PERIODS.find((p) => p.key === period)?.days ?? 30;
  const since = useMemo(() => Date.now() - days * 86400000, [days]);

  const rows = useMemo(() => {
    const subs = data?.subs ?? [];
    return subs.map((s) => {
      const customer = (data?.customers ?? []).find((c) => c.id === s.customer_id) ?? null;
      const plan = (data?.plans ?? []).find((p) => p.id === s.plan_id) ?? null;
      const balance =
        (data?.balances ?? [])
          .filter((b) => b.subscription_id === s.id)
          .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0] ?? null;
      return { sub: s, customer, plan, balance };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    const digits = cpfDigits(search);
    if (!term) return rows;
    return rows.filter(
      (r) =>
        (r.customer?.name ?? "").toLowerCase().includes(term) ||
        (r.customer?.phone ?? "").includes(term) ||
        (digits && (r.customer?.cpf ?? "").includes(digits)) ||
        (r.plan?.name ?? "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const metrics = useMemo(() => {
    const subs = data?.subs ?? [];
    const active = subs.filter((s) => s.status === "active");
    const mrr = active.reduce((sum, s) => sum + (s.price_cents || 0), 0);
    const created = subs.filter((s) => +new Date(s.created_at) >= since);
    const cancelled = subs.filter((s) => s.cancelled_at && +new Date(s.cancelled_at) >= since);
    const overdue = active.filter((s) => s.payment_status !== "paid");
    const paidInPeriod = (data?.payments ?? []).filter(
      (p) => p.status === "paid" && p.paid_at && +new Date(p.paid_at) >= since,
    );
    const base = active.length + cancelled.length;
    return {
      mrr,
      active: active.length,
      created: created.length,
      cancelled: cancelled.length,
      overdue: overdue.length,
      avgTicket: active.length ? Math.round(mrr / active.length) : 0,
      renewal: base ? Math.round(((base - cancelled.length) / base) * 100) : 100,
      churn: base ? Math.round((cancelled.length / base) * 100) : 0,
      annual: mrr * 12,
      received: paidInPeriod.reduce((s, p) => s + p.amount_cents, 0),
    };
  }, [data, since]);

  const byPlan = useMemo(() => {
    return (data?.plans ?? []).map((p) => {
      const active = (data?.subs ?? []).filter((s) => s.plan_id === p.id && s.status === "active");
      return {
        name: p.name,
        assinantes: active.length,
        receita: active.reduce((s, x) => s + (x.price_cents || 0), 0) / 100,
      };
    });
  }, [data]);

  const alerts = useMemo(() => {
    const list: Array<{ id: string; tone: string; text: string }> = [];
    rows.forEach(({ sub, customer, balance }) => {
      const name = customer?.name ?? "Cliente";
      if (sub.status === "active" && balance) {
        const left = daysUntil(balance.period_end);
        if (left !== null && left <= 3 && left >= 0)
          list.push({ id: `${sub.id}-renew`, tone: "text-warning", text: `${name} renova em ${left} dia(s).` });
        if (balance.cuts_left === 0)
          list.push({
            id: `${sub.id}-zero`,
            tone: "text-destructive",
            text: `${name} não possui mais cortes neste ciclo.`,
          });
        else if (balance.cuts_left === 1)
          list.push({ id: `${sub.id}-low`, tone: "text-warning", text: `${name} possui apenas 1 corte restante.` });
      }
      if (sub.status === "active" && sub.payment_status !== "paid")
        list.push({
          id: `${sub.id}-pay`,
          tone: "text-destructive",
          text: `A assinatura de ${name} possui pagamento pendente.`,
        });
      if (sub.status === "expired")
        list.push({ id: `${sub.id}-exp`, tone: "text-destructive", text: `A assinatura de ${name} expirou.` });
    });
    return list.slice(0, 8);
  }, [rows]);

  const markPaid = useMutation({
    mutationFn: async (sub: Subscription) => {
      const { error } = await supabase
        .from("customer_subscriptions")
        .update({ payment_status: "paid", last_payment_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (error) throw new Error(friendlyError(error.message));
      const { error: payError } = await supabase.from("subscription_payments").insert({
        barbershop_id: sub.barbershop_id,
        subscription_id: sub.id,
        amount_cents: sub.price_cents,
        status: "paid",
        method: "manual",
        paid_at: new Date().toISOString(),
      });
      if (payError) throw new Error(friendlyError(payError.message));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Pagamento registrado");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const renew = useMutation({
    mutationFn: (id: string) => renewCycle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Ciclo verificado/renovado");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      await cancelSubscription(cancelTarget.id, reason.trim() || "Cancelamento manual");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setCancelTarget(null);
      setReason("");
      toast.success("Assinatura cancelada");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  return (
    <AppShell title="Assinaturas" subtitle="Financeiro recorrente e controle de benefícios">
      <Tabs value={period} onValueChange={setPeriod} className="mb-4">
        <TabsList className="w-full overflow-x-auto">
          {PERIODS.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Receita recorrente mensal" value={brl(metrics.mrr)} highlight />
          <Metric label="Assinaturas ativas" value={String(metrics.active)} />
          <Metric label="Novas assinaturas" value={String(metrics.created)} />
          <Metric label="Cancelamentos" value={String(metrics.cancelled)} />
          <Metric label="Inadimplentes" value={String(metrics.overdue)} />
          <Metric label="Receita média por cliente" value={brl(metrics.avgTicket)} />
          <Metric label="Taxa de renovação" value={`${metrics.renewal}%`} />
          <Metric label="Churn" value={`${metrics.churn}%`} />
          <Metric label="Receita anual estimada" value={brl(metrics.annual)} />
          <Metric label="Recebido no período" value={brl(metrics.received)} />
        </div>
      )}

      {byPlan.length > 0 && (
        <div className="surface-card mt-4 p-4">
          <p className="mb-3 font-display text-xl">Receita por plano</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPlan}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <ReTooltip
                  formatter={(v: number, n: string) => (n === "receita" ? `R$ ${v.toFixed(2)}` : v)}
                />
                <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="surface-card mt-4 space-y-2 p-4">
          <p className="flex items-center gap-2 font-display text-xl">
            <AlertTriangle className="size-4 text-warning" /> Alertas
          </p>
          {alerts.map((a) => (
            <p key={a.id} className={`text-xs ${a.tone}`}>
              • {a.text}
            </p>
          ))}
        </div>
      )}

      <div className="surface-card mt-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl">Assinantes</p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por CPF, nome ou plano"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma assinatura encontrada. Vincule clientes em Planos de assinatura.
          </p>
        )}

        <div className="space-y-2">
          {filtered.map(({ sub, customer, plan, balance }) => {
            const status = SUB_STATUS[sub.status] ?? SUB_STATUS.pending;
            return (
              <div key={sub.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{customer?.name ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan?.name ?? "—"} · {brl(sub.price_cents)} ·{" "}
                      {customer?.cpf ? cpfMask(customer.cpf) : "sem CPF"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={status.tone}>
                      {status.dot} {status.label}
                    </Badge>
                    <Badge variant="secondary">{PAYMENT_STATUS[sub.payment_status]}</Badge>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
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
                  <span>Renovação: {balance ? dateLabel(balance.period_end) : "—"}</span>
                  <span>Início: {dateLabel(sub.started_on)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sub.payment_status !== "paid" && sub.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => markPaid.mutate(sub)}>
                      Registrar pagamento
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => renew.mutate(sub.id)}>
                    <RefreshCw className="size-4" /> Renovar ciclo
                  </Button>
                  {customer?.phone && (
                    <Button size="sm" variant="secondary" asChild>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Olá, ${customer.name}! Seu plano ${plan?.name ?? ""} está ${
                            sub.status === "active" ? "ativo" : "inativo"
                          } e você possui ${balance?.cuts_left ?? 0} corte(s) disponíveis neste ciclo.`,
                        )}`}
                      >
                        <MessageCircle className="size-4" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  {sub.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" onClick={() => setCancelTarget(sub)}>
                      <XCircle className="size-4 text-destructive" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
            <AlertDialogAction onClick={() => cancel.mutate()}>Cancelar assinatura</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
