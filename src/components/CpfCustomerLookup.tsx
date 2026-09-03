import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cpfDigits,
  cpfMask,
  cpfPartial,
  friendlyError,
  isValidCpf,
  lookupCustomerByCpf,
  type CpfLookup,
} from "@/lib/subscriptions";
import { SubscriptionCard } from "@/components/SubscriptionCard";

/**
 * Busca de cliente por CPF com debounce, cadastro rápido e cartão de assinatura.
 * Toda a consulta é feita no servidor (função `customer_by_cpf`).
 */
export function CpfCustomerLookup({
  shopId,
  onResult,
  showSubscription = true,
}: {
  shopId: string | undefined;
  onResult: (result: CpfLookup | null, cpf: string) => void;
  showSubscription?: boolean;
}) {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CpfLookup | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const digits = cpfDigits(cpf);
    setInvalid(false);
    if (digits.length !== 11) {
      setResult(null);
      setCreating(false);
      onResult(null, digits);
      return;
    }
    if (!isValidCpf(digits)) {
      setInvalid(true);
      setResult(null);
      onResult(null, digits);
      return;
    }
    if (!shopId) return;
    const id = ++latest.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await lookupCustomerByCpf(shopId, digits);
        if (latest.current !== id) return;
        setResult(found);
        setCreating(!found.found);
        onResult(found, digits);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? friendlyError(e.message) : "Erro ao buscar cliente");
      } finally {
        if (latest.current === id) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpf, shopId]);

  async function createCustomer() {
    if (!shopId) return;
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome completo do cliente.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      barbershop_id: shopId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      cpf: cpfDigits(cpf),
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    toast.success("Cliente cadastrado");
    const found = await lookupCustomerByCpf(shopId, cpf);
    setResult(found);
    setCreating(false);
    onResult(found, cpfDigits(cpf));
  }

  const customer = result?.customer;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>CPF do cliente</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            inputMode="numeric"
            placeholder="000.000.000-00"
            className="pl-9"
            value={cpfMask(cpf)}
            onChange={(e) => setCpf(cpfDigits(e.target.value))}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" />
          )}
        </div>
        {invalid && <p className="text-xs text-destructive">CPF inválido.</p>}
      </div>

      {loading && <Skeleton className="h-20 w-full rounded-xl" />}

      {!loading && customer && (
        <div className="space-y-3">
          <div className="rounded-xl border border-success/35 bg-success/[0.07] p-3">
            <p className="eyebrow text-success">Cliente encontrado</p>
            <p className="font-display text-xl">{customer.name}</p>
            <p className="text-xs text-muted-foreground">
              {cpfPartial(customer.cpf)} · {customer.phone || "sem telefone"}
            </p>
          </div>
          {showSubscription && (
            <SubscriptionCard
              subscription={result?.subscription ?? null}
              plan={result?.plan ?? null}
              balance={result?.balance ?? null}
              compact
            />
          )}
        </div>
      )}

      {!loading && result && !result.found && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
          <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
          {!creating ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
              <UserPlus className="size-4" /> Cadastrar novo cliente
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <Button type="button" size="sm" disabled={saving} onClick={createCustomer}>
                {saving && <Loader2 className="size-4 animate-spin" />} Salvar cliente
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
