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

async function assertMember(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  shopId: string,
) {
  const { data, error } = await supabase.rpc("is_member", { _shop: shopId });
  if (error || data !== true) throw new Error("Sem permissão para esta barbearia.");
}

/* ------------------------------------------------------------------ */
/* leitura                                                             */
/* ------------------------------------------------------------------ */

export const getBillingSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shopId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: summary, error } = await context.supabase.rpc("barbershop_billing_summary", {
      _shop: data.shopId,
    });
    if (error) throw new Error(error.message);
    return summary as unknown as Record<string, unknown>;
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

    const reference = `sub:${data.shopId}:${plan.id}`;
    const preapproval = await createPreapproval({
      reason: `Navalha Pro — ${plan.name}`,
      amount,
      externalReference: reference,
      backUrl: `${origin()}/financeiro`,
      notificationUrl: notificationUrl(),
      payerEmail: (context.claims as { email?: string } | undefined)?.email,
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

export const createServiceCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; appointmentId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPreference } = await import("@/lib/mercadopago.server");

    const { data: shop } = await supabaseAdmin
      .from("barbershops")
      .select("id, name")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!shop) throw new Error("Barbearia não encontrada.");

    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id, barbershop_id, customer_id, price_cents, status, payment_state, service_id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appointment || appointment.barbershop_id !== shop.id) {
      throw new Error("Agendamento não encontrado.");
    }
    if (appointment.payment_state === "paid") throw new Error("Este agendamento já está pago.");
    if (!["scheduled", "confirmed"].includes(appointment.status)) {
      throw new Error("Agendamento não disponível para pagamento.");
    }

    // Valor real vem do banco, nunca do navegador.
    const amount = money(appointment.price_cents / 100);
    if (amount <= 0) throw new Error("Serviço sem valor para pagamento online.");

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
        metadata: { marketplace_fee: marketplaceFee ?? 0 },
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
      backUrl: `${origin()}/barbearia/${data.slug}`,
      metadata: { payment_id: payment.id, appointment_id: appointment.id, type: "customer_service" },
      ...(sellerToken ? { sellerToken, marketplaceFee } : {}),
    });

    await supabaseAdmin
      .from("payments")
      .update({ mercado_pago_preference_id: preference.id })
      .eq("id", payment.id);

    await supabaseAdmin
      .from("appointments")
      .update({ payment_method: "mercado_pago", payment_state: "pending" })
      .eq("id", appointment.id);

    return { checkoutUrl: preference.init_point, amount };
  });
