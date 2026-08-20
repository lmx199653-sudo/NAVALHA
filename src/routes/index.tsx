import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useShop";

import {
  BarChart3,
  CalendarCheck,
  Check,
  Clock,
  MessageCircle,
  Scissors,
  Smartphone,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import heroImg from "@/assets/hero-barbearia.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => {
    const title = "NAVALHA PRO — Agendamento online para barbearias";
    const description =
      "Agenda inteligente, página de agendamento própria, controle financeiro e recuperação de clientes por WhatsApp. Feito só para barbearias.";
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
  component: Landing,
});

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Agenda que não deixa buraco",
    desc: "Visualização por dia, semana e mês, arrastar e soltar, bloqueios e status em um toque.",
  },
  {
    icon: Smartphone,
    title: "Sua página de agendamento",
    desc: "Link próprio para o cliente marcar sozinho em 40 segundos, 24h por dia, direto do Instagram.",
  },
  {
    icon: Users,
    title: "CRM de barbearia",
    desc: "Histórico, serviço favorito, ticket e quem sumiu há mais de 30 dias — pronto para chamar.",
  },
  {
    icon: BarChart3,
    title: "Financeiro sem planilha",
    desc: "Faturamento por dia, ticket médio, receita por serviço e comissão de cada barbeiro.",
  },
  {
    icon: MessageCircle,
    title: "Recuperação por WhatsApp",
    desc: "Campanhas prontas para inativos, aniversariantes e VIPs com a mensagem já escrita.",
  },
  {
    icon: Sparkles,
    title: "Insights automáticos",
    desc: "O sistema aponta seu horário mais fraco, seu serviço mais lucrativo e onde está o dinheiro parado.",
  },
];

const STEPS = [
  { n: "01", t: "Crie sua conta", d: "Menos de 2 minutos, sem cartão." },
  { n: "02", t: "Cadastre serviços e equipe", d: "Ou use os dados de exemplo para testar tudo na hora." },
  { n: "03", t: "Compartilhe seu link", d: "Cole na bio e a agenda começa a encher sozinha." },
];

function Landing() {
  const navigate = useNavigate();
  const { userId, ready } = useSession();
  const signedIn = ready && !!userId;

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 font-display text-3xl tracking-wide">
          <Scissors className="size-5 text-primary" /> NAVALHA PRO
        </span>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button size="sm" asChild>
              <Link to="/dashboard">Meu painel</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth">Começar grátis</Link>
              </Button>
            </>
          )}
        </div>
      </header>


      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Star className="size-3" /> Feito exclusivamente para barbearias
          </span>
          <h1 className="mt-5 font-display text-6xl leading-[0.95] sm:text-7xl">
            Sua cadeira vazia
            <br />
            <span className="text-primary">custa caro.</span>
          </h1>
          <p className="mt-5 max-w-lg text-muted-foreground">
            O NAVALHA PRO organiza sua agenda, deixa o cliente marcar sozinho pelo celular e mostra
            exatamente quanto cada barbeiro faturou no mês. Sem planilha, sem WhatsApp bagunçado.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">Criar minha barbearia</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#recursos">Ver recursos</a>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="size-3 text-primary" /> Grátis para começar
            </span>
            <span className="flex items-center gap-1">
              <Check className="size-3 text-primary" /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-primary" /> Pronto em 2 minutos
            </span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-primary/10 blur-3xl" />
          <img
            src={heroImg}
            alt="Barbeiro fazendo um degradê em cliente numa barbearia escura com detalhes dourados"
            width={1600}
            height={1104}
            className="relative rounded-2xl border border-border object-cover"
          />
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-5xl">Tudo que a barbearia precisa</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Nada de sistema genérico de salão. Cada tela foi desenhada para a rotina de quem trabalha
          com cadeira, tesoura e horário cheio.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card p-5">
              <span className="inline-flex rounded-lg bg-primary/15 p-2 text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-3 font-display text-2xl leading-none">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-5xl">Como funciona</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="surface-card p-6">
              <span className="font-display text-5xl text-primary/40">{s.n}</span>
              <h3 className="mt-2 font-display text-2xl leading-none">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="surface-card p-10">
          <h2 className="font-display text-5xl">Comece hoje e encha a agenda</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Crie sua conta, gere dados de exemplo e veja o painel completo funcionando antes de
            cadastrar o primeiro cliente de verdade.
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link to="/auth">Criar conta grátis</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <span className="flex items-center justify-center gap-2 font-display text-2xl text-foreground">
          <Scissors className="size-4 text-primary" /> NAVALHA PRO
        </span>
        <p className="mt-2">Sistema de agendamento para barbearias.</p>
      </footer>
    </div>
  );
}
