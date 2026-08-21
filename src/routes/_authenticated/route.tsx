import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Área do sistema aberta para visualização, mesmo sem login.
 * Qualquer alteração é bloqueada fora do app instalado (ver src/lib/supabase-guard.ts).
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => <Outlet />,
});
