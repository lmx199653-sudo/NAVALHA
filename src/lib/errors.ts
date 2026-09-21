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
  if (m.includes("duplicate key value") || m.includes("already exists")) {
    return "Este registro já existe. Verifique os dados e tente novamente.";
  }

  // Sessão e autenticação
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira e tente novamente.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com este e-mail. Faça login.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail para entrar. Veja a mensagem que enviamos.";
  }
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("invalid email") || m.includes("unable to validate email")) {
    return "E-mail inválido. Verifique o endereço digitado.";
  }
  if (m.includes("email rate limit") || m.includes("too many requests") || m.includes("429")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  }
  if (m.includes("unsupported provider")) {
    return "Este modo de entrada ainda não está disponível. Use e-mail e senha.";
  }
  if (
    m.includes("jwt expired") ||
    m.includes("invalid token") ||
    m.includes("session expired") ||
    m.includes("auth session missing") ||
    m.includes("unauthorized") ||
    m.includes("401")
  ) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  // Permissões
  if (
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("not authorized") ||
    m.includes("forbidden") ||
    m.includes("não autorizado")
  ) {
    return "Você não tem permissão para esta operação.";
  }

  // Registro não encontrado
  if (m.includes("no rows") || m.includes("not found") || m.includes("pgrst116")) {
    return "Não encontramos este registro. Atualize a página e tente novamente.";
  }

  // Dados inválidos / violação de constraint
  if (
    m.includes("violates") ||
    m.includes("constraint") ||
    m.includes("check constraint") ||
    m.includes("invalid input syntax") ||
    m.includes("null value") ||
    m.includes("not-null")
  ) {
    return "Não foi possível salvar. Verifique os dados informados e tente novamente.";
  }

  // Conexão / timeout
  if (
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("fetch") ||
    m.includes("load failed") ||
    m.includes("failed to fetch")
  ) {
    return "Problema de conexão. Verifique sua internet e tente novamente.";
  }

  // Servidor
  if (
    m.includes("internal server error") ||
    m.includes("500") ||
    m.includes("service unavailable")
  ) {
    return "O sistema está instável no momento. Tente novamente em instantes.";
  }

  return message || "Não foi possível concluir a operação. Tente novamente.";
}
