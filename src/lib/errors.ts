/** Traduz erros técnicos do backend em mensagens claras em português. */
export function friendlyError(message: string | null | undefined) {
  const m = (message ?? "").toLowerCase();

  // Chaves duplicadas
  if (
    m.includes("barbershops_slug_key") ||
    (m.includes("duplicate key value") && m.includes("slug"))
  ) {
    return "Este endereço já está em uso. Escolha outro nome para continuar.";
  }
  if (m.includes("customers_shop_cpf_unique")) return "Este CPF já está cadastrado.";
  if (m.includes("subscription_usages_appt_debit_unique")) {
    return "Este atendimento já teve o benefício descontado.";
  }

  // Permissões
  if (
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("não autorizado")
  ) {
    return "Você não tem permissão para esta operação. Faça login e tente novamente.";
  }

  // Dados inválidos / violação de constraint
  if (
    m.includes("violates") ||
    m.includes("constraint") ||
    m.includes("check constraint") ||
    m.includes("not-null")
  ) {
    return "Não foi possível salvar. Verifique os dados informados e tente novamente.";
  }

  // Conexão / timeout
  if (
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("fetch") ||
    m.includes("failed to fetch")
  ) {
    return "Problema de conexão. Verifique sua internet e tente novamente.";
  }

  return message || "Não foi possível concluir a operação. Tente novamente.";
}
