import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { MercadoPagoConnect } from "@/components/MercadoPagoConnect";
import { useShop } from "@/hooks/useShop";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  component: PaymentsPage,
  head: () => ({
    meta: [
      { title: "Pagamentos | Navalha Pro" },
      {
        name: "description",
        content:
          "Conecte sua conta Mercado Pago e receba pagamentos online dos clientes da barbearia.",
      },
      { property: "og:title", content: "Pagamentos | Navalha Pro" },
      {
        property: "og:description",
        content: "Conecte o Mercado Pago e ative os pagamentos online da sua barbearia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PaymentsPage() {
  const { data: shop } = useShop();

  return (
    <AppShell
      title="Pagamentos"
      subtitle="Conecte o Mercado Pago para receber pagamentos online"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <MercadoPagoConnect shopId={shop?.id} />

        <div className="surface-card p-4">
          <h3 className="font-display text-2xl">Como funciona</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Conecte sua conta Mercado Pago com um clique.</li>
            <li>• Assim que conectada, a opção “Pagar online” é ativada automaticamente na página de agendamento do cliente.</li>
            <li>• Sem conexão, a opção “Pagar online” fica oculta e o cliente paga no local.</li>
            <li>• O horário só é confirmado após a aprovação do pagamento.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
