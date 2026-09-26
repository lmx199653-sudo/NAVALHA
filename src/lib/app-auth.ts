import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Chave única para ligar/desligar a exigência de login.
 * Ativa: sem sessão, o painel (dashboard, agenda, clientes etc.) manda para a
 * tela de entrar/criar conta. Para liberar acesso temporário, coloque `false`.
 * Nada da autenticação, usuários ou permissões foi removido.
 */
export const LOGIN_REQUIRED = true;

/**
 * Toda a área do sistema exige login: sem sessão, manda para a tela de
 * entrar/criar conta. Depois de autenticado, o acesso é total (site ou app).
 * A página pública de agendamento do cliente (/barbearia/$slug) continua
 * aberta, sem login.
 */
export async function requireLoginInApp() {
  if (!LOGIN_REQUIRED) return;
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/auth", replace: true });
}
