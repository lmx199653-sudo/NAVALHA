import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import {
  CalendarCheck,
  CalendarX2,
  Coins,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dev-preview")({
  ssr: false,
  component: DevPreview,
});

function DevPreview() {
  const upcoming = [
    { name: "Carlos Silva", service: "Corte + Barba", barber: "Rafael", time: "14:30" },
    { name: "João Pedro", service: "Corte máquina", barber: "Diego", time: "15:00" },
    { name: "Marcos Vinícius", service: "Navalhado", barber: "Rafael", time: "15:45" },
  ];
  const insights = [
    "Você tem 8 agendamentos hoje e R$ 420,00 previstos.",
    "Seu serviço mais vendido é Corte + Barba.",
    "Rafael gerou R$ 1.280,00 este mês.",
    "Nenhuma falta registrada este mês. Excelente!",
  ];
  const ranking = [
    ["Rafael", "R$ 1.280,00"],
    ["Diego", "R$ 940,00"],
    ["André", "R$ 610,00"],
  ] as const;

  return (
    <AppShell title="Dashboard" subtitle="Navalha Pro · /barbearia/navalha-pro">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agendamentos hoje" value={8} icon={CalendarCheck} tone="gold" />
        <StatCard label="Faturamento do dia" value="R$ 420,00" icon={Coins} />
        <StatCard label="Faturamento do mês" value="R$ 2.830,00" icon={TrendingUp} tone="success" />
        <StatCard label="Ticket médio" value="R$ 58,00" icon={Coins} />
        <StatCard label="Clientes novos" value={12} icon={UserPlus} />
        <StatCard label="Base de clientes" value={184} icon={Users} />
        <StatCard label="Taxa de ocupação" value="67%" hint="hoje" icon={TrendingUp} />
        <StatCard label="Cancelamentos / faltas" value="1 / 0" icon={CalendarX2} tone="danger" />
      </div>

      <div className="mt-4 surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Próximo cliente</p>
          <p className="mt-1 truncate font-display text-3xl leading-none">Carlos Silva</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">Corte + Barba · Rafael</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl leading-none text-primary">14:30</p>
          <p className="mt-1 text-xs text-muted-foreground">Hoje</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-4 lg:col-span-2">
          <h2 className="font-display text-2xl">Faturamento (14 dias)</h2>
          <div className="mt-4 flex h-64 items-center justify-center rounded-lg bg-secondary/40 text-sm text-muted-foreground">
            Gráfico de faturamento
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-display text-2xl">Assistente IA</h2>
          </div>
          <ul className="mt-3 space-y-3">
            {insights.map((t) => (
              <li key={t} className="rounded-lg bg-secondary/60 p-3 text-sm text-foreground/90">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <h2 className="font-display text-2xl">Próximos agendamentos</h2>
          <div className="mt-3 space-y-2">
            {upcoming.map((a) => (
              <div
                key={a.name}
                className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.service} · {a.barber}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-primary">{a.time}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="surface-card p-4">
          <h2 className="font-display text-2xl">Ranking de barbeiros (mês)</h2>
          <div className="mt-3 space-y-2">
            {ranking.map(([name, value], i) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={i === 0 ? "default" : "secondary"}>{i + 1}º</Badge>
                  <span className="text-sm">{name}</span>
                </div>
                <span className="text-sm text-primary">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
