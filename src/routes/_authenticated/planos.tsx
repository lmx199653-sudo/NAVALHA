import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, Plus, Scissors, Search, Trash2, UserCheck, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlansPage,
});

type Plan = {
  id: string;
  name: string;
  price_cents: number;
  cuts_included: number;
  beards_included: number;
  benefits: string | null;
  active: boolean;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  points: number;
};

const EMPTY = { name: "", price: "", cuts: "4", beards: "0", benefits: "", active: true };
const EMPTY_CUSTOMER = { name: "", phone: "" };

function cpfDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function cpfMask(value: string) {
  const d = cpfDigits(value);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function PlansPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  // Assinatura de cliente em um plano
  const [enrollPlan, setEnrollPlan] = useState<Plan | null>(null);
  const [cpf, setCpf] = useState("");
  const [found, setFound] = useState<Customer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [lookupPending, setLookupPending] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["plans", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("barbershop_id", shop!.id)
        .order("price_cents");
      return (data ?? []) as Plan[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscription_plans").insert({
        barbershop_id: shop!.id,
        name: form.name,
        price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
        cuts_included: Number(form.cuts) || 0,
        beards_included: Number(form.beards) || 0,
        benefits: form.benefits || null,
        active: form.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(false);
      setForm(EMPTY);
      toast.success("Plano criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });

  const openEnroll = (plan: Plan) => {
    setEnrollPlan(plan);
    setCpf("");
    setFound(null);
    setNotFound(false);
    setNewCustomer(EMPTY_CUSTOMER);
  };

  const lookupCustomer = async (digits: string) => {
    if (!shop?.id) return;
    setLookupPending(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, cpf, points")
        .eq("barbershop_id", shop.id)
        .eq("cpf", digits)
        .maybeSingle();
      if (error) throw error;
      const customer = (data ?? null) as Customer | null;
      setFound(customer);
      setNotFound(!customer);
      if (customer) toast.success(`Cliente encontrado: ${customer.name}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar cliente");
    } finally {
      setLookupPending(false);
    }
  };

  // Busca automática por CPF quando 11 dígitos são informados
  useEffect(() => {
    const digits = cpfDigits(cpf);
    if (digits.length !== 11) {
      setFound(null);
      setNotFound(false);
      return;
    }
    const timer = window.setTimeout(() => lookupCustomer(digits), 500);
    return () => window.clearTimeout(timer);
  }, [cpf]);

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!enrollPlan) return;
      const digits = cpfDigits(cpf);
      if (digits.length !== 11) throw new Error("Informe um CPF válido com 11 dígitos");
      let customerId = found?.id ?? "";

      if (!customerId) {
        if (newCustomer.name.trim().length < 2) throw new Error("Informe o nome do cliente");
        const { data, error } = await supabase
          .from("customers")
          .insert({
            barbershop_id: shop!.id,
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim() || null,
            cpf: digits,
          })
          .select("id")
          .single();
        if (error) throw error;
        customerId = data!.id as string;
      }

      const nextPayment = new Date();
      nextPayment.setMonth(nextPayment.getMonth() + 1);

      const { error } = await supabase.from("customer_subscriptions").insert({
        barbershop_id: shop!.id,
        customer_id: customerId,
        plan_id: enrollPlan.id,
        status: "active",
        uses_left: enrollPlan.cuts_included + enrollPlan.beards_included,
        next_payment: nextPayment.toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEnrollPlan(null);
      toast.success("Assinatura registrada para o cliente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Planos de assinatura"
      subtitle="Receita recorrente: clientes pagam por mês e voltam sempre"
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo plano
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((p, i) => (
          <div
            key={p.id}
            className={`surface-card relative p-6 ${
              i === 1 ? "border-primary/60 shadow-[0_0_40px_-20px_oklch(0.78_0.13_85)]" : ""
            }`}
          >
            {i === 1 && (
              <Badge className="absolute right-4 top-4 gap-1">
                <Crown className="size-3" /> Destaque
              </Badge>
            )}
            <h3 className="font-display text-3xl">{p.name}</h3>
            <p className="mt-2">
              <span className="font-display text-4xl text-primary">{brl(p.price_cents)}</span>
              <span className="text-xs text-muted-foreground"> /mês</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Scissors className="size-4 text-primary" /> {p.cuts_included} cortes por mês
              </li>
              <li className="flex items-center gap-2">
                <Scissors className="size-4 text-primary" /> {p.beards_included} barbas por mês
              </li>
              {p.benefits && <li className="pt-1">{p.benefits}</li>}
            </ul>
            <div className="mt-5 flex items-center gap-2">
              <Button size="sm" className="gap-1" onClick={() => openEnroll(p)}>
                <UserPlus className="size-4" /> Assinar cliente
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => remove.mutate(p.id)}
              >
                <Trash2 className="size-4" /> Remover
              </Button>
            </div>
          </div>
        ))}
        {plans?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum plano criado. Assinaturas são a forma mais rápida de estabilizar o faturamento.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo plano</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cortes</Label>
                <Input type="number" value={form.cuts} onChange={(e) => setForm({ ...form, cuts: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Barbas</Label>
                <Input type="number" value={form.beards} onChange={(e) => setForm({ ...form, beards: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Benefícios</Label>
              <Textarea rows={2} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label>Ativo</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <Button className="w-full" disabled={save.isPending}>
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enrollPlan} onOpenChange={(v) => !v && setEnrollPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar cliente — {enrollPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CPF do cliente</Label>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(cpfMask(e.target.value))}
                  disabled={lookupPending}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => lookupCustomer(cpfDigits(cpf))}
                  disabled={lookupPending || cpfDigits(cpf).length !== 11}
                >
                  {lookupPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Buscar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Digite o CPF. Se o cliente já estiver cadastrado na barbearia, os dados dele aparecem automaticamente.
              </p>
            </div>

            {found && (
              <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <UserCheck className="size-4" /> Cliente cadastrado
                </div>
                <div className="text-sm">
                  <p className="font-medium">{found.name}</p>
                  {found.phone && <p className="text-muted-foreground">{found.phone}</p>}
                  {found.email && <p className="text-muted-foreground">{found.email}</p>}
                  <p className="text-muted-foreground">CPF: {cpfMask(found.cpf ?? cpf)}</p>
                  <p className="text-muted-foreground">{found.points} pontos de fidelidade</p>
                </div>
              </div>
            )}

            {notFound && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Cliente não encontrado. Complete o cadastro para registrar a assinatura:
                </p>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp / telefone</Label>
                  <Input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  />
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={subscribe.isPending || cpfDigits(cpf).length !== 11 || (!found && !notFound)}
              onClick={() => subscribe.mutate()}
            >
              {subscribe.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar assinatura — {enrollPlan ? brl(enrollPlan.price_cents) : ""}/mês
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
