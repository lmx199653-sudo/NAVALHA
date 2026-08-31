/**
 * Assinatura do parâmetro `state` do OAuth do Mercado Pago — somente servidor.
 * Impede que um terceiro conecte uma conta a outra barbearia.
 */
function secret() {
  const value =
    process.env["MERCADOPAGO_CLIENT_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("Configuração pendente: MERCADOPAGO_CLIENT_SECRET.");
  return value;
}

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(signature);
}

export async function signState(shopId: string) {
  const payload = `${shopId}.${Date.now()}`;
  return `${b64url(new TextEncoder().encode(payload))}.${await sign(payload)}`;
}

/** Devolve o shopId quando a assinatura é válida e o state não expirou (30 min). */
export async function verifyState(state: string): Promise<string | null> {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const payload = new TextDecoder().decode(
    Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
  );
  if ((await sign(payload)) !== signature) return null;
  const [shopId, issuedAt] = payload.split(".");
  if (!shopId || !issuedAt) return null;
  if (Date.now() - Number(issuedAt) > 30 * 60 * 1000) return null;
  return shopId;
}
