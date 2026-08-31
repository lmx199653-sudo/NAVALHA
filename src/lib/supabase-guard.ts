/**
 * Camada de acesso usada nas telas administrativas.
 *
 * Fluxo atual: login normal. Todas as leituras e alterações vão direto para o
 * banco da conta do barbeiro — não existe modo demonstração.
 */
import { supabase as realClient } from "@/integrations/supabase/client";

export const MANAGE_BLOCKED_MESSAGE = "Faça login para realizar alterações.";

/** Com login as alterações são liberadas. */
export function canManage() {
  return true;
}

export function notifyManageBlocked() {
  /* sem bloqueio: mantido apenas por compatibilidade de importações */
}

export const supabase = realClient;
