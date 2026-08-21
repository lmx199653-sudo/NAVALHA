import { createFileRoute, Outlet } from "@tanstack/react-router";

import { requireLoginInApp } from "@/lib/app-auth";

/**
 * Área do sistema aberta para visualização pelo navegador, mesmo sem login.
 * No app instalado (PWA) é obrigatório entrar ou criar conta.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => requireLoginInApp(),
  component: () => <Outlet />,
});
