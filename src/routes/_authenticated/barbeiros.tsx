import { friendlyError } from "@@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { brl, WEEKDAYS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/barbeiros")({
  component: BarbersPage,
});

type Barber = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  commission_pct: number;
  work_days: number[];
  start_time: string;
  end_time: string;
  active: boolean;
};

const EMPTY = {
  name: "",
  bio: "",
  photo_url: "",
  commission_pct: "40",
  work_days: [1, 2, 3, 4, 5, 6],
  start_time: "09:00",
  end_time: "20:00",
  active: true,
};

function BarbersPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data } = useQuery({
    queryKey: ["barbers-page", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [barbers, appts] = await Promise.all([
        supabase.from("barbers").select("*").eq("barbershop_id", shop!.id).order("created_at"),
        supabase
          .from("appointments")
          .select("barber_id, price_cents, status")
          .eq("barbershop_id", shop!.id)
          .eq("status", "done"),
      ]);
      return { barbers: (barbers.data ?? []) as Barber[], appts: appts.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        barbershop_id: shop!.id,
        name: form.name,
        bio: form.bio,
        photo_url: form.photo_url || null,
        commission_pct: Number(form.commission_pct) || 0,
        work_days: form.work_days,
        start_time: form.start_time,
        end_time: form.end_time,
        active: form.active,
      };
      const { error } = editing
        ? await supabase.from("barbers").update(payload).eq("id", editing.id)
        : await supabase.from("barbers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["barbers-page"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      toast.success("Barbeiro salvo");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("barbers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["barbers-page"] }),
  });

  const stats = (id: string) => {
    const list = (data?.appts ?? []).filter((a) => a.barber_id === id);
    const total = list.reduce((s, a) => s + a.price_cents, 0);
    return { total, count: list.length };
  };

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      work_days: f.work_days.includes(day)
        ? f.work_days.filter((d) => d !== day)
        : [...f.work_days, day].sort(),
    }));
  }

  return (
    <AppShell
      title="Barbeiros"
      subtitle="Equipe, horários e comissões"
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Novo barbeiro
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.barbers ?? []).map((b) => {
          const s = stats(b.id);
          return (
            <div key={b.id} className="surface-card p-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-12">
                  <AvatarImage src={b.photo_url ?? undefined} alt={b.name} />
                  <AvatarFallback>{b.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-2xl leading-none">{b.name}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{b.bio}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(b);
                      setForm({
                        name: b.name,
                        bio: b.bio ?? "",
                        photo_url: b.photo_url ?? "",
                        commission_pct: String(b.commission_pct),
                        work_days: b.work_days,
                        start_time: b.start_time.slice(0, 5),
                        end_time: b.end_time.slice(0, 5),
                        active: b.active,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(b.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Metric label="Faturou" value={brl(s.total)} />
                <Metric label="Atend." value={String(s.count)} />
                <Metric label="Comissão" value={`${b.commission_pct}%`} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {b.work_days.map((d) => WEEKDAYS[d]?.slice(0, 3)).join(", ")} ·{" "}
                {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
              </p>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar barbeiro" : "Novo barbeiro"}</DialogTitle>
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
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Foto (URL)</Label>
              <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Comissão %</Label>
                <Input type="number" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias de trabalho</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((w, i) => (
                  <button
                    type="button"
                    key={w}
                    onClick={() => toggleDay(i)}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      form.work_days.includes(i)
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {w.slice(0, 3)}
                  </button>
                ))}
              </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm text-primary">{value}</p>
    </div>
  );
}
