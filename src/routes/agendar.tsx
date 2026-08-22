import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useShop } from "@/hooks/useShop";
import { isStandalone } from "@/lib/pwa";

export const Route = createFileRoute("/agendar")({
  head: () => {
    const title = "Página do cliente — NAVALHA PRO";
    const description =
      "Página de agendamento do cliente: escolha o serviço, o profissional e o horário.";
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
  component: ClientPageRedirect,
});

/**
 * Atalho do menu "Mais" (somente no site) para a página pública de
 * agendamento da barbearia. No app instalado (PWA) esta página não existe:
 * redireciona para o Dashboard.
 */
function ClientPageRedirect() {
  const { data: shop } = useShop();
  const navigate = useNavigate();

  useEffect(() => {
    if (isStandalone()) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    if (shop?.slug) {
      navigate({ to: "/barbearia/$slug", params: { slug: shop.slug }, replace: true });
    }
  }, [shop, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Abrindo a página do cliente…
    </div>
  );
}
