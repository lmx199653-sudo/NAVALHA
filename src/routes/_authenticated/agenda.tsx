import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Pencil,
  Plus,
  UserX,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, STATUS_LABEL, timeLabel, toDayKey, WEEKDAYS } from "@/lib/format";
import { breaksForDay, type BreakRow } from "@/lib/slots";
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
import { CpfCustomerLookup } from "@/components/CpfCustomerLookup";
import {
  BENEFIT_LABEL,
  canUseBenefits,
  completeAppointment,
  creditsLeft,
  friendlyError,
  refundAppointmentBenefit,
  type BenefitKind,
  type CpfLookup,
} from "@/lib/subscriptions";



export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type View = "day" | "week" | "month";

const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);

const statusTone: Record<string, string> = {
  scheduled: "bg-primary/15 border-primary/40 text-primary",
  confirmed: "bg-primary/20 border-primary/50 text-primary",
  done: "bg-success/15 border-success/40 text-success",
  canceled: "bg-muted border-border text-muted-foreground line-through",
  no_show: "bg-destructive/15 border-destructive/40 text-destructive",
  blocked: "bg-secondary border-border text-muted-foreground",
};

function reminderText(shopName: string, name: string, iso: string) {
  return `Olá ${name}! Seu horário na ${shopName} é às ${timeLabel(iso)} — já pode vir vindo, te esperamos em 10 minutos. 💈`;
}

function waLink(phone: string | null | undefined, text: string) {
  return `https://wa.me/55${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

function AgendaPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<string | null>(null);
  const notified = useRef<Set<string>>(new Set());

  const range = useMemo(() => {
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (view === "day") end.setDate(end.getDate() + 1);
    if (view === "week") {
      start.setDate(start.getDate() - start.getDay());
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    }
    if (view === "month") {
      start.setDate(1);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
    }
    return { start, end };
  }, [anchor, view]);

  const { data } = useQuery({
    queryKey: ["agenda", shop?.id, range.start.toISOString(), range.end.toISOString()],
    enabled: !!shop?.id,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const [appts, barbers, services, customers] = await Promise.all([
        supabase
          .from("appointments")
          .select("*")
          .eq("barbershop_id", shop!.id)
          .gte("starts_at", range.start.toISOString())
          .lt("starts_at", range.end.toISOString())
          .order("starts_at"),
        supabase.from("barbers").select("*").eq("barbershop_id", shop!.id).eq("active", true),
        supabase.from("services").select("*").eq("barbershop_id", shop!.id).eq("active", true),
        supabase.from("customers").select("id, name, phone").eq("barbershop_id", shop!.id).order("name"),
      ]);
      return {
        appts: appts.data ?? [],
        barbers: barbers.data ?? [],
        services: services.data ?? [],
        customers: customers.data ?? [],
      };
    },
  });

  const appts = data?.appts ?? [];

  // Novo agendamento feito pelo link do cliente: aparece na hora e avisa dentro do app.
  useEffect(() => {
    if (!shop?.id) return;
    const channel = supabase
      .channel(`agenda-${shop.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter: `barbershop_id=eq.${shop.id}` },
        (payload) => {
          const row = payload.new as { customer_name?: string; starts_at?: string; source?: string };
          qc.invalidateQueries({ queryKey: ["agenda"] });
          if (row?.source === "online") {
            const when = row.starts_at
              ? new Date(row.starts_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            toast.success("Novo agendamento", {
              description: `${row.customer_name ?? "Cliente"}${when ? ` • ${when}` : ""}`,
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [shop?.id, qc]);


  const { data: breaks } = useQuery({
    queryKey: ["breaks", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("schedule_breaks")
        .select("*")
        .eq("barbershop_id", shop!.id);
      return (rows ?? []) as BreakRow[];
    },
  });

  const dayBreaks = useMemo(
    () => breaksForDay(breaks ?? [], anchor),
    [breaks, anchor],
  );


  // Lembrete automático: avisa 10 minutos antes para o cliente já ir indo.
  useEffect(() => {
    if (!appts.length) return;
    const tick = () => {
      const now = Date.now();
      appts.forEach((a) => {
        if (!["scheduled", "confirmed"].includes(a.status)) return;
        const diff = new Date(a.starts_at).getTime() - now;
        if (diff > 10 * 60000 || diff < 0) return;
        if (notified.current.has(a.id)) return;
        notified.current.add(a.id);
        toast(`${a.customer_name} tem horário às ${timeLabel(a.starts_at)}`, {
          description: "Faltam 10 minutos — avise o cliente para ir indo.",
          duration: 15000,
          action: a.customer_phone
            ? {
                label: "Avisar",
                onClick: () =>
                  window.open(
                    waLink(
                      a.customer_phone,
                      reminderText(shop?.name ?? "barbearia", a.customer_name, a.starts_at),
                    ),
                    "_blank",
                  ),
              }
            : undefined,
        });
      });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [appts, shop?.name]);


  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Agendamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, starts_at }: { id: string; starts_at: Date }) => {
      const appt = appts.find((a) => a.id === id);
      if (!appt) return;
      const duration = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
      const { error } = await supabase
        .from("appointments")
        .update({
          starts_at: starts_at.toISOString(),
          ends_at: new Date(starts_at.getTime() + duration).toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Agendamento reagendado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setEditing(null);
      toast.success("Agendamento removido");
    },
  });

  function shift(dir: number) {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + dir);
    if (view === "week") next.setDate(next.getDate() + dir * 7);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  const headerLabel =
    view === "month"
      ? anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : view === "week"
        ? `Semana de ${range.start.toLocaleDateString("pt-BR")}`
        : anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const selected = appts.find((a) => a.id === editing);

  return (
    <AppShell
      title="Agenda"
      subtitle={headerLabel}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo agendamento</DialogTitle>
            </DialogHeader>
            <AppointmentForm
              shopId={shop?.id}
              barbers={data?.barbers ?? []}
              services={data?.services ?? []}
              customers={data?.customers ?? []}
              defaultDate={anchor}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["agenda"] });
              }}
            />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {view === "day" && (
        <div className="surface-card divide-y divide-border">
          {HOURS.map((hour) => {
            const slotAppts = appts.filter((a) => new Date(a.starts_at).getHours() === hour);
            return (
              <div
                key={hour}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  const target = new Date(anchor);
                  target.setHours(hour, 0, 0, 0);
                  if (id) reschedule.mutate({ id, starts_at: target });
                }}
                className="flex min-h-16 gap-3 p-3"
              >
                <span className="w-12 shrink-0 pt-1 text-xs text-muted-foreground">
                  {String(hour).padStart(2, "0")}:00
                </span>
                <div className="flex flex-1 flex-wrap gap-2">
                  {dayBreaks
                    .filter(
                      (b) =>
                        Number(b.start_time.slice(0, 2)) <= hour &&
                        Number(b.end_time.slice(0, 2)) > hour,
                    )
                    .map((b) => (
                      <span
                        key={b.id}
                        className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground"
                      >
                        ☕ {b.name} · {b.start_time.slice(0, 5)}—{b.end_time.slice(0, 5)}
                      </span>
                    ))}

                  {slotAppts.map((a) => (
                    <button
                      key={a.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                      onClick={() => setEditing(a.id)}
                      className={`min-w-40 flex-1 rounded-lg border px-3 py-2 text-left ${statusTone[a.status]}`}
                    >
                      <p className="text-sm font-medium">{a.customer_name}</p>
                      <p className="text-xs opacity-80">
                        {timeLabel(a.starts_at)} · {brl(a.price_cents)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(range.start);
            day.setDate(day.getDate() + i);
            const list = appts.filter(
              (a) => new Date(a.starts_at).toDateString() === day.toDateString(),
            );
            return (
              <div key={i} className="surface-card p-3">
                <p className="font-display text-xl">
                  {WEEKDAYS[day.getDay()]}{" "}
                  <span className="text-sm text-muted-foreground">{day.getDate()}</span>
                </p>
                <div className="mt-2 space-y-2">
                  {list.length === 0 && <p className="text-xs text-muted-foreground">Livre</p>}
                  {list.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setEditing(a.id)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs ${statusTone[a.status]}`}
                    >
                      {timeLabel(a.starts_at)} · {a.customer_name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-[10px] uppercase text-muted-foreground">
              {w.slice(0, 3)}
            </div>
          ))}
          {Array.from({ length: range.start.getDay() }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from(
            { length: new Date(range.end.getTime() - 1).getDate() },
            (_, i) => {
              const day = new Date(range.start);
              day.setDate(i + 1);
              const list = appts.filter(
                (a) => new Date(a.starts_at).toDateString() === day.toDateString(),
              );
              return (
                <button
                  key={i}
                  onClick={() => {
                    setAnchor(day);
                    setView("day");
                  }}
                  className="surface-card min-h-20 p-2 text-left"
                >
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  {list.length > 0 && (
                    <p className="mt-1 text-xs text-primary">{list.length} agend.</p>
                  )}
                </button>
              );
            },
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Horário" value={timeLabel(selected.starts_at)} />
                <Info label="Valor" value={brl(selected.price_cents)} />
                <Info
                  label="Barbeiro"
                  value={data?.barbers.find((b) => b.id === selected.barber_id)?.name ?? "—"}
                />
                <Info
                  label="Serviço"
                  value={data?.services.find((s) => s.id === selected.service_id)?.name ?? "—"}
                />
                <Info label="Telefone" value={selected.customer_phone ?? "—"} />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className="mt-1">{STATUS_LABEL[selected.status]}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditForm(selected.id);
                    setEditing(null);
                  }}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selected.customer_phone}
                  onClick={() =>
                    window.open(
                      waLink(
                        selected.customer_phone,
                        reminderText(shop?.name ?? "barbearia", selected.customer_name, selected.starts_at),
                      ),
                      "_blank",
                    )
                  }
                >
                  <MessageCircle className="size-4" /> Avisar cliente
                </Button>
                <Button size="sm" onClick={() => setStatus.mutate({ id: selected.id, status: "done" })}>
                  <Check className="size-4" /> Concluir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ id: selected.id, status: "no_show" })}
                >
                  <UserX className="size-4" /> Faltou
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ id: selected.id, status: "canceled" })}
                >
                  <X className="size-4" /> Cancelar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove.mutate(selected.id)}>
                  <Ban className="size-4" /> Excluir
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dica: na visão por dia você pode arrastar o agendamento para outro horário.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editForm} onOpenChange={(v) => !v && setEditForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar agendamento</DialogTitle>
          </DialogHeader>
          {editForm && (
            <AppointmentForm
              shopId={shop?.id}
              barbers={data?.barbers ?? []}
              services={data?.services ?? []}
              customers={data?.customers ?? []}
              defaultDate={anchor}
              appointment={appts.find((a) => a.id === editForm) ?? null}
              onDone={() => {
                setEditForm(null);
                qc.invalidateQueries({ queryKey: ["agenda"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function AppointmentForm({
  shopId,
  barbers,
  services,
  customers,
  defaultDate,
  appointment = null,
  onDone,
}: {
  shopId: string | undefined;
  barbers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; price_cents: number; duration_min: number }>;
  customers: Array<{ id: string; name: string; phone: string | null }>;
  defaultDate: Date;
  appointment?: {
    id: string;
    barber_id: string | null;
    service_id: string | null;
    customer_id: string | null;
    customer_name: string;
    customer_phone: string | null;
    starts_at: string;
  } | null;
  onDone: () => void;
}) {
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      toast.error("Cadastre um serviço primeiro.");
      return;
    }
    const chosen = customers.find((c) => c.id === customerId);
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
      price_cents: service.price_cents,
    };
    setSaving(true);
    const { error } = appointment
      ? await supabase.from("appointments").update(payload).eq("id", appointment.id)
      : await supabase.from("appointments").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(appointment ? "Agendamento atualizado" : "Agendamento criado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label>Cliente cadastrado</Label>
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
      <Button className="w-full" disabled={saving}>
        {appointment ? "Salvar alterações" : "Salvar agendamento"}
      </Button>
    </form>
  );
}
