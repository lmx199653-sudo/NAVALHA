import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, toDayKey } from "@/lib/format";
import { supabase } from "@/lib/supabase-guard";
import { CpfCustomerLookup } from "@/components/CpfCustomerLookup";
import {
  BENEFIT_LABEL,
  canUseBenefits,
  creditsLeft,
  friendlyError,
  type BenefitKind,
  type CpfLookup,
} from "@/lib/subscriptions";
import type { Appointment, BarberSummary, CustomerSummary, ServiceSummary } from "./types";

interface AppointmentFormProps {
  shopId: string | undefined;
  barbers: BarberSummary[];
  services: ServiceSummary[];
  customers: CustomerSummary[];
  defaultDate: Date;
  appointment?: Appointment | null;
  onDone: () => void;
}

export function AppointmentForm({
  shopId,
  barbers,
  services,
  customers,
  defaultDate,
  appointment = null,
  onDone,
}: AppointmentFormProps) {
  const startDate = appointment ? new Date(appointment.starts_at) : null;
  const [customerId, setCustomerId] = useState(appointment?.customer_id ?? "");
  const [name, setName] = useState(appointment?.customer_name ?? "");
  const [phone, setPhone] = useState(appointment?.customer_phone ?? "");
  const [barberId, setBarberId] = useState(appointment?.barber_id ?? barbers[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(appointment?.service_id ?? services[0]?.id ?? "");
  const [day, setDay] = useState(toDayKey(startDate ?? defaultDate));
  const [time, setTime] = useState(
    startDate
      ? `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
      : "10:00",
  );
  const [saving, setSaving] = useState(false);
  const [lookup, setLookup] = useState<CpfLookup | null>(null);
  const [useBenefit, setUseBenefit] = useState(true);

  const service = services.find((s) => s.id === serviceId);
  const benefitKind = (service?.benefit_kind ?? null) as BenefitKind | null;
  const subscription = lookup?.subscription ?? null;
  const balance = lookup?.balance ?? null;
  const planActive = canUseBenefits(subscription, balance);
  const left = benefitKind ? creditsLeft(balance, benefitKind) : 0;
  const includedInPlan = planActive && !!benefitKind && creditsTotalOf(balance, benefitKind) > 0;
  const canConsume = includedInPlan && left > 0 && useBenefit;

  function creditsTotalOf(b: typeof balance, kind: BenefitKind) {
    if (!b) return 0;
    if (kind === "cut") return b.cuts_credits;
    if (kind === "beard") return b.beards_credits;
    return b.extras_credits;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    if (!service) {
      toast.error("Cadastre um serviço primeiro.");
      return;
    }
    const chosen = lookup?.customer ?? customers.find((c) => c.id === customerId) ?? null;
    const starts = new Date(`${day}T${time}:00`);
    const payload = {
      barbershop_id: shopId,
      barber_id: barberId || null,
      service_id: serviceId,
      customer_id: chosen?.id ?? null,
      customer_name: chosen?.name ?? name,
      customer_phone: chosen?.phone ?? phone,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + service.duration_min * 60000).toISOString(),
      price_cents: canConsume ? 0 : service.price_cents,
      subscription_id: canConsume ? subscription!.id : null,
      benefit_kind: canConsume ? benefitKind : null,
      use_benefit: canConsume,
    };
    setSaving(true);
    const { error } = appointment
      ? await supabase.from("appointments").update(payload).eq("id", appointment.id)
      : await supabase.from("appointments").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error.message));
      return;
    }
    toast.success(appointment ? "Agendamento atualizado" : "Agendamento criado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CpfCustomerLookup
        shopId={shopId}
        onResult={(r) => {
          setLookup(r);
          if (r?.customer) setCustomerId(r.customer.id);
        }}
      />

      {!lookup?.customer && (
        <>
          <div className="space-y-2">
            <Label>Ou selecione um cliente cadastrado</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar cliente (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!customerId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Serviço</Label>
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {brl(s.price_cents)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Barbeiro</Label>
          <Select value={barberId} onValueChange={setBarberId}>
            <SelectTrigger>
              <SelectValue placeholder="Barbeiro" />
            </SelectTrigger>
            <SelectContent>
              {barbers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Hora</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {subscription && service && (
        <div className="rounded-xl border border-border p-3 text-sm">
          {!planActive ? (
            <p className="text-muted-foreground">
              ⚫ Assinatura inativa ou expirada — atendimento cobrado normalmente (
              {brl(service.price_cents)}).
            </p>
          ) : !includedInPlan ? (
            <p className="text-muted-foreground">
              Este serviço não está incluído na assinatura. Valor: {brl(service.price_cents)}.
            </p>
          ) : left <= 0 ? (
            <div className="space-y-2">
              <p className="text-destructive">
                🔴 Limite de {BENEFIT_LABEL[benefitKind!].toLowerCase()}s atingido
              </p>
              <p className="text-xs text-muted-foreground">
                Este cliente já utilizou todos os créditos deste ciclo. Você pode continuar como
                atendimento avulso ({brl(service.price_cents)}).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-success">🟢 Incluso no plano — valor cobrado: {brl(0)}</p>
              <p className="text-xs text-muted-foreground">
                1 crédito de {BENEFIT_LABEL[benefitKind!].toLowerCase()} será utilizado somente após
                a conclusão do atendimento ({left} disponível(is)).
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={useBenefit}
                  onChange={(e) => setUseBenefit(e.target.checked)}
                  className="size-4 accent-[hsl(var(--primary))]"
                />
                Usar benefício da assinatura
              </label>
            </div>
          )}
        </div>
      )}
      <Button className="w-full" disabled={saving}>
        {appointment ? "Salvar alterações" : "Salvar agendamento"}
      </Button>
    </form>
  );
}
