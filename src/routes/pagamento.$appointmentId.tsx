import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppointmentPaymentStatus } from "@/lib/payments.functions";

export const Route = createFileRoute("/pagamento/$appointmentId")({
  head: () => {
    const title = "Situação do pagamento — NAVALHA PRO";
    const description =
      "Acompanhe a confirmação do pagamento do seu agendamento na barbearia.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: PaymentReturnPage,
});

function formatWhen(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PaymentReturnPage() {
  const { appointmentId } = useParams({ from: "/pagamento/$appointmentId" });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["payment-status", appointmentId],
    queryFn: () => getAppointmentPaymentStatus({ data: { appointmentId } }),
    // O webhook pode chegar segundos depois do retorno: reconsulta enquanto pendente.
    refetchInterval: (query) =>
      query.state.data?.payment_status === "pending" ? 5000 : false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Verificando o pagamento…
      </div>
    );
  }

  const status = data?.found ? (data.payment_status ?? "none") : "notfound";

  const view = {
    approved: {
      icon: <CheckCircle2 className="h-14 w-14 text-emerald-500" />,
      title: "Pagamento aprovado",
      text: "Seu agendamento está confirmado. Nos vemos na barbearia!",
    },
    pending: {
      icon: <Clock className="h-14 w-14 text-amber-500" />,
      title: "Pagamento pendente",
      text: "Estamos aguardando a confirmação do Mercado Pago. O horário fica reservado até a confirmação.",
    },
    rejected: {
      icon: <XCircle className="h-14 w-14 text-destructive" />,
      title: "Pagamento recusado",
      text: "O pagamento não foi aprovado e o horário foi liberado. Você pode tentar novamente.",
    },
    expired: {
      icon: <XCircle className="h-14 w-14 text-destructive" />,
      title: "Pagamento expirado",
      text: "O prazo do pagamento terminou e o horário foi liberado. Faça um novo agendamento.",
    },
    none: {
      icon: <Clock className="h-14 w-14 text-muted-foreground" />,
      title: "Agendamento sem pagamento online",
      text: "Este agendamento será pago no local.",
    },
    notfound: {
      icon: <XCircle className="h-14 w-14 text-destructive" />,
      title: "Agendamento não encontrado",
      text: "Confira o link recebido pela barbearia.",
    },
  }[status] ?? {
    icon: <Clock className="h-14 w-14 text-muted-foreground" />,
    title: "Situação indefinida",
    text: "Fale com a barbearia para confirmar o pagamento.",
  };

  const whatsapp = data?.shop_whatsapp
    ? `https://wa.me/55${String(data.shop_whatsapp).replace(/\D/g, "")}`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {view.icon}
          <h1 className="font-display text-3xl">{view.title}</h1>
          <p className="text-sm text-muted-foreground">{view.text}</p>

          {data?.found && (
            <div className="w-full rounded-lg border bg-muted/40 p-4 text-left text-sm">
              {data.service_name && (
                <p>
                  <span className="text-muted-foreground">Serviço: </span>
                  {data.service_name}
                </p>
              )}
              {data.starts_at && (
                <p>
                  <span className="text-muted-foreground">Horário: </span>
                  {formatWhen(data.starts_at)}
                </p>
              )}
              {typeof data.price_cents === "number" && (
                <p>
                  <span className="text-muted-foreground">Valor: </span>
                  {(data.price_cents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              )}
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            {status === "pending" && (
              <Button onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={isFetching ? "animate-spin" : ""} />
                Atualizar situação
              </Button>
            )}
            {data?.shop_slug && (
              <Button asChild variant={status === "approved" ? "outline" : "default"}>
                <Link to="/barbearia/$slug" params={{ slug: data.shop_slug }}>
                  {status === "approved" ? "Voltar para a barbearia" : "Escolher outro horário"}
                </Link>
              </Button>
            )}
            {whatsapp && (
              <Button asChild variant="ghost">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  Falar com a barbearia
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
