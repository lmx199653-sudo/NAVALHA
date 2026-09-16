import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  IdCard,
  Loader2,
  Scissors,
  Search,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, toDayKey } from "@/lib/format";
import { supabase } from "@/lib/supabase-guard";
import { CpfCustomerLookup } from "@/components/CpfCustomerLookup";
import { availableSlots, type BreakRow, type HoursRow } from "@/lib/slots";
import { saveAppointmentServices } from "@/lib/appointment-services";
import {
  BENEFIT_LABEL,
  canUseBenefits,
  creditsLeft,
  creditsTotal,
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
  defaultTime?: string | undefined;
  preselectedServiceIds?: string[];
  appointment?: Appointment | null;
  onDone: () => void;
}

const STEPS = ["Cliente", "Serviços", "Barbeiro", "Horário", "Confirmar"] as const;

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1.5">
          <span
            className={`h-1 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-border"
            }`}
          />
          <span
            className={`hidden text-[10px] font-semibold uppercase tracking-wider sm:block ${
              i === step ? "text-primary" : "text-muted-foreground/70"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AppointmentForm({
  shopId,
  barbers,
  services,
  customers,
  defaultDate,
  defaultTime,
  preselectedServiceIds = [],
  appointment = null,
  onDone,
}: AppointmentFormProps) {
  const startDate = appointment ? new Date(appointment.starts_at) : null;

  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [showCpf, setShowCpf] = useState(false);
  const [lookup, setLookup] = useState<CpfLookup | null>(null);
  const [customerId, setCustomerId] = useState(appointment?.customer_id ?? "");
  const [name, setName] = useState(appointment?.customer_name ?? "");
  const [phone, setPhone] = useState(appointment?.customer_phone ?? "");
  const [manual, setManual] = useState(!!appointment && !appointment.customer_id);

  const [serviceIds, setServiceIds] = useState<string[]>(
    appointment?.service_id
      ? [appointment.service_id]
      : preselectedServiceIds.length
        ? preselectedServiceIds
        : [],
  );
  const [barberId, setBarberId] = useState(appointment?.barber_id ?? barbers[0]?.id ?? "");
  const [day, setDay] = useState(toDayKey(startDate ?? defaultDate));
  const [time, setTime] = useState(
    startDate
      ? `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
      : (defaultTime ?? "10:00"),
  );
  const [useBenefit, setUseBenefit] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carrega itens já salvos ao editar um agendamento com vários serviços.
  useEffect(() => {
    if (!appointment?.id) return;
    let alive = true;
    void supabase
      .from("appointment_services")
      .select("service_id")
      .eq("appointment_id", appointment.id)
      .then(({ data }) => {
        const ids = (data ?? []).map((r) => r.service_id).filter(Boolean) as string[];
        if (alive && ids.length) setServiceIds(ids);
      });
    return () => {
      alive = false;
    };
  }, [appointment?.id]);

  const selectedServices = useMemo(
    () => serviceIds.map((id) => services.find((s) => s.id === id)).filter(Boolean) as ServiceSummary[],
    [serviceIds, services],
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price_cents, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_min, 0);

  const chosenCustomer =
    lookup?.customer ?? customers.find((c) => c.id === customerId) ?? null;
  const displayName = manual ? name : (chosenCustomer?.name ?? name);
  const displayPhone = manual ? phone : (chosenCustomer?.phone ?? phone);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const list = customers.filter((c) => {
      if (!q) return true;
      const byName = c.name.toLowerCase().includes(q);
      const byPhone = digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits);
      return byName || byPhone;
    });
    return list.slice(0, 40);
  }, [customers, search]);

  /* ---------- disponibilidade ---------- */

  const dayDate = useMemo(() => new Date(`${day}T00:00:00`), [day]);

  const { data: availability, isLoading: loadingSlots } = useQuery({
    queryKey: ["agenda-availability", shopId, barberId, day],
    enabled: !!shopId && step === 3,
    queryFn: async () => {
      const startIso = new Date(`${day}T00:00:00`).toISOString();
      const endIso = new Date(new Date(`${day}T00:00:00`).getTime() + 86400000).toISOString();
      const [hours, breaks, busy] = await Promise.all([
        supabase.from("business_hours").select("*").eq("barbershop_id", shopId!),
        supabase.from("schedule_breaks").select("*").eq("barbershop_id", shopId!),
        supabase
          .from("appointments")
          .select("id, starts_at, ends_at, barber_id, status")
          .eq("barbershop_id", shopId!)
          .gte("starts_at", startIso)
          .lt("starts_at", endIso),
      ]);
      return {
        hours: (hours.data ?? []) as HoursRow[],
        breaks: (breaks.data ?? []) as BreakRow[],
        busy: (busy.data ?? []) as {
          id: string;
          starts_at: string;
          ends_at: string;
          barber_id: string | null;
          status: string;
        }[],
      };
    },
  });

  const barber = barbers.find((b) => b.id === barberId) as
    | (BarberSummary & { work_days: number[]; start_time: string; end_time: string })
    | undefined;

  const slots = useMemo(() => {
    if (!availability || !totalDuration) return [];
    const busy = availability.busy
      .filter((b) => b.id !== appointment?.id)
      .filter((b) => !["canceled", "no_show"].includes(b.status))
      .filter((b) => (barberId ? !b.barber_id || b.barber_id === barberId : true));
    return availableSlots({
      day: dayDate,
      durationMin: totalDuration,
      stepMin: 15,
      hours: availability.hours.find((h) => h.weekday === dayDate.getDay()),
      barber: barber
        ? {
            work_days: barber.work_days,
            start_time: barber.start_time,
            end_time: barber.end_time,
          }
        : undefined,
      breaks: availability.breaks,
      busy,
      barberId,
    });
  }, [availability, dayDate, totalDuration, barber, barberId, appointment?.id]);

  /* ---------- benefícios do plano ---------- */

  const benefitService = selectedServices.find((s) => {
    const kind = (s.benefit_kind ?? null) as BenefitKind | null;
    if (!kind) return false;
    return creditsTotal(lookup?.balance ?? null, kind) > 0;
  });
  const benefitKind = (benefitService?.benefit_kind ?? null) as BenefitKind | null;
  const subscription = lookup?.subscription ?? null;
  const planActive = canUseBenefits(subscription ?? null, lookup?.balance ?? null);
  const left = benefitKind ? creditsLeft(lookup?.balance ?? null, benefitKind) : 0;
  const canConsume = planActive && !!benefitKind && left > 0 && useBenefit;
  const finalPrice = canConsume ? Math.max(0, totalPrice - (benefitService?.price_cents ?? 0)) : totalPrice;

  /* ---------- navegação ---------- */

  function canAdvance() {
    if (step === 0) return !!(displayName && displayName.trim().length >= 2);
    if (step === 1) return selectedServices.length > 0;
    if (step === 2) return true;
    if (step === 3) return !!day && !!time;
    return true;
  }

  function next() {
    if (!canAdvance()) {
      toast.error(
        step === 0 ? "Informe ou selecione o cliente." : "Selecione pelo menos um serviço.",
      );
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    if (!selectedServices.length) {
      toast.error("Selecione pelo menos um serviço.");
      return;
    }
    const starts = new Date(`${day}T${time}:00`);
    const primary = selectedServices[0]!;
    const payload = {
      barbershop_id: shopId,
      barber_id: barberId || null,
      service_id: primary.id,
      customer_id: manual ? null : (chosenCustomer?.id ?? null),
      customer_name: (displayName ?? "").trim(),
      customer_phone: (displayPhone ?? "").trim() || null,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + Math.max(totalDuration, 15) * 60000).toISOString(),
      price_cents: finalPrice,
      subscription_id: canConsume ? subscription!.id : null,
      benefit_kind: canConsume ? benefitKind : null,
      use_benefit: canConsume,
    };

    setSaving(true);
    try {
      let appointmentId = appointment?.id;
      if (appointment) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", appointment.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("appointments")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        appointmentId = data?.id as string;
      }
      if (appointmentId) {
        await saveAppointmentServices(
          appointmentId,
          shopId,
          selectedServices.map((s) => ({
            service_id: s.id,
            name: s.name,
            price_cents: s.price_cents,
            duration_min: s.duration_min,
          })),
        );
      }
      toast.success(appointment ? "Agendamento atualizado" : "Agendamento criado");
      onDone();
    } catch (err: unknown) {
      toast.error(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- render ---------- */

  return (
    <form onSubmit={submit} className="space-y-5">
      <StepBar step={step} />

      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar cliente por nome ou telefone</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Ex.: João ou 11 99999-0000"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {filteredCustomers.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                Nenhum cliente encontrado. Use “Cliente novo” abaixo.
              </p>
            )}
            {filteredCustomers.map((c) => {
              const active = !manual && customerId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setManual(false);
                    setCustomerId(c.id);
                    setName(c.name);
                    setPhone(c.phone ?? "");
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40 hover:bg-secondary/40"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.phone || "sem telefone"}
                    </span>
                  </span>
                  {active && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={manual ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setManual(true);
                setCustomerId("");
              }}
            >
              <UserPlus className="size-4" /> Cliente novo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCpf((v) => !v)}
            >
              <IdCard className="size-4" /> {showCpf ? "Ocultar CPF" : "Buscar por CPF (opcional)"}
            </Button>
          </div>

          {manual && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          )}

          {showCpf && (
            <div className="rounded-xl border border-border p-3">
              <CpfCustomerLookup
                shopId={shopId}
                onResult={(r) => {
                  setLookup(r);
                  if (r?.customer) {
                    setManual(false);
                    setCustomerId(r.customer.id);
                    setName(r.customer.name);
                    setPhone(r.customer.phone ?? "");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Toque para escolher um ou mais serviços.
          </p>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {services.map((s) => {
              const active = serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setServiceIds((ids) =>
                      ids.includes(s.id) ? ids.filter((i) => i !== s.id) : [...ids, s.id],
                    )
                  }
                  className={`rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{s.name}</span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">{brl(s.price_cents)}</span>
                    <span>· {s.duration_min} min</span>
                  </div>
                </button>
              );
            })}
          </div>
          {services.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              Cadastre um serviço primeiro em “Serviços”.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <Label>Profissional</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {barbers.map((b) => {
              const active = barberId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBarberId(b.id)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40 hover:bg-secondary/40"
                  }`}
                >
                  <span className="truncate font-medium">{b.name}</span>
                  {active && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
          {barbers.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              Nenhum profissional ativo — o agendamento ficará sem barbeiro definido.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3.5" /> Livres para {totalDuration || 0} min
            </p>
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Calculando horários…
              </div>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                Sem horários livres neste dia para esta duração. Você ainda pode definir o horário
                manualmente acima.
              </p>
            ) : (
              <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                {slots.map((iso) => {
                  const d = new Date(iso);
                  const label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  const active = time === label;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setTime(label)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <p className="eyebrow text-muted-foreground">Cliente</p>
            <p className="font-display text-xl tracking-wide">{displayName || "—"}</p>
            <p className="text-xs text-muted-foreground">{displayPhone || "sem telefone"}</p>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-4">
            <p className="eyebrow flex items-center gap-1.5 text-muted-foreground">
              <Scissors className="size-3.5" /> Serviços
            </p>
            {selectedServices.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {s.name} <span className="text-muted-foreground">· {s.duration_min} min</span>
                </span>
                <span className="font-medium">{brl(s.price_cents)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">
                Total · {totalDuration} min ·{" "}
                {barbers.find((b) => b.id === barberId)?.name ?? "sem barbeiro"}
              </span>
              <span className="font-display text-xl text-primary">{brl(finalPrice)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(`${day}T${time}:00`).toLocaleString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {planActive && benefitKind && (
            <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
              {left <= 0 ? (
                <p className="text-destructive">
                  🔴 Sem créditos de {BENEFIT_LABEL[benefitKind].toLowerCase()} neste ciclo —
                  atendimento cobrado normalmente.
                </p>
              ) : (
                <>
                  <p className="text-success">
                    🟢 {benefitService?.name} incluso no plano ({left} disponível(is))
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
                </>
              )}
            </div>
          )}
        </div>
      )}

      {selectedServices.length > 0 && step < 4 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm">
          <span className="truncate text-muted-foreground">
            {selectedServices.map((s) => s.name).join(" + ")} · {totalDuration} min
          </span>
          <span className="font-semibold text-primary">{brl(totalPrice)}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1" onClick={next}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button className="flex-1" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {appointment ? "Salvar alterações" : "Confirmar agendamento"}
          </Button>
        )}
      </div>
    </form>
  );
}
