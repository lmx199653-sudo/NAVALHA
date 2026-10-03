// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// @ts-ignore
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

/**
 * Validação de assinatura x-signature do Mercado Pago
 */
async function verifyMercadoPagoSignature(
  req: Request,
  bodyText: string,
  secret: string,
): Promise<boolean> {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !secret) {
    // Se o segredo não estiver configurado no ambiente de teste, permite com aviso
    console.warn("[Webhook MP] x-signature ou segredo ausente, prosseguindo com verificação por chave de acesso.");
    return true;
  }

  try {
    const parts = xSignature.split(",");
    let ts = "";
    let hash = "";

    for (const part of parts) {
      const [key, val] = part.trim().split("=");
      if (key === "ts") ts = val;
      if (key === "v1") hash = val;
    }

    if (!ts || !hash) return false;

    // Obtém o id dos parâmetros de busca ou do corpo
    const url = new URL(req.url);
    let dataId = url.searchParams.get("data.id") || url.searchParams.get("id");
    if (!dataId && bodyText) {
      try {
        const json = JSON.parse(bodyText);
        dataId = json.data?.id || json.id;
      } catch {
        // ignore
      }
    }

    // Template padrão da documentação do Mercado Pago:
    // manifest: "id:[data.id];request-id:[x-request-id];ts:[ts];"
    const manifest = `id:${dataId || ""};request-id:${xRequestId || ""};ts:${ts};`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signatureHex.toLowerCase() === hash.toLowerCase();
  } catch (err) {
    console.error("[Webhook MP] Erro ao validar assinatura:", err);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Permite verificação simples de status via GET
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "mercadopago-webhook" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "";

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let rawBody = "";
  let payload: any = {};

  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Payload inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Validar x-signature (se fornecido)
  const isSignatureValid = await verifyMercadoPagoSignature(req, rawBody, webhookSecret);
  if (!isSignatureValid) {
    console.warn("[Webhook MP] Assinatura x-signature inválida rejeitada.");
    return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const type = payload.type || payload.topic || url.searchParams.get("type") || url.searchParams.get("topic");
  const dataId = payload.data?.id || payload.id || url.searchParams.get("data.id") || url.searchParams.get("id");
  const eventId = payload.id ? String(payload.id) : `${type}_${dataId}_${Date.now()}`;

  console.log(`[Webhook MP] Evento recebido: type=${type}, id=${dataId}, eventId=${eventId}`);

  // 2. Idempotência: verificar se o evento já foi processado
  const { data: existingEvent } = await supabaseAdmin
    .from("mercadopago_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent) {
    console.log(`[Webhook MP] Evento ${eventId} já processado anteriormente.`);
    return new Response(JSON.stringify({ ok: true, deduplicated: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Registra o evento para garantir idempotência
  await supabaseAdmin.from("mercadopago_events").insert({
    event_id: eventId,
    event_type: type || "unknown",
    resource_id: String(dataId || ""),
    payload: payload,
    status: "processing",
  });

  try {
    // 3. Processamento conforme o tipo de recurso
    if (type === "subscription_preapproval" || type === "preapproval") {
      // Consulta a assinatura no Mercado Pago
      const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });

      if (res.ok) {
        const sub = await res.json();
        const barbershopId = sub.external_reference;
        const mpStatus = sub.status; // 'authorized', 'pending', 'cancelled'

        console.log(`[Webhook MP] Preapproval ${dataId} status: ${mpStatus}, barbershop: ${barbershopId}`);

        let internalStatus = "payment_pending";
        if (mpStatus === "authorized") internalStatus = "active";
        else if (mpStatus === "cancelled") internalStatus = "cancelled";

        const updateData: any = {
          mercadopago_preapproval_id: sub.id,
          status: internalStatus,
          monthly_amount: sub.auto_recurring?.transaction_amount || 49.90,
          next_payment_date: sub.next_payment_date || null,
          updated_at: new Date().toISOString(),
        };

        if (internalStatus === "active") {
          updateData.last_payment_date = new Date().toISOString();
          updateData.last_payment_status = "approved";
          updateData.payment_failed_at = null;
          updateData.grace_until = null;
          updateData.restricted_at = null;
          updateData.suspended_at = null;
        }

        if (barbershopId) {
          await supabaseAdmin
            .from("subscriptions")
            .update(updateData)
            .eq("barbershop_id", barbershopId);
        } else {
          await supabaseAdmin
            .from("subscriptions")
            .update(updateData)
            .eq("mercadopago_preapproval_id", sub.id);
        }
      }
    } else if (
      type === "subscription_authorized_payment" ||
      type === "authorized_payment"
    ) {
      // Consulta cobrança autorizada de assinatura
      const res = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });

      if (res.ok) {
        const payment = await res.json();
        const preapprovalId = payment.preapproval_id;
        const pStatus = payment.status; // 'approved', 'rejected', etc.

        console.log(`[Webhook MP] Authorized payment ${dataId}: status=${pStatus}, preapproval=${preapprovalId}`);

        const { data: currentSub } = await supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("mercadopago_preapproval_id", preapprovalId)
          .maybeSingle();

        if (currentSub) {
          if (pStatus === "approved") {
            // Reativação imediata
            await supabaseAdmin
              .from("subscriptions")
              .update({
                status: "active",
                last_payment_date: payment.date_approved || new Date().toISOString(),
                last_payment_status: "approved",
                payment_failed_at: null,
                grace_until: null,
                restricted_at: null,
                suspended_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentSub.id);

            // Grava no histórico de faturas
            await supabaseAdmin.from("subscription_invoices").insert({
              subscription_id: currentSub.id,
              barbershop_id: currentSub.barbershop_id,
              mp_payment_id: String(payment.id || dataId),
              amount: payment.transaction_amount || 0,
              status: "approved",
              date_approved: payment.date_approved || new Date().toISOString(),
              billing_type: payment.billing_day_proportional ? "pro_rata" : "regular",
              raw_payload: payment,
            });
          } else if (pStatus === "rejected") {
            // Regra de inadimplência:
            // Dia 5: payment_pending
            // Dias 6 e 7: tolerância (grace_until)
            // Dia 8: restrição (restricted_at)
            // Dia 10: suspensão (suspended_at)
            const failedAt = new Date();
            const graceUntil = new Date(failedAt.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 dias
            const restrictedAt = new Date(failedAt.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 dias (dia 8)
            const suspendedAt = new Date(failedAt.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 dias (dia 10)

            await supabaseAdmin
              .from("subscriptions")
              .update({
                status: "payment_pending",
                last_payment_status: "rejected",
                payment_failed_at: failedAt.toISOString(),
                grace_until: graceUntil.toISOString(),
                restricted_at: restrictedAt.toISOString(),
                suspended_at: suspendedAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentSub.id);

            // Grava fatura com erro
            await supabaseAdmin.from("subscription_invoices").insert({
              subscription_id: currentSub.id,
              barbershop_id: currentSub.barbershop_id,
              mp_payment_id: String(payment.id || dataId),
              amount: payment.transaction_amount || 0,
              status: "rejected",
              billing_type: "regular",
              raw_payload: payment,
            });
          }
        }
      }
    } else if (type === "payment") {
      // Pagamento comum v1
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });

      if (res.ok) {
        const payment = await res.json();
        const barbershopId = payment.external_reference;
        const pStatus = payment.status;

        if (barbershopId) {
          if (pStatus === "approved") {
            await supabaseAdmin
              .from("subscriptions")
              .update({
                status: "active",
                last_payment_date: payment.date_approved || new Date().toISOString(),
                last_payment_status: "approved",
                payment_failed_at: null,
                grace_until: null,
                restricted_at: null,
                suspended_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("barbershop_id", barbershopId);
          }
        }
      }
    }

    // Marca o evento como processado com sucesso
    await supabaseAdmin
      .from("mercadopago_events")
      .update({ status: "processed" })
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ ok: true, event_id: eventId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (procErr: any) {
    console.error(`[Webhook MP] Falha no processamento:`, procErr);
    await supabaseAdmin
      .from("mercadopago_events")
      .update({ status: "error" })
      .eq("event_id", eventId);

    // Retorna 200 para o Mercado Pago não travar a fila, mas loga o erro
    return new Response(JSON.stringify({ ok: false, error: procErr.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
