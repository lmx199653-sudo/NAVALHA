import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { CalendarDays, Download, TrendingUp, Users, Wallet } from "lucide-react";
import { ErrorState, SectionHeader } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinancePage,
});

const RANGES = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const COLORS = [
  "oklch(0.78 0.13 85)",
  "oklch(0.68 0.12 75)",
  "oklch(0.58 0.1 70)",
  "oklch(0.45 0.07 80)",
];

function FinancePage() {
  const { data: shop } = useShop();
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["finance", shop?.id, days],
    enabled: !!shop?.id,
    queryFn: async () => {
      const from = new Date(Date.now() - days * 86400000).toISOString();
      const [appts, services, barbers] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, starts_at, price_cents, status, service_id, barber_id")
          .eq("barbershop_id", shop!.id)
          .gte("starts_at", from),
        supabase.from("services").select("id, name").eq("barbershop_id", shop!.id),
        supabase.from("barbers").select("id, name, commission_pct").eq("barbershop_id", shop!.id),
      ]);
      return {
        appts: appts.data ?? [],
        services: services.data ?? [],
        barbers: barbers.data ?? [],
      };
    },
  });

  const view = useMemo(() => {
    const appts = data?.appts ?? [];
    const done = appts.filter((a) => a.status === "done");
    const revenue = done.reduce((s, a) => s + a.price_cents, 0);
    const ticket = done.length ? Math.round(revenue / done.length) : 0;
    const noShow = appts.filter((a) => a.status === "no_show").length;
    const noShowRate = appts.length ? Math.round((noShow / appts.length) * 100) : 0;

    const byDay = new Map<string, number>();
    done.forEach((a) => {
      const key = a.starts_at.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + a.price_cents);
    });
    const daily = [...byDay.entries()].sort().map(([date, cents]) => ({
      date: date.slice(8, 10) + "/" + date.slice(5, 7),
      valor: cents / 100,
    }));

    const byService = (data?.services ?? [])
      .map((s) => ({
        name: s.name,
        value:
          done.filter((a) => a.service_id === s.id).reduce((t, a) => t + a.price_cents, 0) / 100,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    const byBarber = (data?.barbers ?? []).map((b) => {
      const total = done.filter((a) => a.barber_id === b.id).reduce((t, a) => t + a.price_cents, 0);
      return {
        name: b.name,
        total,
        commission: Math.round((total * b.commission_pct) / 100),
        pct: b.commission_pct,
        count: done.filter((a) => a.barber_id === b.id).length,
      };
    });

    return { revenue, ticket, done: done.length, noShowRate, daily, byService, byBarber };
  }, [data]);

  function exportCsv() {
    const rows = [
      ["Data", "Serviço", "Barbeiro", "Status", "Valor"],
      ...(data?.appts ?? []).map((a) => [
        a.starts_at,
        data?.services.find((s) => s.id === a.service_id)?.name ?? "",
        data?.barbers.find((b) => b.id === a.barber_id)?.name ?? "",
        a.status,
        (a.price_cents / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Financeiro"
      subtitle="Faturamento, comissões e desempenho"
      action={
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.days}
            size="sm"
            variant={days === r.days ? "default" : "outline"}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Faturamento"
              value={brl(view.revenue)}
              icon={Wallet}
              loading={isLoading}
            />
            <StatCard
              label="Ticket médio"
              value={brl(view.ticket)}
              icon={TrendingUp}
              loading={isLoading}
            />
            <StatCard
              label="Atendimentos"
              value={String(view.done)}
              icon={CalendarDays}
              loading={isLoading}
            />
            <StatCard
              label="Taxa de falta"
              value={`${view.noShowRate}%`}
              icon={Users}
              loading={isLoading}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="surface-card p-4 lg:col-span-2">
              <SectionHeader title="Faturamento por dia" icon={TrendingUp} />
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={view.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-foreground)",
                      }}
                      formatter={(v: number) => brl(v * 100)}
                    />
                    <Bar dataKey="valor" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface-card p-4">
              <SectionHeader title="Receita por serviço" icon={Wallet} />
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={view.byService}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                    >
                      {view.byService.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-foreground)",
                      }}
                      formatter={(v: number) => brl(v * 100)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="surface-card mt-4 overflow-x-auto p-4">
            <SectionHeader title="Comissões da equipe" icon={Users} />
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Barbeiro</th>
                  <th>Atendimentos</th>
                  <th>Faturamento</th>
                  <th>%</th>
                  <th className="text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {view.byBarber.map((b) => (
                  <tr key={b.name} className="border-t border-border">
                    <td className="py-2">{b.name}</td>
                    <td>{b.count}</td>
                    <td>{brl(b.total)}</td>
                    <td>{b.pct}%</td>
                    <td className="text-right text-primary">{brl(b.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
