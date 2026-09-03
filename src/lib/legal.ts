/**
 * Informações legais e de suporte do NAVALHA PRO.
 * Centralizadas aqui para que Política de Privacidade, Termos, Suporte,
 * Exclusão de conta e a ficha da Google Play usem sempre os mesmos dados.
 */
export const LEGAL = {
  appName: "NAVALHA PRO",
  developerName: "NAVALHA PRO",
  supportEmail: "pronavalha@gmail.com",
  privacyEmail: "privacidade@navalhapro.com.br",
  websiteUrl: "https://pronavalha.lovable.app",
  /** Data da última revisão dos documentos legais (ISO). */
  lastUpdated: "2026-09-03",
  /** Classificação indicativa declarada na Google Play. */
  contentRating: "Livre (L) — app de gestão empresarial, sem conteúdo sensível",
  /** Idade mínima para criar conta de barbeiro/gestor. */
  minimumAge: 18,
  /** Prazo máximo para concluir a exclusão definitiva dos dados. */
  deletionDeadlineDays: 30,
} as const;

export const LEGAL_LINKS = [
  { to: "/privacidade", label: "Política de Privacidade" },
  { to: "/termos", label: "Termos de Uso" },
  { to: "/seguranca-dados", label: "Segurança dos Dados" },
  { to: "/excluir-conta", label: "Excluir conta" },
  { to: "/suporte", label: "Suporte" },
] as const;

export function formatLegalDate(iso: string = LEGAL.lastUpdated) {
  const [y = 2026, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
