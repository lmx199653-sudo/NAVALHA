import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, Pencil, Plus, Power, Trash2, UserPlus } from "lucide-react";

import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { brl } from "@/lib/format";
import { CpfCustomerLookup } from "@/components/CpfCustomerLookup";
import {
  createSubscription,
  friendlyError,
  type CpfLookup,
  type Plan,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlansPage,
});

const EMPTY = {
  name: "",
  price: "",
  cuts: "4",
  beards: "2",
  extras: "0",
  cycle: "30",
  limit: "",
  benefits: "",
  active: true,
};

type FormState = typeof EMPTY;

function PlansPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);

  const [enrollPlan, setEnrollPlan] = useState<Plan | null>(null);
  const [lookup, setLookup] = useState<CpfLookup | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plans", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [plans, subs] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("barbershop_id", shop!.id).order("price_cents"),
        supabase
          .from("customer_subscriptions")
          .select("id, plan_id, status")
          .eq("barbershop_id", shop!.id),
      ]);
      return {
        plans: (plans.data ?? []) as Plan[],
        subs: (subs.data ?? []) as Array<{ id: string; plan_id: string; status: string }>,
      };
    },
  });

  const plans = data?.plans ?? [];
  const subscribersOf = (planId: string) => (data?.subs ?? []).filter((s) => s.plan_id === planId);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      price: (plan.price_cents / 100).toFixed(2).replace(".", ","),
      cuts: String(plan.cuts_included),
      beards: String(plan.beards_included),
      extras: String(plan.extras_included ?? 0),
      cycle: String(plan.cycle_days ?? 30),
      limit: plan.usage_limit ? String(plan.usage_limit) : "",
      benefits: plan.benefits ?? "",
      active: plan.active,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const price = Math.round(Number(form.price.replace(/\./g, "").replace(",", ".")) * 100);
      const cuts = Number(form.cuts);
      const beards = Number(form.beards);
      const extras = Number(form.extras);
      const cycle = Number(form.cycle);
      if (form.name.trim().length < 2) throw new Error("Informe o nome do plano.");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Informe um preço válido.");
      for (const [label, v] of [["cortes", cuts], ["barbas", beards], ["extras", extras]] as const) {
        if (!Number.isInteger(v) || v < 0) throw new Error(`Quantidade de ${label} inválida.`);
      }
      if (!Number.isInteger(cycle) || cycle < 1) throw new Error("Duração do ciclo inválida.");

      const payload = {
        barbershop_id: shop!.id,
        name: form.name.trim(),
        price_cents: price,
        cuts_included: cuts,
        beards_included: beards,
        extras_included: extras,
        cycle_days: cycle,
        usage_limit: form.limit ? Number(form.limit) : null,
        benefits: form.benefits.trim() || null,
        active: form.active,
      };
      const { error } = editing
        ? await supabase.from("subscription_plans").update(payload).eq("id", editing.id)
        : await supabase.from("subscription_plans").insert(payload);
      if (error) throw new Error(friendlyError(error.message));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(false);
      setForm(EMPTY);
      setEditing(null);
      toast.success(editing ? "Plano atualizado" : "Plano criado");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const toggleActive = useMutation({
    mutationFn: async (plan: Plan) => {
      const { error } = await supabase
        .from("subscription_plans")
        .update({ active: !plan.active })
        .eq("id", plan.id);
      if (error) throw new Error(friendlyError(error.message));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Status do plano atualizado");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const remove = useMutation({
    mutationFn: async (plan: Plan) => {
      if (subscribersOf(plan.id).length > 0)
        throw new Error("Este plano possui clientes vinculados. Use a opção Desativar.");
      const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
      if (error) throw new Error(friendlyError(error.message));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setConfirmDelete(null);
      toast.success("Plano excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!enrollPlan) throw new Error("Selecione um plano.");
      const customerId = lookup?.customer?.id;
      if (!customerId) throw new Error("Busque o cliente pelo CPF antes de assinar.");
      await createSubscription(shop!.id, customerId, enrollPlan.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEnrollPlan(null);
      setLookup(null);
      toast.success("Assinatura criada com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Planos de assinatura"
      subtitle="Crie planos recorrentes e vincule clientes"
      action={
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Novo plano
        </Button>
      }
    >
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && plans.length === 0 && (
        <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
          <Crown className="size-8 text-primary" />
          <p className="font-display text-2xl">Nenhum plano cadastrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Crie planos mensais com cortes e barbas inclusos para fidelizar seus clientes.
          </p>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Criar primeiro plano
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const active = subscribersOf(plan.id).filter((s) => s.status === "active").length;
          return (
            <div key={plan.id} className="surface-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-2xl">{plan.name}</p>
                  <p className="text-sm text-primary">
                    {brl(plan.price_cents)}
                    <span className="text-muted-foreground"> / {plan.cycle_days} dias</span>
                  </p>
                </div>
                <Badge variant={plan.active ? "default" : "outline"}>
                  {plan.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{plan.cuts_included} corte(s) inclusos</li>
                <li>{plan.beards_included} barba(s) inclusas</li>
                {plan.extras_included > 0 && <li>{plan.extras_included} extra(s)</li>}
                {plan.benefits && <li className="text-foreground/80">{plan.benefits}</li>}
              </ul>
              <p className="text-xs text-muted-foreground">{active} assinante(s) ativo(s)</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!plan.active}
                  onClick={() => {
                    setEnrollPlan(plan);
                    setLookup(null);
                  }}
                >
                  <UserPlus className="size-4" /> Assinar cliente
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive.mutate(plan)}>
                  <Power className="size-4" /> {plan.active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(plan)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* criar/editar plano */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do plano</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Preço mensal (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="59,90"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duração do ciclo (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.cycle}
                  onChange={(e) => setForm({ ...form, cycle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cortes inclusos</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.cuts}
                  onChange={(e) => setForm({ ...form, cuts: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Barbas inclusas</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.beards}
                  onChange={(e) => setForm({ ...form, beards: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Outros benefícios (qtd.)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.extras}
                  onChange={(e) => setForm({ ...form, extras: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Limite total de usos (opcional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Benefícios / serviços incluídos</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: 1 acabamento por semana, 10% de desconto em produtos"
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Plano ativo</p>
                <p className="text-xs text-muted-foreground">Planos inativos não recebem novas assinaturas.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar plano
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* assinar cliente */}
      <Dialog open={!!enrollPlan} onOpenChange={(v) => !v && setEnrollPlan(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinar cliente — {enrollPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <CpfCustomerLookup shopId={shop?.id} onResult={(r) => setLookup(r)} />
            {lookup?.subscription?.status === "active" && (
              <p className="text-xs text-destructive">
                Este cliente já possui uma assinatura ativa. Cancele a atual antes de criar outra.
              </p>
            )}
            <Button
              className="w-full"
              disabled={!lookup?.customer || subscribe.isPending}
              onClick={() => subscribe.mutate()}
            >
              {subscribe.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar assinatura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && subscribersOf(confirmDelete.id).length > 0
                ? "Este plano possui clientes vinculados e não pode ser excluído. Você pode apenas desativá-lo."
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            {confirmDelete && subscribersOf(confirmDelete.id).length > 0 ? (
              <AlertDialogAction onClick={() => toggleActive.mutate(confirmDelete)}>
                Desativar plano
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={() => confirmDelete && remove.mutate(confirmDelete)}>
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
