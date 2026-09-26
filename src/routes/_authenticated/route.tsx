import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requireLoginInApp } from "@/lib/app-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Área do sistema protegida: exige login no site e no app.
 * Após entrar, quem ainda não tem barbearia é levado obrigatoriamente
 * ao cadastro antes de acessar painel, agenda, clientes etc.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    await requireLoginInApp();
    // A tela de cadastro da barbearia fica dentro da área logada: não redirecionar nela mesma.
    if (location.pathname.startsWith("/onboarding")) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const { data: memberships } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("user_id", userId)
      .limit(1);
    if (!memberships || memberships.length === 0) {
      throw redirect({ to: "/onboarding", replace: true });
    }
  },
  component: () => <Outlet />,
});
