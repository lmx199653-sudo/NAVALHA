import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Cake, MessageCircle, Sparkles, UserMinus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, ListSkeleton, SectionHeader } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
  points: number;
};

function wa(phone: string | null, text: string) {
  return `https://wa.me/55${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

function MarketingPage() {
  const { data: shop } = useShop();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["marketing", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const [customers, appts] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, phone, birth_date, points")
          .eq("barbershop_id", shop!.id),
        supabase
          .from("appointments")
          .select("customer_id, starts_at, status")
          .eq("barbershop_id", shop!.id),
      ]);
      return { customers: (customers.data ?? []) as Customer[], appts: appts.data ?? [] };
    },
  });

  const groups = useMemo(() => {
    const customers = data?.customers ?? [];
    const appts = data?.appts ?? [];
    const lastVisit = new Map<string, number>();
    appts
      .filter((a) => a.status === "done")
      .forEach((a) => {
        const t = new Date(a.starts_at).getTime();
        if (!lastVisit.has(a.customer_id!) || lastVisit.get(a.customer_id!)! < t) {
          lastVisit.set(a.customer_id!, t);
        }
      });

    const inactive = customers.filter((c) => {
      const last = lastVisit.get(c.id);
      return !last || Date.now() - last > 30 * 86400000;
    });

    const month = new Date().getMonth();
    const birthdays = customers.filter(
      (c) => c.birth_date && new Date(c.birth_date + "T12:00:00").getMonth() === month,
    );

    const vips = [...customers].sort((a, b) => b.points - a.points).slice(0, 8);

    return { inactive, birthdays, vips };
  }, [data]);

  return (
    <AppShell title="Marketing" subtitle="Campanhas prontas para trazer o cliente de volta">
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <CampaignCard
            icon={UserMinus}
            title="Clientes sumidos"
            desc="Mais de 30 dias sem voltar. Um lembrete costuma recuperar 1 em cada 4."
            people={groups.inactive}
            loading={isLoading}
            message={(name) =>
              `Fala ${name}! Faz um tempo que você não passa aqui na ${shop?.name ?? "barbearia"}. Bora marcar seu corte? Tenho horário essa semana.`
            }
          />
          <CampaignCard
            icon={Cake}
            title="Aniversariantes do mês"
            desc="Ofereça um mimo de aniversário e aumente a fidelidade."
            people={groups.birthdays}
            loading={isLoading}
            message={(name) =>
              `Parabéns, ${name}! 🎉 Como presente da ${shop?.name ?? "barbearia"}, seu próximo corte tem desconto especial. Vamos agendar?`
            }
          />
          <CampaignCard
            icon={Sparkles}
            title="VIPs por pontos"
            desc="Seus melhores clientes. Recompense antes que a concorrência faça."
            people={groups.vips}
            loading={isLoading}
            message={(name) =>
              `${name}, você é VIP aqui na ${shop?.name ?? "barbearia"}! Seus pontos já valem uma recompensa. Quer resgatar no próximo corte?`
            }
          />
        </div>
      )}
    </AppShell>
  );
}

function CampaignCard({
  icon: Icon,
  title,
  desc,
  people,
  message,
  loading,
}: {
  icon: typeof Cake;
  title: string;
  desc: string;
  people: Customer[];
  message: (name: string) => string;
  loading?: boolean;
}) {
  return (
    <div className="surface-card p-4">
      <SectionHeader
        title={title}
        icon={Icon}
        action={<Badge variant="secondary">{people.length}</Badge>}
      />
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4 space-y-2">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : people.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente neste grupo"
            description="Volte aqui quando novos clientes entrarem neste grupo."
            compact
          />
        ) : (
          people.slice(0, 10).map((c) => (
            <div
              key={c.id}
              className="surface-row flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <span className="truncate text-sm font-medium">{c.name}</span>
              <Button
                size="sm"
                variant="ghost"
                asChild
                aria-label={`Enviar WhatsApp para ${c.name}`}
              >
                <a
                  href={wa(c.phone, message(c.name.split(" ")[0]!))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
