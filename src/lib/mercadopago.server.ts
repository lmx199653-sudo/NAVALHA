/**
 * Cliente HTTP do Mercado Pago — SOMENTE SERVIDOR.
 *
 * Nenhuma credencial deste arquivo pode chegar ao navegador: ele é importado
 * apenas dentro de handlers de server functions / rotas de API.
 *
 * Secrets necessários (configurados no ambiente do projeto):
 *   MERCADOPAGO_ACCESS_TOKEN  — token da conta da plataforma (marketplace)
 *   MERCADOPAGO_CLIENT_ID     — aplicação Mercado Pago (OAuth dos barbeiros)
 *   MERCADOPAGO_CLIENT_SECRET — aplicação Mercado Pago (OAuth dos barbeiros)
 *   MERCADOPAGO_WEBHOOK_SECRET— assinatura secreta dos webhooks
 */

const MP_API = "https://api.mercadopago.com";

export type MpMoney = number;

export function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Configuração pendente: informe o secret ${name} para usar o Mercado Pago.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function platformAccessToken() {
  return readEnv("MERCADOPAGO_ACCESS_TOKEN");
}

async function mpFetch<T>(
  path: string,
  init: { method?: string; token: string; body?: unknown; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${init.token}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;

  const response = await fetch(`${MP_API}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("[MercadoPago]", path, response.status, text);
    throw new Error("Não foi possível concluir a operação no Mercado Pago.");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/* ---------------- Checkout (pagamentos avulsos) ---------------- */

export type PreferencePayload = {
  title: string;
  amount: MpMoney;
  quantity?: number;
  externalReference: string;
  notificationUrl: string;
  backUrl: string;
  payerEmail?: string;
  metadata?: Record<string, unknown>;
  /** Comissão retida pela plataforma no split (marketplace 1:1). */
  marketplaceFee?: MpMoney;
  /** Token do vendedor (barbeiro) quando o dinheiro deve ir para ele. */
  sellerToken?: string;
};

export type MpPreference = { id: string; init_point: string; sandbox_init_point?: string };

export async function createPreference(payload: PreferencePayload): Promise<MpPreference> {
  const token = payload.sellerToken ?? platformAccessToken();
  return mpFetch<MpPreference>("/checkout/preferences", {
    method: "POST",
    token,
    idempotencyKey: payload.externalReference,
    body: {
      items: [
        {
          title: payload.title,
          quantity: payload.quantity ?? 1,
          unit_price: Number(payload.amount),
          currency_id: "BRL",
        },
      ],
      external_reference: payload.externalReference,
      notification_url: payload.notificationUrl,
      back_urls: { success: payload.backUrl, pending: payload.backUrl, failure: payload.backUrl },
      auto_return: "approved",
      metadata: payload.metadata ?? {},
      ...(payload.marketplaceFee && payload.sellerToken
        ? { marketplace_fee: Number(payload.marketplaceFee) }
        : {}),
    },
  });
}

export type MpPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  external_reference?: string | null;
  payment_method_id?: string | null;
  date_approved?: string | null;
  metadata?: Record<string, unknown>;
};

export async function getPayment(id: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${id}`, { token: platformAccessToken() });
}

/* ---------------- Assinaturas recorrentes ---------------- */

export type MpPreapproval = {
  id: string;
  status: string;
  init_point?: string;
  external_reference?: string | null;
  next_payment_date?: string | null;
  date_created?: string | null;
  auto_recurring?: { transaction_amount?: number; end_date?: string | null };
  payer_id?: number | string;
};

export async function createPreapproval(input: {
  reason: string;
  amount: MpMoney;
  externalReference: string;
  backUrl: string;
  notificationUrl: string;
  payerEmail?: string;
}): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>("/preapproval", {
    method: "POST",
    token: platformAccessToken(),
    idempotencyKey: input.externalReference,
    body: {
      reason: input.reason,
      external_reference: input.externalReference,
      back_url: input.backUrl,
      notification_url: input.notificationUrl,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(input.amount),
        currency_id: "BRL",
      },
      status: "pending",
    },
  });
}

export async function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, { token: platformAccessToken() });
}

export async function cancelPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, {
    method: "PUT",
    token: platformAccessToken(),
    body: { status: "cancelled" },
  });
}

/* ---------------- OAuth (conexão da conta do barbeiro) ---------------- */

export function oauthAuthorizeUrl(input: { state: string; redirectUri: string }) {
  const params = new URLSearchParams({
    client_id: readEnv("MERCADOPAGO_CLIENT_ID"),
    response_type: "code",
    platform_id: "mp",
    state: input.state,
    redirect_uri: input.redirectUri,
  });
  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
}

export type MpOauthToken = {
  access_token: string;
  refresh_token?: string;
  user_id: number | string;
  public_key?: string;
  expires_in?: number;
};

export async function exchangeOauthCode(input: {
  code: string;
  redirectUri: string;
}): Promise<MpOauthToken> {
  return mpFetch<MpOauthToken>("/oauth/token", {
    method: "POST",
    token: platformAccessToken(),
    body: {
      client_id: readEnv("MERCADOPAGO_CLIENT_ID"),
      client_secret: readEnv("MERCADOPAGO_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    },
  });
}

export async function refreshOauthToken(refreshToken: string): Promise<MpOauthToken> {
  return mpFetch<MpOauthToken>("/oauth/token", {
    method: "POST",
    token: platformAccessToken(),
    body: {
      client_id: readEnv("MERCADOPAGO_CLIENT_ID"),
      client_secret: readEnv("MERCADOPAGO_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  });
}

/** Converte o status do Mercado Pago para o enum interno de pagamentos. */
export function mapPaymentStatus(status: string) {
  const allowed = [
    "pending",
    "approved",
    "authorized",
    "in_process",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ] as const;
  const normalized = status === "in_mediation" ? "in_process" : status;
  return (allowed as readonly string[]).includes(normalized)
    ? (normalized as (typeof allowed)[number])
    : "pending";
}

/** Converte o status de assinatura do Mercado Pago para o enum interno. */
export function mapSubscriptionStatus(status: string) {
  switch (status) {
    case "authorized":
      return "active" as const;
    case "paused":
      return "paused" as const;
    case "cancelled":
      return "cancelled" as const;
    case "pending":
      return "pending" as const;
    default:
      return "pending" as const;
  }
}
