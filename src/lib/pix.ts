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
  pix_qr: "Pix QR Code",
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

/* ---------- Validação ---------- */

function allSameDigits(d: string) {
  return /^(\d)\1+$/.test(d);
}

export function isValidCpf(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.length !== 11 || allSameDigits(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.length !== 14 || allSameDigits(d)) return false;
  const calc = (len: number) => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]!;
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const EVP_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PixDetection =
  { ok: true; type: PixKeyType; normalized: string } | { ok: false; reason: string };

/**
 * Identifica automaticamente o tipo da chave Pix e valida.
 * Ordem: e-mail → EVP → celular (com +55 ou DDD) → CPF → CNPJ.
 */
export function detectPixKey(raw: string): PixDetection {
  const k = raw.trim();
  if (!k) return { ok: false, reason: "Informe a chave Pix." };

  if (k.includes("@")) {
    if (EMAIL_RE.test(k) && k.length <= 77)
      return { ok: true, type: "email", normalized: k.toLowerCase() };
    return { ok: false, reason: "E-mail inválido." };
  }

  if (EVP_RE.test(k)) return { ok: true, type: "random", normalized: k.toLowerCase() };

  const digits = k.replace(/\D/g, "");
  const looksLikePhone =
    k.startsWith("+") || /[()\s-]/.test(k) || (digits.length === 11 && !isValidCpf(digits));

  if (k.startsWith("+")) {
    const d = digits.startsWith("55") ? digits.slice(2) : digits;
    if (d.length === 10 || d.length === 11)
      return { ok: true, type: "phone", normalized: `+55${d}` };
    return { ok: false, reason: "Celular inválido. Use DDD + número." };
  }

  if (digits.length === 11 && isValidCpf(digits))
    return { ok: true, type: "cpf", normalized: digits };
  if (digits.length === 14 && isValidCnpj(digits))
    return { ok: true, type: "cnpj", normalized: digits };

  if (digits.length === 13 && digits.startsWith("55")) {
    return { ok: true, type: "phone", normalized: `+${digits}` };
  }
  if ((digits.length === 10 || digits.length === 11) && looksLikePhone) {
    return { ok: true, type: "phone", normalized: `+55${digits}` };
  }

  if (/^[0-9a-z-]{32,36}$/i.test(k))
    return {
      ok: false,
      reason: "Chave aleatória inválida. Copie-a exatamente como aparece no seu banco.",
    };
  if (digits.length === 11) return { ok: false, reason: "CPF inválido. Confira os dígitos." };
  if (digits.length === 14) return { ok: false, reason: "CNPJ inválido. Confira os dígitos." };
  return {
    ok: false,
    reason: "Não reconhecemos essa chave. Use CPF, CNPJ, celular, e-mail ou chave aleatória.",
  };
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

/* ---------- QR Code Pix (BR Code / "Pix Copia e Cola") ---------- */

function tlv(id: string, value: string) {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function asciiOnly(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .trim()
    .slice(0, max);
}

/** Gera o payload Pix estático (EMV) que vira QR Code ou "copia e cola". */
export function buildPixPayload(opts: {
  key: string;
  keyType: string | null | undefined;
  holderName?: string | null | undefined;
  amountCents?: number | undefined;
  description?: string | undefined;
  txid?: string | undefined;
}) {
  const key = normalizePixKey(opts.key, opts.keyType);
  const name = asciiOnly(opts.holderName || "NAVALHA PRO", 25) || "NAVALHA PRO";
  const desc = opts.description ? asciiOnly(opts.description, 40) : "";
  const txid = (opts.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";

  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", key) + (desc ? tlv("02", desc) : "");
  let payload =
    tlv("00", "01") +
    tlv("26", mai) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (opts.amountCents && opts.amountCents > 0
      ? tlv("54", (opts.amountCents / 100).toFixed(2))
      : "") +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", "SAO PAULO") +
    tlv("62", tlv("05", txid)) +
    "6304";
  payload += crc16(payload);
  return payload;
}
