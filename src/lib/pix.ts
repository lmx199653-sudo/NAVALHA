export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "phone", label: "Celular" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
] as const;

export type PixKeyType = (typeof PIX_KEY_TYPES)[number]["value"];

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  card: "Cartão",
  cash: "Dinheiro",
  on_site: "No local",
  cash_or_on_site: "No local",
  subscription: "Assinatura",
  mercado_pago: "Online",
};

export function pixTypeLabel(type: string | null | undefined) {
  return PIX_KEY_TYPES.find((t) => t.value === type)?.label ?? "Chave Pix";
}

/** Chave Pix pronta para colar no app do banco (sem máscara em CPF/CNPJ/celular). */
export function normalizePixKey(key: string, type: string | null | undefined) {
  const k = key.trim();
  if (type === "cpf" || type === "cnpj") return k.replace(/\D/g, "");
  if (type === "phone") {
    const d = k.replace(/\D/g, "");
    return d.startsWith("55") && d.length > 11 ? `+${d}` : `+55${d}`;
  }
  return k;
}

export function hasPix(shop: { pix_key?: string | null } | null | undefined) {
  return !!shop?.pix_key && shop.pix_key.trim().length > 0;
}
