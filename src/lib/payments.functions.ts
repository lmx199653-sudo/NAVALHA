/**
 * Operações financeiras (Mercado Pago) — a regra de negócio vive no servidor.
 *
 * O frontend nunca informa valores: todo montante é recalculado aqui a partir
 * do banco. Tokens e secrets ficam exclusivamente no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function origin() {
  const request = getRequest();
  const fromEnv = process.env["PUBLIC_SITE_URL"];
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const url = request?.url ? new URL(request.url) : null;
  return url ? url.origin : "";
}

function notificationUrl() {
  const configured = process.env["MERCADOPAGO_NOTIFICATION_URL"];
  return (configured || `${origin()}/api/public/mercado-pago/webhook`).replace(/\/$/, "");
}

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

async function assertMember(supabase: unknown, shopId: string) {
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("is_member", { _shop: shopId });
  if (error || data !== true) throw new Error("Sem permissão para esta barbearia.");
}

/* ------------------------------------------------------------------ */
/* leitura                                                             */
/* ------------------------------------------------------------------ */

export type BillingSummary = {
  usage_fee_amount: number;
  pending_balance_warning: number;
  subscription: {
    id: string;
    plan_id: string | null;
    status: string;
    price_amount: number;
    subscription_next_billing_date: string | null;
    subscription_start_date: string | null;
  } | null;
  plan: { id: string; name: string; monthly_price: number } | null;
  completed_appointments: number;
  fees_accrued: number;
  fees_paid: number;
  fees_pending: number;
  last_payment: { id: string; amount: number; paid_at: string | null; type: string } | null;
};

export const getBillingSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: summary, error } = await context.supabase.rpc("barbershop_billing_summary", {
      _shop: data.shopId,
    });
    if (error) throw new Error(error.message);
    return summary as unknown as BillingSummary;
  });

export const getMercadoPagoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: status, error } = await context.supabase.rpc("mercado_pago_status", {
      _shop: data.shopId,
    });
    if (error) throw new Error(error.message);
    return status as unknown as { connected: boolean; mp_user_id?: string | null };
  });

export const listPlatformPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_plans")
    .select("id, name, description, monthly_price, sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

/* ------------------------------------------------------------------ */
/* assinatura da plataforma                                            */
/* ------------------------------------------------------------------ */

export const startPlatformSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string; planId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPreapproval } = await import("@/lib/mercadopago.server");

    const { data: plan, error: planError } = await supabaseAdmin
      .from("platform_plans")
      .select("id, name, monthly_price, active")
      .eq("id", data.planId)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan || !plan.active) throw new Error("Plano indisponível.");

    const amount = money(plan.monthly_price);
    if (amount <= 0) {
      // Plano gratuito: libera sem passar pelo Mercado Pago.
      await supabaseAdmin.from("platform_subscriptions").upsert(
        {
          barbershop_id: data.shopId,
          plan_id: plan.id,
          status: "active",
          price_amount: 0,
          subscription_start_date: new Date().toISOString(),
        },
        { onConflict: "barbershop_id" },
      );
      return { free: true, checkoutUrl: null as string | null };
    }

    const payerEmail = (context.claims as { email?: string } | undefined)?.email;
    const reference = `sub:${data.shopId}:${plan.id}`;
    const preapproval = await createPreapproval({
      reason: `Navalha Pro — ${plan.name}`,
      amount,
      externalReference: reference,
      backUrl: `${origin()}/financeiro`,
      notificationUrl: notificationUrl(),
      ...(payerEmail ? { payerEmail } : {}),
    });

    await supabaseAdmin.from("platform_subscriptions").upsert(
      {
        barbershop_id: data.shopId,
        plan_id: plan.id,
        status: "pending",
        price_amount: amount,
        mercado_pago_subscription_id: preapproval.id,
      },
      { onConflict: "barbershop_id" },
    );

    await supabaseAdmin.from("payments").insert({
      barbershop_id: data.shopId,
      type: "subscription",
      amount,
      status: "pending",
      mercado_pago_subscription_id: preapproval.id,
      metadata: { plan_id: plan.id, plan_name: plan.name },
    });

    await supabaseAdmin.from("audit_logs").insert({
      barbershop_id: data.shopId,
      user_id: context.userId,
      action: "platform_subscription.checkout_created",
      entity: "platform_subscriptions",
      after_data: { plan_id: plan.id, amount, preapproval_id: preapproval.id },
    });

    return { free: false, checkoutUrl: preapproval.init_point ?? null };
  });

export const cancelPlatformSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cancelPreapproval } = await import("@/lib/mercadopago.server");

    const { data: sub } = await supabaseAdmin
      .from("platform_subscriptions")
      .select("id, mercado_pago_subscription_id")
      .eq("barbershop_id", data.shopId)
      .maybeSingle();
    if (!sub) throw new Error("Assinatura não encontrada.");
    if (sub.mercado_pago_subscription_id) {
      await cancelPreapproval(sub.mercado_pago_subscription_id);
    }
    await supabaseAdmin
      .from("platform_subscriptions")
      .update({ status: "cancelled", subscription_end_date: new Date().toISOString() })
      .eq("id", sub.id);
    await supabaseAdmin.from("audit_logs").insert({
      barbershop_id: data.shopId,
      user_id: context.userId,
      action: "platform_subscription.cancelled",
      entity: "platform_subscriptions",
      entity_id: sub.id,
    });
    return { cancelled: true };
  });

/* ------------------------------------------------------------------ */
/* taxas de utilização                                                 */
/* ------------------------------------------------------------------ */

export const payUsageFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPreference } = await import("@/lib/mercadopago.server");

    // O valor é sempre calculado no servidor a partir das taxas em aberto.
    const { data: fees, error: feesError } = await supabaseAdmin
      .from("usage_fees")
      .select("id, amount")
      .eq("barbershop_id", data.shopId)
      .in("status", ["pending", "billed"])
      .is("payment_id", null);
    if (feesError) throw new Error(feesError.message);
    if (!fees || fees.length === 0) throw new Error("Nenhuma taxa pendente.");

    const totalCents = fees.reduce((sum, f) => sum + Math.round(Number(f.amount) * 100), 0);
    const total = totalCents / 100;

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        barbershop_id: data.shopId,
        type: "usage_fee",
        amount: total,
        status: "pending",
        metadata: { fee_count: fees.length },
      })
      .select("id")
      .single();
    if (paymentError) throw new Error(paymentError.message);

    const preference = await createPreference({
      title: `Taxas de atendimento (${fees.length})`,
      amount: total,
      externalReference: `fee:${payment.id}`,
      notificationUrl: notificationUrl(),
      backUrl: `${origin()}/financeiro`,
      metadata: { payment_id: payment.id, barbershop_id: data.shopId, type: "usage_fee" },
    });

    await supabaseAdmin
      .from("payments")
      .update({ mercado_pago_preference_id: preference.id })
      .eq("id", payment.id);

    // Reserva as taxas para esta cobrança (ainda NÃO pagas).
    await supabaseAdmin
      .from("usage_fees")
      .update({ status: "billed", payment_id: payment.id })
      .in(
        "id",
        fees.map((f) => f.id),
      );

    await supabaseAdmin.from("audit_logs").insert({
      barbershop_id: data.shopId,
      user_id: context.userId,
      action: "usage_fees.billed",
      entity: "payments",
      entity_id: payment.id,
      after_data: { total, fee_count: fees.length },
    });

    return { checkoutUrl: preference.init_point, total, count: fees.length };
  });

/* ------------------------------------------------------------------ */
/* conexão Mercado Pago do barbeiro (OAuth)                            */
/* ------------------------------------------------------------------ */

export const getMercadoPagoConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.shopId);
    const { oauthAuthorizeUrl } = await import("@/lib/mercadopago.server");
    const { signState } = await import("@/lib/mercadopago-state.server");
    const redirectUri = `${origin()}/api/public/mercado-pago/oauth-callback`;
    return {
      url: oauthAuthorizeUrl({ state: await signState(data.shopId), redirectUri }),
    };
  });

export const disconnectMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("mercado_pago_accounts")
      .update({ connected: false, access_token: null, refresh_token: null, expires_at: null })
      .eq("barbershop_id", data.shopId);
    await supabaseAdmin.from("audit_logs").insert({
      barbershop_id: data.shopId,
      user_id: context.userId,
      action: "mercado_pago.disconnected",
      entity: "mercado_pago_accounts",
    });
    return { connected: false };
  });

/* ------------------------------------------------------------------ */
/* pagamento online do cliente                                         */
/* ------------------------------------------------------------------ */

/** Minutos de validade do checkout antes de liberar o horário. */
const CHECKOUT_TTL_MIN = 20;

export const createServiceCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; appointmentId: string }) => {
    if (!input?.slug || !input?.appointmentId) throw new Error("Dados incompletos.");
    if (!/^[0-9a-f-]{36}$/i.test(input.appointmentId)) throw new Error("Agendamento inválido.");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPreference } = await import("@/lib/mercadopago.server");

    const { data: shop } = await supabaseAdmin
      .from("barbershops")
      .select("id, name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!shop) throw new Error("Barbearia não encontrada.");

    // Libera horários com pagamento vencido antes de qualquer validação.
    await supabaseAdmin.rpc("expire_pending_payment_appointments", { _shop: shop.id });

    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, barbershop_id, barber_id, customer_id, price_cents, status, payment_state, payment_expires_at, service_id, starts_at, ends_at",
      )
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appointment || appointment.barbershop_id !== shop.id) {
      throw new Error("Agendamento não encontrado.");
    }
    if (appointment.payment_state === "paid") throw new Error("Este agendamento já está pago.");
    if (!["scheduled", "confirmed"].includes(appointment.status)) {
      throw new Error("Agendamento não disponível para pagamento.");
    }
    if (new Date(appointment.starts_at).getTime() < Date.now()) {
      throw new Error("Horário já passou.");
    }

    // Serviço e valor são revalidados no banco — nunca vindos do navegador.
    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, barbershop_id, price_cents, active")
      .eq("id", appointment.service_id ?? "")
      .maybeSingle();
    if (!service || service.barbershop_id !== shop.id || !service.active) {
      throw new Error("Serviço indisponível.");
    }
    if (service.price_cents !== appointment.price_cents) {
      throw new Error("Valor do serviço mudou. Refaça o agendamento.");
    }

    const amount = money(appointment.price_cents / 100);
    if (amount <= 0) throw new Error("Serviço sem valor para pagamento online.");

    // Duplo clique / reabertura: reaproveita o checkout ainda válido.
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id, mercado_pago_preference_id, metadata, status")
      .eq("appointment_id", appointment.id)
      .eq("type", "customer_service")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingUrl = (existing?.metadata as { init_point?: string } | null)?.init_point;
    const stillValid =
      appointment.payment_expires_at != null &&
      new Date(appointment.payment_expires_at).getTime() > Date.now();
    if (existing && existingUrl && stillValid) {
      return { checkoutUrl: existingUrl, amount, reused: true };
    }

    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("marketplace_fee_percentage, marketplace_fee_fixed")
      .maybeSingle();
    const { data: account } = await supabaseAdmin
      .from("mercado_pago_accounts")
      .select("access_token, connected")
      .eq("barbershop_id", shop.id)
      .maybeSingle();

    const marketplaceFee =
      money(
        (amount * Number(settings?.marketplace_fee_percentage ?? 0)) / 100 +
          Number(settings?.marketplace_fee_fixed ?? 0),
      ) || undefined;

    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MIN * 60_000).toISOString();

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        barbershop_id: shop.id,
        customer_id: appointment.customer_id,
        appointment_id: appointment.id,
        type: "customer_service",
        amount,
        status: "pending",
        payment_method: "mercado_pago",
        metadata: { marketplace_fee: marketplaceFee ?? 0, expires_at: expiresAt },
      })
      .select("id")
      .single();
    if (paymentError) throw new Error(paymentError.message);

    const sellerToken =
      account?.connected && account.access_token ? account.access_token : undefined;

    const preference = await createPreference({
      title: `${shop.name} — atendimento`,
      amount,
      externalReference: `service:${payment.id}`,
      notificationUrl: notificationUrl(),
      backUrl: `${origin()}/pagamento/${appointment.id}`,
      expiresAt,
      metadata: { payment_id: payment.id, appointment_id: appointment.id, type: "customer_service" },
      ...(sellerToken ? { sellerToken } : {}),
      ...(sellerToken && marketplaceFee ? { marketplaceFee } : {}),
    });

    await supabaseAdmin
      .from("payments")
      .update({
        mercado_pago_preference_id: preference.id,
        metadata: {
          marketplace_fee: marketplaceFee ?? 0,
          expires_at: expiresAt,
          init_point: preference.init_point,
        },
      })
      .eq("id", payment.id);

    await supabaseAdmin
      .from("appointments")
      .update({
        payment_method: "mercado_pago",
        payment_state: "payment_pending",
        payment_expires_at: expiresAt,
        status: "scheduled",
      })
      .eq("id", appointment.id);

    return { checkoutUrl: preference.init_point, amount, reused: false };
  });

/* ------------------------------------------------------------------ */
/* situação do pagamento (tela de retorno)                             */
/* ------------------------------------------------------------------ */

export type AppointmentPaymentStatus = {
  found: boolean;
  appointment_id?: string;
  /** approved | pending | rejected | expired | none */
  payment_status?: string;
  appointment_status?: string;
  starts_at?: string;
  ends_at?: string;
  price_cents?: number;
  customer_name?: string;
  service_name?: string | null;
  shop_name?: string | null;
  shop_slug?: string | null;
  shop_whatsapp?: string | null;
  payment_amount?: number | null;
  payment_state?: string | null;
};

/**
 * Verdade do pagamento vem sempre do banco (alimentado pelo webhook oficial),
 * nunca dos parâmetros da URL de retorno do Mercado Pago.
 */
export const getAppointmentPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { appointmentId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.appointmentId ?? "")) {
      throw new Error("Agendamento inválido.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("expire_pending_payment_appointments", { _shop: undefined as never });
    const { data: status, error } = await supabaseAdmin.rpc("appointment_payment_status", {
      _appointment_id: data.appointmentId,
    });
    if (error) throw new Error(error.message);
    return status as unknown as AppointmentPaymentStatus;
  });
