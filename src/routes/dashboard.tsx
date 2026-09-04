import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  CalendarClock,
  ChevronRight,
  Coins,
  Link2,
  Scissors,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useSession, useShop } from "@/hooks/useShop";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";

import { brl, timeLabel, dateLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, SectionHeader } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

const chartTooltip = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-foreground)",
  fontSize: 12,
};

const quickActions = [
  { to: "/agenda", label: "Agenda", icon: CalendarClock },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/link", label: "Link", icon: Link2 },
] as const;

function Dashboard() {
  const navigate = useNavigate();
  const { userId } = useSession();
  const { data: shop, isSuccess, isError: isShopError } = useShop();
  const isMobile = useIsMobile();
  const [chartTab, setChartTab] = useState("faturamento");

  useEffect(() => {
    if (userId && (isSuccess || isShopError) && !shop)
      navigate({ to: "/onboarding", replace: true });
  }, [userId, isSuccess, isShopError, shop, navigate]);

  const {
    data: liveData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
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

  // Faturamento e ticket médio do período escolhido pelo barbeiro.
  const periodStart =
    period === "hoje"
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : period === "7d"
        ? new Date(now - 6 * 86400000)
        : monthStart;
  const periodDone = appts.filter((a) => paid(a) && new Date(a.starts_at) >= periodStart);
  const periodRevenue = periodDone.reduce((s, a) => s + a.price_cents, 0);
  const periodTicket = periodDone.length ? periodRevenue / periodDone.length : 0;

  const canceled = monthAppts.filter((a) => a.status === "canceled").length;
  const noShow = monthAppts.filter((a) => a.status === "no_show").length;
  const occupancy = Math.min(
    100,
    Math.round((todays.length / Math.max(1, (barbers.length || 1) * 12)) * 100),
  );
  const newCustomers = customers.filter(
    (c) => new Date(c.created_at as string) >= monthStart,
  ).length;

  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name ?? "Serviço";
  const barberName = (id: string | null) => barbers.find((b) => b.id === id)?.name ?? "Equipe";

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

  const allDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const list = appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString());
    return {
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      diaCurto: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
      faturamento: list.filter(paid).reduce((s, a) => s + a.price_cents, 0) / 100,
      agendamentos: list.length,
    };
  });
  // No celular exibimos os últimos 7 dias para os rótulos não se sobreporem.
  const days = isMobile ? allDays.slice(-7) : allDays;
  const chartRangeLabel = isMobile ? "7 dias" : "14 dias";

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

  const maxBarberRevenue = barberRevenue[0]?.[1] ?? 0;

  return (
    <AppShell
      title="Dashboard"
      subtitle={shop ? `${shop.name} · /barbearia/${shop.slug}` : "Carregando..."}
    >
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {/* Destaque do dia */}
          <section className="surface-card relative overflow-hidden p-4 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <span className="eyebrow">Hoje</span>
                {isLoading ? (
                  <Skeleton className="mt-3 h-12 w-48" />
                ) : (
                  <p className="mt-2 font-display text-4xl leading-none text-primary sm:text-5xl">
                    {todays.length}
                    <span className="ml-2 align-middle text-base text-muted-foreground sm:text-lg">
                      {todays.length === 1 ? "agendamento" : "agendamentos"}
                    </span>
                  </p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {brl(revToday)} previstos · {occupancy}% de ocupação
                </p>
                {upcoming[0] && (
                  <Link
                    to="/agenda"
                    className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-secondary/70 px-3 py-1.5 text-xs text-foreground/90 ring-1 ring-border/60"
                  >
                    <CalendarCheck className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      Próximo {timeLabel(upcoming[0].starts_at)} · {upcoming[0].customer_name}
                    </span>
                  </Link>
                )}
              </div>

              <div className="lg:w-[22rem]">
                <div className="flex gap-1 rounded-full bg-secondary/60 p-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPeriod(p.key)}
                      className={cn(
                        "flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium transition-colors",
                        period === p.key
                          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="surface-row px-3.5 py-3">
                    <span className="eyebrow text-[10px]">Faturamento</span>
                    <p className="mt-1.5 truncate font-display text-2xl leading-none text-success">
                      {brl(periodRevenue)}
                    </p>
                  </div>
                  <div className="surface-row px-3.5 py-3">
                    <span className="eyebrow text-[10px]">Ticket médio</span>
                    <p className="mt-1.5 truncate font-display text-2xl leading-none">
                      {brl(periodTicket)}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Ações rápidas — alvos grandes no celular */}
            <div className="relative mt-4 grid grid-cols-4 gap-2 sm:gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="surface-row flex min-h-16 flex-col items-center justify-center gap-1.5 px-2 py-3 text-center transition-colors hover:bg-secondary/60"
                >
                  <action.icon className="size-5 text-primary" />
                  <span className="truncate text-[11px] font-medium sm:text-xs">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Indicadores compactos */}
          <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <StatCard
              label="Clientes novos"
              value={newCustomers}
              hint="no mês"
              icon={UserPlus}
              loading={isLoading}
            />
            <StatCard
              label="Base de clientes"
              value={customers.length}
              icon={Users}
              loading={isLoading}
            />
            <StatCard
              label="Atendimentos"
              value={doneMonth}
              hint="concluídos no mês"
              icon={Scissors}
              loading={isLoading}
            />
            <StatCard
              label="Cancelam. / faltas"
              value={`${canceled} / ${noShow}`}
              icon={CalendarX2}
              tone="danger"
              loading={isLoading}
            />
          </section>

          {/* Gráficos — alternados por abas para caber no celular */}
          <section className="surface-card p-3 sm:p-4">
            <Tabs value={chartTab} onValueChange={setChartTab}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="truncate font-display text-lg leading-none">
                  Desempenho · {chartRangeLabel}
                </p>
                <TabsList className="shrink-0">
                  <TabsTrigger value="faturamento" className="text-xs">
                    <Coins className="size-3.5" /> Receita
                  </TabsTrigger>
                  <TabsTrigger value="agendamentos" className="text-xs">
                    <CalendarClock className="size-3.5" /> Agenda
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="faturamento" className="mt-3">
                <div className="h-52 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={days} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey={isMobile ? "diaCurto" : "dia"}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        width={44}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <Tooltip contentStyle={chartTooltip} />
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
              </TabsContent>

              <TabsContent value="agendamentos" className="mt-3">
                <div className="h-52 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={days} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey={isMobile ? "diaCurto" : "dia"}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        width={44}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <Tooltip contentStyle={chartTooltip} />
                      <Bar
                        dataKey="agendamentos"
                        fill="var(--color-accent)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={38}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </section>

          {/* Próximos agendamentos + ranking */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="surface-card p-4">
              <SectionHeader
                title="Próximos agendamentos"
                icon={CalendarCheck}
                action={
                  <Link
                    to="/agenda"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ver agenda <ChevronRight className="size-3.5" />
                  </Link>
                }
              />
              <div className="mt-3 space-y-2">
                {upcoming.length === 0 ? (
                  <EmptyState
                    icon={CalendarCheck}
                    title="Nenhum agendamento futuro"
                    description="Assim que um cliente agendar, ele aparece aqui."
                    compact
                  />
                ) : (
                  upcoming.map((a) => (
                    <div
                      key={a.id}
                      className="surface-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3"
                    >
                      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                        <span className="font-display text-sm leading-none text-primary">
                          {timeLabel(a.starts_at)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.customer_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {serviceName(a.service_id)} · {barberName(a.barber_id)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm text-primary">{brl(a.price_cents)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {dateLabel(a.starts_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface-card p-4">
              <SectionHeader title="Ranking de barbeiros (mês)" icon={Trophy} />
              <div className="mt-3 space-y-2">
                {barberRevenue.length === 0 ? (
                  <EmptyState
                    icon={Trophy}
                    title="Sem atendimentos"
                    description="Nenhum atendimento concluído no mês ainda."
                    compact
                  />
                ) : (
                  barberRevenue.map(([name, cents], i) => (
                    <div key={name} className="surface-row px-3 py-3">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                        <Badge variant={i === 0 ? "default" : "secondary"} className="shrink-0">
                          {i + 1}º
                        </Badge>
                        <span className="truncate text-sm">{name}</span>
                        <span className="shrink-0 text-sm text-primary">{brl(cents)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/70">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{
                            width: `${maxBarberRevenue ? Math.round((cents / maxBarberRevenue) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Insights */}
          <section className="surface-card p-4">
            <SectionHeader title="Assistente IA" icon={Sparkles} />
            <ul className="mt-3 grid gap-2 lg:grid-cols-2">
              {insights.map((text) => (
                <li key={text} className="surface-row flex items-start gap-2.5 px-3.5 py-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-sm text-foreground/90">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
