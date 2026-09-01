import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Plus, Search, Star } from "lucide-react";

import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dateLabel, STATUS_LABEL } from "@/lib/format";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import {
  BENEFIT_LABEL,
  cpfDigits,
  cpfMask,
  friendlyError,
  isValidCpf,
  PAYMENT_STATUS,
  type BenefitKind,
  type CycleBalance,
  type PaymentStatus,
  type Plan,
  type Subscription,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  birth_date: string | null;
  notes: string | null;
  points: number;
  created_at?: string;
};

const EMPTY = { name: "", phone: "", email: "", cpf: "", birth_date: "", notes: "" };

function CustomersPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [customers, appts, services, subs, plans] = await Promise.all([
        supabase.from("customers").select("*").eq("barbershop_id", shop!.id).order("name"),
        supabase
          .from("appointments")
          .select("id, customer_id, starts_at, price_cents, status, service_id, barber_id, use_benefit, benefit_kind")
          .eq("barbershop_id", shop!.id)
          .order("starts_at", { ascending: false }),
        supabase.from("services").select("id, name").eq("barbershop_id", shop!.id),
        supabase.from("customer_subscriptions").select("*").eq("barbershop_id", shop!.id),
        supabase.from("subscription_plans").select("*").eq("barbershop_id", shop!.id),
      ]);
      return {
        customers: (customers.data ?? []) as Customer[],
        appts: appts.data ?? [],
        services: services.data ?? [],
        subs: (subs.data ?? []) as unknown as Subscription[],
        plans: (plans.data ?? []) as unknown as Plan[],
      };
    },
  });

  // Dados de assinatura do cliente aberto (saldo, utilizações e pagamentos).
  const { data: detailData } = useQuery({
    queryKey: ["customer-subscription", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const [balances, usages, payments] = await Promise.all([
        supabase.from("subscription_cycle_balances").select("*").eq("barbershop_id", shop!.id),
        supabase
          .from("subscription_usages")
          .select("*")
          .eq("customer_id", detail!.id)
          .order("created_at", { ascending: false }),
        supabase.from("subscription_payments").select("*").eq("barbershop_id", shop!.id),
      ]);
      return {
        balances: (balances.data ?? []) as unknown as CycleBalance[],
        usages: (usages.data ?? []) as unknown as Array<{
          id: string;
          benefit_kind: BenefitKind;
          kind: "debit" | "refund";
          quantity: number;
          created_at: string;
          barber_id: string | null;
          service_id: string | null;
          reason: string | null;
        }>,
        payments: (payments.data ?? []) as unknown as Array<{
          id: string;
          subscription_id: string;
          amount_cents: number;
          status: PaymentStatus;
          method: string | null;
          due_date: string | null;
          paid_at: string | null;
        }>,
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.name.trim().length < 2) throw new Error("Informe o nome completo.");
      const digits = cpfDigits(form.cpf);
      if (digits && !isValidCpf(digits)) throw new Error("CPF inválido.");
      if (digits) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id, name")
          .eq("barbershop_id", shop!.id)
          .eq("cpf", digits)
          .maybeSingle();
        if (existing) throw new Error(`Este CPF já está cadastrado (${existing.name}).`);
      }
      const { error } = await supabase.from("customers").insert({
        barbershop_id: shop!.id,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        cpf: digits || null,
        birth_date: form.birth_date || null,
        notes: form.notes || null,
      });
      if (error) throw new Error(friendlyError(error.message));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm(EMPTY);
      toast.success("Cliente cadastrado");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const rows = useMemo(() => {
    const list = data?.customers ?? [];
    const appts = data?.appts ?? [];
    const term = search.toLowerCase().trim();
    const termDigits = cpfDigits(search);
    return list
      .filter((c) => {
        if (!term) return true;
        const haystack = `${c.name} ${c.phone ?? ""} ${c.email ?? ""} ${c.id}`.toLowerCase();
        return haystack.includes(term) || (!!termDigits && (c.cpf ?? "").includes(termDigits));
      })
      .map((c) => {
        const mine = appts.filter((a) => a.customer_id === c.id);
        const past = mine.filter((a) => new Date(a.starts_at) < new Date() && a.status === "done");
        const next = mine
          .filter((a) => new Date(a.starts_at) >= new Date() && a.status !== "canceled")
          .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
        const last = past[0];
        const daysSince = last
          ? Math.floor((Date.now() - +new Date(last.starts_at)) / 86400000)
          : null;
        const counts = past.reduce<Record<string, number>>((acc, a) => {
          const n = data?.services.find((s) => s.id === a.service_id)?.name ?? "—";
          acc[n] = (acc[n] ?? 0) + 1;
          return acc;
        }, {});
        const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const sub =
          (data?.subs ?? []).find((s) => s.customer_id === c.id && s.status === "active") ??
          (data?.subs ?? []).find((s) => s.customer_id === c.id) ??
          null;
        return {
          customer: c,
          visits: past.length,
          total: past.reduce((s, a) => s + a.price_cents, 0),
          last,
          next,
          daysSince,
          favorite,
          history: mine,
          subscription: sub,
          plan: sub ? ((data?.plans ?? []).find((p) => p.id === sub.plan_id) ?? null) : null,
        };
      });
  }, [data, search]);

  const detailRow = rows.find((r) => r.customer.id === detail?.id);
  const detailBalance = detailRow?.subscription
    ? ((detailData?.balances ?? [])
        .filter((b) => b.subscription_id === detailRow.subscription!.id)
        .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0] ?? null)
    : null;
  const detailPayments = (detailData?.payments ?? []).filter(
    (p) => p.subscription_id === detailRow?.subscription?.id,
  );

  return (
    <AppShell
      title="Clientes"
      subtitle={`${rows.length} clientes na base`}
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo cliente
        </Button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por CPF, nome, WhatsApp ou ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="surface-card p-10 text-center">
          <p className="font-display text-2xl">Nenhum cliente encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre clientes com CPF para identificá-los rapidamente no atendimento.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <button
            key={r.customer.id}
            onClick={() => setDetail(r.customer)}
            className="surface-card p-4 text-left transition-colors hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-2xl leading-none">{r.customer.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.customer.phone} {r.customer.cpf ? `· ${cpfMask(r.customer.cpf)}` : ""}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Star className="size-3 text-primary" /> {r.customer.points}
              </Badge>
            </div>
            {r.subscription && r.plan && (
              <p className="mt-2 text-xs text-primary">
                {r.plan.name} · {r.subscription.status === "active" ? "🟢 ativa" : "⚫ inativa"}
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <p className="text-muted-foreground">
                Visitas: <span className="text-foreground">{r.visits}</span>
              </p>
              <p className="text-muted-foreground">
                Gasto: <span className="text-primary">{brl(r.total)}</span>
              </p>
            </div>
            {r.daysSince !== null && r.daysSince > 30 && (
              <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                Cliente há {r.daysSince} dias sem voltar.
              </p>
            )}
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpfMask(form.cpf)}
                  onChange={(e) => setForm({ ...form, cpf: cpfDigits(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nascimento</Label>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" disabled={save.isPending}>
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <Tabs defaultValue="dados">
              <TabsList className="w-full overflow-x-auto">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
                <TabsTrigger value="utilizacoes">Utilizações</TabsTrigger>
                <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="WhatsApp" value={detailRow.customer.phone ?? "—"} />
                  <Field label="CPF" value={detailRow.customer.cpf ? cpfMask(detailRow.customer.cpf) : "—"} />
                  <Field label="E-mail" value={detailRow.customer.email ?? "—"} />
                  <Field
                    label="Nascimento"
                    value={detailRow.customer.birth_date ? dateLabel(detailRow.customer.birth_date) : "—"}
                  />
                  <Field
                    label="Cadastrado em"
                    value={detailRow.customer.created_at ? dateLabel(detailRow.customer.created_at) : "—"}
                  />
                  <Field label="Serviço favorito" value={detailRow.favorite ?? "—"} />
                  <Field label="Visitas" value={String(detailRow.visits)} />
                  <Field label="Total gasto" value={brl(detailRow.total)} />
                </div>
                {detailRow.customer.notes && (
                  <p className="rounded-lg bg-secondary/50 p-3 text-xs">{detailRow.customer.notes}</p>
                )}
                {detailRow.customer.phone && (
                  <Button asChild className="w-full">
                    <a
                      href={`https://wa.me/55${detailRow.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Olá ${detailRow.customer.name}! Que tal agendar seu próximo corte?`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="size-4" /> Enviar lembrete
                    </a>
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="assinatura" className="pt-4">
                <SubscriptionCard
                  subscription={detailRow.subscription}
                  plan={detailRow.plan}
                  balance={detailBalance}
                />
              </TabsContent>

              <TabsContent value="utilizacoes" className="space-y-2 pt-4">
                {(detailData?.usages ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma utilização registrada.</p>
                )}
                {(detailData?.usages ?? []).map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs"
                  >
                    <span>{dateLabel(u.created_at)}</span>
                    <span>{BENEFIT_LABEL[u.benefit_kind]}</span>
                    <span className={u.kind === "refund" ? "text-success" : "text-primary"}>
                      {u.kind === "refund" ? `+${u.quantity} estorno` : `-${u.quantity} crédito`}
                    </span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="agendamentos" className="space-y-2 pt-4">
                {detailRow.history.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum atendimento ainda.</p>
                )}
                {detailRow.history.slice(0, 20).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs"
                  >
                    <span>{dateLabel(a.starts_at)}</span>
                    <span className="text-muted-foreground">
                      {data?.services.find((s) => s.id === a.service_id)?.name}
                    </span>
                    <span className="text-primary">{a.use_benefit ? "Plano" : brl(a.price_cents)}</span>
                    <span className="text-muted-foreground">{STATUS_LABEL[a.status]}</span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-2 pt-4">
                {detailPayments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma cobrança registrada.</p>
                )}
                {detailPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs"
                  >
                    <span>{p.paid_at ? dateLabel(p.paid_at) : p.due_date ? dateLabel(p.due_date) : "—"}</span>
                    <span className="text-primary">{brl(p.amount_cents)}</span>
                    <span className="text-muted-foreground">{PAYMENT_STATUS[p.status]}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
