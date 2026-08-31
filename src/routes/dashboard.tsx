import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarCheck,
  CalendarX2,
  Coins,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useSession, useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { brl, timeLabel, dateLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { requireLoginInApp } from "@/lib/app-auth";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => {
    const title = "Dashboard da barbearia — NAVALHA PRO";
    const description =
      "Acompanhe agenda, faturamento, clientes e desempenho da equipe da sua barbearia em um só painel.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  beforeLoad: () => requireLoginInApp(),
  component: Dashboard,
});

type Appt = {
  id: string;
  starts_at: string;
  price_cents: number;
  status: string;
  customer_name: string;
  barber_id: string | null;
  service_id: string | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const { userId } = useSession();
  const { data: shop, isSuccess, isError } = useShop();

  useEffect(() => {
    if (userId && (isSuccess || isError) && !shop) navigate({ to: "/onboarding", replace: true });
  }, [userId, isSuccess, isError, shop, navigate]);

  const { data: liveData } = useQuery({
    queryKey: ["dashboard", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const [appts, customers, barbers, services] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, starts_at, price_cents, status, customer_name, barber_id, service_id")
          .eq("barbershop_id", shop!.id)
          .gte("starts_at", since.toISOString())
          .order("starts_at"),
        supabase.from("customers").select("id, created_at").eq("barbershop_id", shop!.id),
        supabase.from("barbers").select("id, name").eq("barbershop_id", shop!.id),
        supabase.from("services").select("id, name").eq("barbershop_id", shop!.id),
      ]);
      return {
        appts: (appts.data ?? []) as Appt[],
        customers: customers.data ?? [],
        barbers: barbers.data ?? [],
        services: services.data ?? [],
      };
    },
  });

  const data = liveData;

  const appts = (data?.appts ?? []) as Appt[];
  const customers = (data?.customers ?? []) as { id: string; created_at: string }[];
  const barbers = (data?.barbers ?? []) as { id: string; name: string }[];
  const services = (data?.services ?? []) as { id: string; name: string }[];
  const today = new Date().toDateString();

  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const paid = (a: Appt) => a.status === "done";
  const todays = appts.filter((a) => new Date(a.starts_at).toDateString() === today);
  const upcoming = appts
    .filter((a) => new Date(a.starts_at).getTime() >= now && a.status === "scheduled")
    .slice(0, 6);
  const monthAppts = appts.filter((a) => new Date(a.starts_at) >= monthStart);
  const revToday = todays.filter(paid).reduce((s, a) => s + a.price_cents, 0);
  const revMonth = monthAppts.filter(paid).reduce((s, a) => s + a.price_cents, 0);
  const doneMonth = monthAppts.filter(paid).length;
  const ticket = doneMonth ? revMonth / doneMonth : 0;
  const canceled = monthAppts.filter((a) => a.status === "canceled").length;
  const noShow = monthAppts.filter((a) => a.status === "no_show").length;
  const occupancy = Math.min(
    100,
    Math.round((todays.length / Math.max(1, (barbers.length || 1) * 12)) * 100),
  );
  const newCustomers = customers.filter(
    (c) => new Date(c.created_at as string) >= monthStart,
  ).length;

  const serviceName = (id: string | null) =>
    services.find((s) => s.id === id)?.name ?? "Serviço";
  const barberName = (id: string | null) =>
    barbers.find((b) => b.id === id)?.name ?? "Equipe";

  const topService = Object.entries(
    monthAppts.reduce<Record<string, number>>((acc, a) => {
      const key = serviceName(a.service_id);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1])[0];

  const barberRevenue = Object.entries(
    monthAppts.filter(paid).reduce<Record<string, number>>((acc, a) => {
      const key = barberName(a.barber_id);
      acc[key] = (acc[key] ?? 0) + a.price_cents;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const list = appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString());
    return {
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      faturamento: list.filter(paid).reduce((s, a) => s + a.price_cents, 0) / 100,
      agendamentos: list.length,
    };
  });

  const insights = [
    `Você tem ${todays.length} agendamentos hoje e ${brl(revToday)} previstos.`,
    topService ? `Seu serviço mais vendido é ${topService[0]}.` : "Cadastre serviços para começar.",
    barberRevenue[0]
      ? `${barberRevenue[0][0]} gerou ${brl(barberRevenue[0][1])} este mês.`
      : "Cadastre barbeiros para acompanhar o faturamento por profissional.",
    noShow > 0
      ? `Você teve ${noShow} faltas este mês — ative lembretes para reduzir no-show.`
      : "Nenhuma falta registrada este mês. Excelente!",
  ];

  return (
    <AppShell
      title="Dashboard"
      subtitle={
        shop
          ? `${shop.name} · /barbearia/${shop.slug}`
          : "Carregando..."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard label="Agendamentos hoje" value={todays.length} icon={CalendarCheck} tone="gold" />
        <StatCard label="Faturamento do dia" value={brl(revToday)} icon={Coins} />
        <StatCard label="Faturamento do mês" value={brl(revMonth)} icon={TrendingUp} tone="success" />
        <StatCard label="Ticket médio" value={brl(ticket)} icon={Coins} />
        <StatCard label="Clientes novos" value={newCustomers} icon={UserPlus} />
        <StatCard label="Base de clientes" value={customers.length} icon={Users} />
        <StatCard label="Taxa de ocupação" value={`${occupancy}%`} hint="hoje" icon={TrendingUp} />
        <StatCard
          label="Cancelamentos / faltas"
          value={`${canceled} / ${noShow}`}
          icon={CalendarX2}
          tone="danger"
        />
      </div>

      <div className="mt-4 surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Próximo cliente</p>
          {upcoming[0] ? (
            <>
              <p className="mt-1 truncate font-display text-3xl leading-none">
                {upcoming[0].customer_name}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {serviceName(upcoming[0].service_id)} · {barberName(upcoming[0].barber_id)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nenhum cliente na fila.</p>
          )}
        </div>
        {upcoming[0] && (
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl leading-none text-primary">
              {timeLabel(upcoming[0].starts_at)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{dateLabel(upcoming[0].starts_at)}</p>
          </div>
        )}
      </div>


      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-4 lg:col-span-2">
          <h2 className="font-display text-2xl">Faturamento (14 dias)</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="var(--color-primary)"
                  fill="url(#gold)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-display text-2xl">Assistente IA</h2>
          </div>
          <ul className="mt-3 space-y-3">
            {insights.map((text) => (
              <li key={text} className="rounded-lg bg-secondary/60 p-3 text-sm text-foreground/90">
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <h2 className="font-display text-2xl">Agendamentos por dia</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="agendamentos" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-4">
          <h2 className="font-display text-2xl">Próximos agendamentos</h2>
          <div className="mt-3 space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
            )}
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.customer_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {serviceName(a.service_id)} · {barberName(a.barber_id)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-primary">{timeLabel(a.starts_at)}</p>
                  <p className="text-xs text-muted-foreground">{dateLabel(a.starts_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 surface-card p-4">
        <h2 className="font-display text-2xl">Ranking de barbeiros (mês)</h2>
        <div className="mt-3 space-y-2">
          {barberRevenue.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem atendimentos concluídos no mês.</p>
          )}
          {barberRevenue.map(([name, cents], i) => (
            <div key={name} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Badge variant={i === 0 ? "default" : "secondary"}>{i + 1}º</Badge>
                <span className="text-sm">{name}</span>
              </div>
              <span className="text-sm text-primary">{brl(cents)}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
