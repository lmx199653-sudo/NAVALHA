import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { isStandalone } from "@/lib/pwa";

/**
 * No app instalado (PWA) o uso é sempre autenticado: sem sessão, manda para
 * a tela de login/cadastro. Pelo navegador o acesso segue liberado (só leitura).
 */
export async function requireLoginInApp() {
  if (typeof window === "undefined") return;
  if (!isStandalone()) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/auth", replace: true });
}
