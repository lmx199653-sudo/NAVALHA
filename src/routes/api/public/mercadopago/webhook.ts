import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function verifySignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secret: string | undefined,
): boolean {
  if (!xSignature || !secret) {
    return true; // Se o secret não estiver configurado no teste local, prossegue
  }

  try {
    const parts = xSignature.split(",");
    let ts = "";
    let hash = "";

    for (const part of parts) {
      const [k, v] = part.trim().split("=");
      if (k === "ts") ts = v;
      if (k === "v1") hash = v;
    }

    if (!ts || !hash) return false;

    const manifest = `id:${dataId || ""};request-id:${xRequestId || ""};ts:${ts};`;
    const computed = createHmac("sha256", secret).update(manifest).digest("hex");

    const a = Buffer.from(computed.toLowerCase(), "utf8");
    const b = Buffer.from(hash.toLowerCase(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch (e) {
    console.error("[Webhook MP API] Erro ao validar assinatura:", e);
    return false;
  }
}

export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, service: "navalha-pro-mp-webhook" }),
      POST: async ({ request }) => {
        const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
        const mpAccessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"] || "";

        let raw: any;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const url = new URL(request.url);
        const type = raw?.type || raw?.topic || url.searchParams.get("type") || url.searchParams.get("topic");
        const dataId = String(raw?.data?.id || raw?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
        const eventId = raw?.id ? String(raw.id) : `${type}_${dataId}_${Date.now()}`;

        // Validação da assinatura x-signature
        const xSignature = request.headers.get("x-signature");
        const xRequestId = request.headers.get("x-request-id");
        if (!verifySignature(xSignature, xRequestId, dataId, secret)) {
          return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
        }

        console.log(`[MP Webhook Server] Evento recebido: type=${type}, id=${dataId}, eventId=${eventId}`);

        // Idempotência
        const { data: existing } = await supabaseAdmin
          .from("mercadopago_events")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle();

        if (existing) {
          return Response.json({ ok: true, deduplicated: true }, { status: 200 });
        }

        await supabaseAdmin.from("mercadopago_events").insert({
          event_id: eventId,
          event_type: type || "unknown",
          resource_id: dataId,
          payload: raw,
          status: "processing",
        });

        try {
          if (type === "subscription_preapproval" || type === "preapproval") {
            const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
              headers: { Authorization: `Bearer ${mpAccessToken}` },
            });

            if (res.ok) {
              const sub = await res.json();
              const barbershopId = sub.external_reference;
              const mpStatus = sub.status;

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
            const res = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
              headers: { Authorization: `Bearer ${mpAccessToken}` },
            });

            if (res.ok) {
              const payment = await res.json();
              const preapprovalId = payment.preapproval_id;
              const pStatus = payment.status;

              const { data: currentSub } = await supabaseAdmin
                .from("subscriptions")
                .select("*")
                .eq("mercadopago_preapproval_id", preapprovalId)
                .maybeSingle();

              if (currentSub) {
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
                    .eq("id", currentSub.id);

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
                  const failedAt = new Date();
                  const graceUntil = new Date(failedAt.getTime() + 2 * 24 * 60 * 60 * 1000); // dias 6 e 7
                  const restrictedAt = new Date(failedAt.getTime() + 3 * 24 * 60 * 60 * 1000); // dia 8
                  const suspendedAt = new Date(failedAt.getTime() + 5 * 24 * 60 * 60 * 1000); // dia 10

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
          }

          await supabaseAdmin
            .from("mercadopago_events")
            .update({ status: "processed" })
            .eq("event_id", eventId);

          return Response.json({ ok: true });
        } catch (procErr: any) {
          console.error("[MP Webhook Server] Erro:", procErr);
          await supabaseAdmin
            .from("mercadopago_events")
            .update({ status: "error" })
            .eq("event_id", eventId);
          return Response.json({ ok: false, error: procErr.message }, { status: 200 });
        }
      },
    },
  },
});
