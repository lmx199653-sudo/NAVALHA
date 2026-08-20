import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Crown, Plus, Scissors, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const EMPTY = { name: "", price: "", cuts: "4", beards: "0", benefits: "", active: true };

function PlansPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

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
            <Button
              variant="ghost"
              size="sm"
              className="mt-5 text-destructive"
              onClick={() => remove.mutate(p.id)}
            >
              <Trash2 className="size-4" /> Remover
            </Button>
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
    </AppShell>
  );
}
