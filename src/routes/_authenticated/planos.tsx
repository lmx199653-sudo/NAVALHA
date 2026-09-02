import { createFileRoute, redirect } from "@tanstack/react-router";

/** Antiga página de planos — agora vive dentro de Assinaturas › Planos. */
export const Route = createFileRoute("/_authenticated/planos")({
  beforeLoad: () => {
    throw redirect({ to: "/assinaturas", search: { tab: "planos" } });
  },
  component: () => null,
});
