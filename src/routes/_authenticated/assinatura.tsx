import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { Check, Crown, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import {
  createCheckoutSubscription,
  createCustomerPortal,
} from "@/lib/subscription.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => {
    const title = "Assinatura | NAVALHA PRO";
    const description = "Gerencie sua assinatura do NAVALHA PRO.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SubscriptionPage,
});

const FEATURES = [
  "Agenda ilimitada",
  "Página de agendamento própria",
  "CRM de clientes",
  "Financeiro completo",
  "Marketing por WhatsApp",
  "Relatórios e insights",
  "Suporte prioritário",
];

function SubscriptionPage() {
  const { data: subscription, isLoading } = useSubscription();
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Assinatura iniciada! Período de teste de 60 dias ativado.");
      qc.invalidateQueries({ queryKey: ["subscription"] });
    }
    if (params.get("canceled") === "1") {
      toast.info("Você cancelou o checkout.");
    }
  }, [qc]);

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await createCheckoutSubscription({ data: undefined });
      return res;
    },
    onSuccess: (res) => {
      if (res.url) window.open(res.url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const res = await createCustomerPortal({ data: undefined });
      return res;
    },
    onSuccess: (res) => {
      if (res.url) window.open(res.url, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Assinatura"
      subtitle="Acesso completo ao NAVALHA PRO com 60 dias grátis"
    >
      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden border-primary/20">
          <div className="bg-primary/10 px-6 py-3 text-center text-sm font-medium text-primary">
            <Sparkles className="inline size-4" /> 60 dias grátis — cancele quando quiser
          </div>
          <CardHeader className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Crown className="size-7" />
            </div>
            <h2 className="mt-4 font-display text-4xl">NAVALHA PRO</h2>
            <p className="text-sm text-muted-foreground">
              Assinatura mensal para barbearias
            </p>
            <div className="mt-4 flex items-baseline justify-center gap-1">
              <span className="font-display text-6xl text-primary">{brl(2990)}</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary" /> {f}
                </li>
              ))}
            </ul>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : subscription?.subscribed ? (
              <div className="space-y-4 rounded-lg bg-muted p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Crown className="size-4" /> Sua assinatura está ativa
                </div>
                <p className="text-sm text-muted-foreground">
                  Status: <span className="capitalize text-foreground">{subscription.status}</span>
                  {subscription.current_period_end && (
                    <>
                      {" "}
                      · Próxima cobrança:{" "}
                      {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                    </>
                  )}
                  {subscription.trial_end && (
                    <>
                      {" "}
                      · Teste gratuito até:{" "}
                      {new Date(subscription.trial_end).toLocaleDateString("pt-BR")}
                    </>
                  )}
                </p>
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                >
                  {portal.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ExternalLink className="size-4" />
                  )}
                  Gerenciar assinatura
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Crown className="size-4" />
                )}
                Assinar com 60 dias grátis
              </Button>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dúvidas?{" "}
          <Link to="/configuracoes" className="text-primary hover:underline">
            Fale conosco
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
