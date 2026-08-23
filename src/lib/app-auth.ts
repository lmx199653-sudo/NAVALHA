import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Toda a área do sistema exige login: sem sessão, manda para a tela de
 * entrar/criar conta. Depois de autenticado, o acesso é total (site ou app).
 * A página pública de agendamento do cliente (/barbearia/$slug) continua
 * aberta, sem login.
 */
export async function requireLoginInApp() {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/auth", replace: true });
}
