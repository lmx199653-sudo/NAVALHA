/**
 * Processamento dos eventos do Mercado Pago — somente servidor.
 *
 * A confirmação financeira acontece SOMENTE aqui, a partir dos dados oficiais
 * buscados na API do Mercado Pago. Todas as operações são idempotentes.
 */
import {
  getPayment,
  getPreapproval,
  mapPaymentStatus,
  mapSubscriptionStatus,
} from "@/lib/mercadopago.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function referenceOf(externalReference: string | null | undefined) {
  const [kind, id] = (externalReference ?? "").split(":");
  if (!kind || !id) return null;
  return { kind, id };
}

async function audit(
  barbershopId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  data: Record<string, unknown>,
) {
  if (!barbershopId) return;
  const db = await admin();
  await db.from("audit_logs").insert({
    barbershop_id: barbershopId,
    action,
    entity,
    entity_id: entityId,
    after_data: data as never,
  });
}

async function handlePayment(resourceId: string) {
  const db = await admin();
  const mpPayment = await getPayment(resourceId);
  const status = mapPaymentStatus(mpPayment.status);
  const reference = referenceOf(mpPayment.external_reference);

  // Localiza o pagamento interno pela referência externa ou pelo id do MP.
  let paymentId: string | null = reference?.id ?? null;
  if (paymentId) {
    const { data: found } = await db
      .from("payments")
      .select("id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!found) paymentId = null;
  }
  if (!paymentId) {
    const { data: byMp } = await db
      .from("payments")
      .select("id")
      .eq("mercado_pago_payment_id", String(mpPayment.id))
      .maybeSingle();
    paymentId = byMp?.id ?? null;
  }
  if (!paymentId) {
    console.warn("[MercadoPago] pagamento sem correspondência interna", mpPayment.id);
    return;
  }

  const { data: payment } = await db
    .from("payments")
    .select("id, type, status, barbershop_id, appointment_id, amount")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return;
  if (payment.status === "approved" && status === "approved") return; // já baixado

  const paidAt = status === "approved" ? (mpPayment.date_approved ?? new Date().toISOString()) : null;

  await db
    .from("payments")
    .update({
      status,
      mercado_pago_payment_id: String(mpPayment.id),
      payment_method: mpPayment.payment_method_id ?? null,
      paid_at: paidAt,
    })
    .eq("id", payment.id);

  if (status !== "approved") {
    if (payment.type === "usage_fee" && ["rejected", "cancelled"].includes(status)) {
      // Libera as taxas para uma nova tentativa de cobrança.
      await db
        .from("usage_fees")
        .update({ status: "pending", payment_id: null })
        .eq("payment_id", payment.id)
        .neq("status", "paid");
    }
    await audit(payment.barbershop_id, `payment.${status}`, "payments", payment.id, {
      mercado_pago_payment_id: String(mpPayment.id),
      type: payment.type,
    });
    return;
  }

  if (payment.type === "usage_fee") {
    await db
      .from("usage_fees")
      .update({ status: "paid", paid_at: paidAt })
      .eq("payment_id", payment.id)
      .neq("status", "paid");
  }

  if (payment.type === "customer_service" && payment.appointment_id) {
    await db
      .from("appointments")
      .update({ payment_state: "paid", paid_at: paidAt, status: "confirmed" })
      .eq("id", payment.appointment_id);
  }

  if (payment.type === "subscription" && payment.barbershop_id) {
    await db
      .from("platform_subscriptions")
      .update({ status: "active" })
      .eq("barbershop_id", payment.barbershop_id);
  }

  await audit(payment.barbershop_id, "payment.approved", "payments", payment.id, {
    mercado_pago_payment_id: String(mpPayment.id),
    type: payment.type,
    amount: Number(payment.amount),
  });
}

async function handlePreapproval(resourceId: string) {
  const db = await admin();
  const preapproval = await getPreapproval(resourceId);
  const status = mapSubscriptionStatus(preapproval.status);
  const reference = referenceOf(preapproval.external_reference);
  const shopId = reference?.kind === "sub" ? reference.id : null;

  const query = db.from("platform_subscriptions").select("id, barbershop_id, status");
  const { data: subscription } = shopId
    ? await query.eq("barbershop_id", shopId).maybeSingle()
    : await query.eq("mercado_pago_subscription_id", preapproval.id).maybeSingle();
  if (!subscription) {
    console.warn("[MercadoPago] assinatura sem correspondência interna", preapproval.id);
    return;
  }
  if (subscription.status === status) return;

  await db
    .from("platform_subscriptions")
    .update({
      status,
      mercado_pago_subscription_id: preapproval.id,
      mercado_pago_user_id: preapproval.payer_id ? String(preapproval.payer_id) : null,
      subscription_start_date:
        status === "active" ? (preapproval.date_created ?? new Date().toISOString()) : null,
      subscription_next_billing_date: preapproval.next_payment_date ?? null,
      subscription_end_date: status === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", subscription.id);

  await audit(
    subscription.barbershop_id,
    `platform_subscription.${status}`,
    "platform_subscriptions",
    subscription.id,
    { mercado_pago_subscription_id: preapproval.id, status },
  );
}

export async function processMercadoPagoEvent(type: string, resourceId: string) {
  if (type.includes("preapproval") || type.includes("subscription")) {
    await handlePreapproval(resourceId);
    return;
  }
  if (type.includes("payment") || type === "merchant_order") {
    await handlePayment(resourceId);
    return;
  }
  console.warn("[MercadoPago] evento ignorado", type, resourceId);
}
