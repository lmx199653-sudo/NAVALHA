import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";

import { supabase } from "@/lib/supabase-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cpfDigits, cpfMask, friendlyError, isValidCpf, type Plan } from "@/lib/subscriptions";
import type { AlertCustomer } from "@/lib/subscription-alerts";
import {
  addDays,
  createSubscriber,
  PAY_METHOD_LABEL,
  today,
  type PayMethod,
} from "@/lib/subscription-actions";

export function NewSubscriberDialog({
  open,
  onOpenChange,
  shopId,
  plans,
  customers,
  activeCustomerIds,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shopId: string | undefined;
  plans: Plan[];
  customers: AlertCustomer[];
  activeCustomerIds: Set<string>;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [term, setTerm] = useState("");
  const [customer, setCustomer] = useState<AlertCustomer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "" });
  const [planId, setPlanId] = useState("");
  const [startedOn, setStartedOn] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [dueTouched, setDueTouched] = useState(false);
  const [payNow, setPayNow] = useState(false);
  const [method, setMethod] = useState<PayMethod>("pix");

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);
  const plan = activePlans.find((p) => p.id === planId) ?? null;

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setTerm("");
    setCustomer(null);
    setForm({ name: "", phone: "", cpf: "" });
    setPlanId(activePlans[0]?.id ?? "");
    setStartedOn(today());
    setDueTouched(false);
    setPayNow(false);
    setMethod("pix");
  }, [open, activePlans]);

  useEffect(() => {
    if (dueTouched) return;
    setDueDate(addDays(startedOn, plan?.cycle_days ?? 30));
  }, [startedOn, plan, dueTouched]);

  const matches = useMemo(() => {
    const t = term.toLowerCase().trim();
    const digits = cpfDigits(term);
    if (!t) return customers.slice(0, 8);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(t) ||
          (c.phone ?? "").includes(t) ||
          (digits.length >= 3 && (c.cpf ?? "").includes(digits)),
      )
      .slice(0, 8);
  }, [term, customers]);

  const create = useMutation({
    mutationFn: async () => {
      if (!shopId) throw new Error("Barbearia não carregada.");
      if (!plan) throw new Error("Escolha um plano.");
      if (!startedOn || !dueDate) throw new Error("Informe início e vencimento.");
      if (dueDate <= startedOn) throw new Error("O vencimento deve ser depois do início.");

      let customerId = customer?.id ?? null;
      if (mode === "new") {
        if (form.name.trim().length < 2) throw new Error("Informe o nome do cliente.");
        const cpf = cpfDigits(form.cpf);
        if (cpf && !isValidCpf(cpf)) throw new Error("CPF inválido.");
        const { data, error } = await supabase
          .from("customers")
          .insert({
            barbershop_id: shopId,
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            cpf: cpf || null,
          })
          .select("id")
          .single();
        if (error) throw new Error(friendlyError(error.message));
        customerId = data.id;
      }
      if (!customerId) throw new Error("Selecione ou cadastre um cliente.");

      await createSubscriber({ shopId, customerId, plan, startedOn, dueDate, payNow, method });
    },
    onSuccess: () => {
      toast.success(
        payNow
          ? "Assinante criado e pagamento registrado"
          : "Assinante criado — pagamento pendente",
      );
      onCreated();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const selectedHasActive = customer ? activeCustomerIds.has(customer.id) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Novo assinante</DialogTitle>
          <DialogDescription>
            Vincule um cliente a um plano e defina o início do ciclo.
          </DialogDescription>
        </DialogHeader>

        {activePlans.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum plano ativo. Crie um plano na aba <b>Planos</b> antes de adicionar assinantes.
          </p>
        ) : (
          <div className="space-y-5">
            {/* ---------- cliente ---------- */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  1. Cliente
                </p>
                <div className="flex gap-1 rounded-full border border-border p-0.5">
                  {(
                    [
                      ["existing", "Existente"],
                      ["new", "Novo"],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setMode(k);
                        setCustomer(null);
                      }}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                        mode === k
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "existing" ? (
                customer ? (
                  <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.cpf ? cpfMask(customer.cpf) : "sem CPF"} ·{" "}
                        {customer.phone || "sem telefone"}
                      </p>
                      {selectedHasActive && (
                        <p className="mt-1 text-xs text-warning">
                          Este cliente já possui uma assinatura ativa.
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCustomer(null)}
                      aria-label="Trocar cliente"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        className="pl-9"
                        placeholder="Buscar por nome, CPF ou telefone"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                      />
                    </div>
                    <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                      {matches.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">
                          Nenhum cliente encontrado.{" "}
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => setMode("new")}
                          >
                            Cadastrar novo
                          </button>
                        </div>
                      )}
                      {matches.map((c) => {
                        const has = activeCustomerIds.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setCustomer(c)}
                            className="flex w-full items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-secondary/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.cpf ? cpfMask(c.cpf) : "sem CPF"} · {c.phone || "sem telefone"}
                              </p>
                            </div>
                            {has && (
                              <span className="shrink-0 text-[10px] text-warning">
                                já assinante
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
                  <div className="space-y-1.5">
                    <Label>Nome completo</Label>
                    <Input
                      autoFocus
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>WhatsApp</Label>
                      <Input
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CPF (opcional)</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpfMask(form.cpf)}
                        onChange={(e) => setForm({ ...form, cpf: cpfDigits(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ---------- plano ---------- */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                2. Plano
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {activePlans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      planId === p.id
                        ? "border-primary/60 bg-primary/10"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{p.name}</p>
                      {planId === p.id && <Check className="size-4 shrink-0 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {brl(p.price_cents)} · {p.cuts_included} corte(s), {p.beards_included}{" "}
                      barba(s) · {p.cycle_days} dias
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* ---------- datas ---------- */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                3. Período
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input
                    type="date"
                    value={startedOn}
                    onChange={(e) => setStartedOn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueTouched(true);
                      setDueDate(e.target.value);
                    }}
                  />
                </div>
              </div>
            </section>

            {/* ---------- pagamento ---------- */}
            <section className="space-y-3 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Registrar pagamento agora</p>
                  <p className="text-xs text-muted-foreground">
                    {plan
                      ? `${brl(plan.price_cents)} referente ao primeiro ciclo`
                      : "Escolha um plano"}
                  </p>
                </div>
                <Switch checked={payNow} onCheckedChange={setPayNow} />
              </div>
              {payNow && (
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
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
              )}
            </section>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  create.isPending || selectedHasActive || (mode === "existing" && !customer)
                }
                onClick={() => create.mutate()}
              >
                {create.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Criar assinante
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
