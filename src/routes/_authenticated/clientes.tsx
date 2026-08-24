import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Plus, Search, Star } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, dateLabel, STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  birth_date: string | null;
  notes: string | null;
  points: number;
};

const EMPTY = { name: "", phone: "", email: "", cpf: "", birth_date: "", notes: "" };

function cpfDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function cpfMask(value: string) {
  const d = cpfDigits(value);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function CustomersPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState<Customer | null>(null);

  const { data } = useQuery({
    queryKey: ["customers", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [customers, appts, services] = await Promise.all([
        supabase.from("customers").select("*").eq("barbershop_id", shop!.id).order("name"),
        supabase
          .from("appointments")
          .select("id, customer_id, starts_at, price_cents, status, service_id, barber_id")
          .eq("barbershop_id", shop!.id)
          .order("starts_at", { ascending: false }),
        supabase.from("services").select("id, name").eq("barbershop_id", shop!.id),
      ]);
      return {
        customers: (customers.data ?? []) as Customer[],
        appts: appts.data ?? [],
        services: services.data ?? [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        barbershop_id: shop!.id,
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        cpf: cpfDigits(form.cpf) || null,
        birth_date: form.birth_date || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      setForm(EMPTY);
      toast.success("Cliente cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = data?.customers ?? [];
    const appts = data?.appts ?? [];
    return list
      .filter((c) =>
        `${c.name} ${c.phone ?? ""} ${c.cpf ?? ""}`.toLowerCase().includes(search.toLowerCase()),
      )
      .map((c) => {
        const mine = appts.filter((a) => a.customer_id === c.id);
        const past = mine.filter((a) => new Date(a.starts_at) < new Date() && a.status === "done");
        const next = mine
          .filter((a) => new Date(a.starts_at) >= new Date() && a.status === "scheduled")
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
        const last = past[0];
        const daysSince = last
          ? Math.floor((Date.now() - new Date(last.starts_at).getTime()) / 86400000)
          : null;
        const favorite = Object.entries(
          past.reduce<Record<string, number>>((acc, a) => {
            const key = data?.services.find((s) => s.id === a.service_id)?.name ?? "—";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {}),
        ).sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
          customer: c,
          visits: past.length,
          total: past.reduce((s, a) => s + a.price_cents, 0),
          last,
          next,
          daysSince,
          favorite,
          history: mine,
        };
      });
  }, [data, search]);

  const detailRow = rows.find((r) => r.customer.id === detail?.id);

  return (
    <AppShell
      title="Clientes"
      subtitle={`${rows.length} clientes na base`}
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo cliente
        </Button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, telefone ou CPF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <button
            key={r.customer.id}
            onClick={() => setDetail(r.customer)}
            className="surface-card p-4 text-left transition-colors hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-2xl leading-none">{r.customer.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{r.customer.phone}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Star className="size-3 text-primary" /> {r.customer.points}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <p className="text-muted-foreground">
                Visitas: <span className="text-foreground">{r.visits}</span>
              </p>
              <p className="text-muted-foreground">
                Gasto: <span className="text-primary">{brl(r.total)}</span>
              </p>
            </div>
            {r.daysSince !== null && r.daysSince > 30 && (
              <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                Cliente há {r.daysSince} dias sem voltar.
              </p>
            )}
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: cpfMask(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nascimento</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" disabled={save.isPending}>
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="WhatsApp" value={detailRow.customer.phone ?? "—"} />
                <Field label="CPF" value={detailRow.customer.cpf ? cpfMask(detailRow.customer.cpf) : "—"} />
                <Field label="E-mail" value={detailRow.customer.email ?? "—"} />
                <Field
                  label="Último atendimento"
                  value={detailRow.last ? dateLabel(detailRow.last.starts_at) : "—"}
                />
                <Field
                  label="Próximo atendimento"
                  value={detailRow.next ? dateLabel(detailRow.next.starts_at) : "—"}
                />
                <Field label="Total gasto" value={brl(detailRow.total)} />
                <Field label="Visitas" value={String(detailRow.visits)} />
                <Field label="Serviço favorito" value={detailRow.favorite ?? "—"} />
                <Field label="Pontos" value={String(detailRow.customer.points)} />
              </div>

              {detailRow.customer.phone && (
                <Button asChild className="w-full">
                  <a
                    href={`https://wa.me/55${detailRow.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Olá ${detailRow.customer.name}! Que tal agendar seu próximo corte?`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-4" /> Enviar lembrete
                  </a>
                </Button>
              )}

              <div>
                <h4 className="font-display text-xl">Histórico</h4>
                <div className="mt-2 space-y-2">
                  {detailRow.history.slice(0, 12).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs"
                    >
                      <span>{dateLabel(a.starts_at)}</span>
                      <span className="text-muted-foreground">
                        {data?.services.find((s) => s.id === a.service_id)?.name}
                      </span>
                      <span className="text-primary">{brl(a.price_cents)}</span>
                      <span className="text-muted-foreground">{STATUS_LABEL[a.status]}</span>
                    </div>
                  ))}
                  {detailRow.history.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum atendimento ainda.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
