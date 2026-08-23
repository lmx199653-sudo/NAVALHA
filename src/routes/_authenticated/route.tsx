import { createFileRoute, Outlet } from "@tanstack/react-router";

import { requireLoginInApp } from "@/lib/app-auth";

/**
 * Área do sistema protegida: exige login no site e no app.
 * Após entrar, o acesso às funções é total.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => requireLoginInApp(),
  component: () => <Outlet />,
});
