import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeLabel } from "@/lib/format";
import { breaksForDay, type BreakRow } from "@/lib/slots";
import {
  BENEFIT_LABEL,
  completeAppointment,
  friendlyError,
  refundAppointmentBenefit,
  type LocalPaymentMethod,
} from "@/lib/subscriptions";
import { PAYMENT_METHOD_LABEL } from "@/lib/pix";

import {
  AppointmentDetailDialog,
  AppointmentForm,
  DayView,
  FinishAppointmentDialog,
  MonthView,
  reminderText,
  StatusLegend,
  waLink,
  WeekView,
  type Appointment,
  type BarberSummary,
  type CustomerSummary,
  type ServiceSummary,
  type View,
} from "@/components/agenda";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

function AgendaPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<string | null>(null);
  const [confirmDone, setConfirmDone] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<LocalPaymentMethod>("pix");

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

  const { data, isLoading, isError, refetch } = useQuery({
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
        supabase
          .from("customers")
          .select("id, name, phone")
          .eq("barbershop_id", shop!.id)
          .order("name"),
      ]);
      return {
        appts: (appts.data ?? []) as Appointment[],
        barbers: (barbers.data ?? []) as BarberSummary[],
        services: (services.data ?? []) as ServiceSummary[],
        customers: (customers.data ?? []) as CustomerSummary[],
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
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${shop.id}`,
        },
        (payload) => {
          const row = payload.new as {
            customer_name?: string;
            starts_at?: string;
            source?: string;
          };
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

  const dayBreaks = useMemo(() => breaksForDay(breaks ?? [], anchor), [breaks, anchor]);

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
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  // Conclusão do atendimento: o consumo do crédito acontece no banco (idempotente).
  const finish = useMutation({
    mutationFn: (id: string) => completeAppointment(id, payMethod),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setConfirmDone(null);
      setEditing(null);
      if (result?.consumed) {
        const label = result.benefit_kind
          ? BENEFIT_LABEL[result.benefit_kind].toLowerCase()
          : "benefício";
        toast.success(`Atendimento concluído. 1 ${label} descontado.`, {
          description: `Saldo restante: ${result.left}`,
        });
      } else {
        toast.success("Atendimento concluído.", {
          description: `Pagamento: ${PAYMENT_METHOD_LABEL[result?.payment_method ?? ""] ?? "registrado"}.`,
        });
      }
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const refund = useMutation({
    mutationFn: (id: string) => refundAppointmentBenefit(id, "Correção do atendimento"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success(
        r?.refunded ? "Crédito estornado para o cliente." : "Nenhum crédito a estornar.",
      );
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
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
    onError: (e: Error) => toast.error(friendlyError(e.message)),
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

  const selected = appts.find((a) => a.id === editing) ?? null;
  const appointmentToConfirm = appts.find((a) => a.id === confirmDone) ?? null;

  return (
    <AppShell
      title="Agenda"
      subtitle={headerLabel}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
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
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} className="rounded-full">
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchor(new Date())}
            className="rounded-full"
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} className="rounded-full">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading && <ListSkeleton rows={5} />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && view === "day" && appts.length === 0 && (
        <EmptyState
          compact
          icon={CalendarDays}
          title="Dia livre"
          description="Nenhum agendamento para esta data. Arraste ou clique em Novo para adicionar."
          className="mb-4"
        />
      )}

      {!isLoading && !isError && view === "day" && (
        <DayView
          anchor={anchor}
          appts={appts}
          services={data?.services ?? []}
          dayBreaks={dayBreaks}
          onSelectAppointment={(id) => setEditing(id)}
          onReschedule={(params) => reschedule.mutate(params)}
        />
      )}

      {view === "week" && (
        <WeekView
          startDate={range.start}
          appts={appts}
          services={data?.services ?? []}
          onSelectAppointment={(id) => setEditing(id)}
        />
      )}

      {view === "month" && (
        <MonthView
          range={range}
          appts={appts}
          onSelectDay={(day) => {
            setAnchor(day);
            setView("day");
          }}
        />
      )}

      <StatusLegend />

      <AppointmentDetailDialog
        appointment={selected}
        onClose={() => setEditing(null)}
        shopName={shop?.name}
        barbers={data?.barbers ?? []}
        services={data?.services ?? []}
        onEdit={(id) => {
          setEditForm(id);
          setEditing(null);
        }}
        onConfirmDone={(appt) => {
          setPayMethod(
            appt.payment_method === "card" ||
              appt.payment_method === "cash" ||
              appt.payment_method === "pix_qr"
              ? appt.payment_method
              : "pix",
          );
          setConfirmDone(appt.id);
        }}
        onRefund={(id) => refund.mutate(id)}
        onSetStatus={(params) => setStatus.mutate(params)}
        onDelete={(id) => remove.mutate(id)}
      />

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

      <FinishAppointmentDialog
        appointment={appointmentToConfirm}
        services={data?.services ?? []}
        shop={shop}
        payMethod={payMethod}
        onPayMethodChange={setPayMethod}
        onClose={() => setConfirmDone(null)}
        onConfirm={(id) => finish.mutate(id)}
      />
    </AppShell>
  );
}
