import { friendlyError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coffee, Plus, Trash2, CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WEEKDAYS, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BreakRow } from "@/lib/slots";
import { EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/horarios")({
  component: HoursPage,
});

type Hours = {
  weekday: number;
  open_time: string;
  close_time: string;
  closed: boolean;
};

function HoursPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();

  const { data: hours } = useQuery({
    queryKey: ["hours", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_hours")
        .select("*")
        .eq("barbershop_id", shop!.id)
        .order("weekday");
      const rows = (data ?? []) as Hours[];
      return WEEKDAYS.map(
        (_, i) =>
          rows.find((r) => r.weekday === i) ?? {
            weekday: i,
            open_time: "09:00",
            close_time: "18:00",
            closed: i === 0,
          },
      );
    },
  });

  const [local, setLocal] = useState<Hours[] | null>(null);
  useEffect(() => {
    if (hours) setLocal(hours);
  }, [hours]);

  const saveHours = useMutation({
    mutationFn: async () => {
      const rows = (local ?? []).map((h) => ({
        barbershop_id: shop!.id,
        weekday: h.weekday,
        open_time: h.open_time,
        close_time: h.close_time,
        closed: h.closed,
      }));
      const { error } = await supabase
        .from("business_hours")
        .upsert(rows, { onConflict: "barbershop_id,weekday" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hours"] });
      toast.success("Horários salvos");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const { data: barbers } = useQuery({
    queryKey: ["barbers", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", shop!.id)
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: breaks } = useQuery({
    queryKey: ["breaks", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_breaks")
        .select("*")
        .eq("barbershop_id", shop!.id)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as BreakRow[];
    },
  });

  const removeBreak = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_breaks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["breaks"] });
      toast.success("Pausa removida");
    },
  });

  return (
    <AppShell
      title="Horários"
      subtitle="Expediente, pausas e bloqueios que valem para o agendamento online"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-4 sm:p-5">
          <h2 className="font-display text-2xl">Horário de funcionamento</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os clientes só conseguem agendar dentro deste intervalo.
          </p>
          <div className="mt-4 space-y-2">
            {(local ?? []).map((h, i) => (
              <div
                key={h.weekday}
                className="surface-row flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 truncate text-sm font-medium">{WEEKDAYS[h.weekday]}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {h.closed ? (
                    <span className="text-xs text-muted-foreground">Fechado</span>
                  ) : (
                    <>
                      <Input
                        type="time"
                        className="h-9 w-[104px]"
                        value={h.open_time.slice(0, 5)}
                        onChange={(e) => {
                          const next = [...local!];
                          next[i] = { ...h, open_time: e.target.value };
                          setLocal(next);
                        }}
                      />
                      <Input
                        type="time"
                        className="h-9 w-[104px]"
                        value={h.close_time.slice(0, 5)}
                        onChange={(e) => {
                          const next = [...local!];
                          next[i] = { ...h, close_time: e.target.value };
                          setLocal(next);
                        }}
                      />
                    </>
                  )}
                  <Switch
                    checked={!h.closed}
                    onCheckedChange={(v) => {
                      const next = [...local!];
                      next[i] = { ...h, closed: !v };
                      setLocal(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-4" disabled={saveHours.isPending} onClick={() => saveHours.mutate()}>
            Salvar horários
          </Button>
        </section>

        <section className="surface-card p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-2xl">Pausas e bloqueios</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Almoço, reuniões ou folgas — bloqueiam a agenda automaticamente.
              </p>
            </div>
            <BreakDialog shopId={shop?.id} barbers={barbers ?? []} />
          </div>

          <div className="mt-4 space-y-2">
            {(breaks ?? []).length === 0 && (
              <EmptyState
                icon={CalendarClock}
                compact
                title="Nenhuma pausa cadastrada"
                description="Adicione pausas para bloquear horários de almoço, folgas ou reuniões."
              />
            )}
            {(breaks ?? []).map((b) => (
              <div
                key={b.id}
                className="surface-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    <Coffee className="size-4 shrink-0 text-primary" />
                    {b.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {b.start_time.slice(0, 5)} — {b.end_time.slice(0, 5)} ·{" "}
                    {b.specific_date
                      ? dateLabel(`${b.specific_date}T12:00:00`)
                      : b.weekdays.length
                        ? b.weekdays.map((d) => WEEKDAYS[d]?.slice(0, 3)).join(", ")
                        : "sem dias"}
                    {b.barber_id
                      ? ` · ${barbers?.find((x) => x.id === b.barber_id)?.name ?? "profissional"}`
                      : " · todos"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-destructive"
                  onClick={() => removeBreak.mutate(b.id)}
                  aria-label="Remover pausa"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function BreakDialog({
  shopId,
  barbers,
}: {
  shopId: string | undefined;
  barbers: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Almoço");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [recurring, setRecurring] = useState(true);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [date, setDate] = useState("");
  const [barberId, setBarberId] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (end <= start) throw new Error("O fim precisa ser depois do início");
      if (recurring && weekdays.length === 0) throw new Error("Escolha ao menos um dia");
      if (!recurring && !date) throw new Error("Escolha a data da pausa");
      const { error } = await supabase.from("schedule_breaks").insert({
        barbershop_id: shopId!,
        barber_id: barberId || null,
        name: name.trim() || "Pausa",
        start_time: start,
        end_time: end,
        weekdays: recurring ? weekdays : [],
        specific_date: recurring ? null : date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["breaks"] });
      toast.success("Pausa criada");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Plus className="size-4" /> Pausa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Adicionar pausa</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Almoço" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
            <span className="text-sm">Pausa recorrente</span>
            <Switch checked={recurring} onCheckedChange={setRecurring} />
          </div>

          {recurring ? (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => {
                const on = weekdays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i])
                    }
                    className={cn(
                      "rounded-full border border-border px-3 py-1.5 text-xs transition-colors",
                      on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground",
                    )}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <select
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos os profissionais</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button className="w-full sm:w-auto" disabled={create.isPending}>
              {create.isPending ? "Salvando..." : "Salvar pausa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
