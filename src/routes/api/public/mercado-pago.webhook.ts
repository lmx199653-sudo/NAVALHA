/**
 * Webhook do Mercado Pago — /api/public/mercado-pago/webhook
 *
 * - Valida a assinatura (x-signature) quando MERCADOPAGO_WEBHOOK_SECRET existe.
 * - Nunca confia no corpo recebido: busca o recurso oficial na API.
 * - É idempotente: o mesmo evento nunca é processado duas vezes.
 */
import { createFileRoute } from "@tanstack/react-router";

type Notification = {
  id?: number | string;
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string };
  resource?: string;
};

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signatureValid(request: Request, dataId: string | undefined) {
  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!secret) return true; // sem secret configurado, segue apenas com validação por API
  const header = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const [k, v] = piece.split("=");
      return [(k ?? "").trim(), (v ?? "").trim()];
    }),
  ) as { ts?: string; v1?: string };
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId ?? ""};request-id:${requestId};ts:${parts.ts};`;
  return (await hmacHex(secret, manifest)) === parts.v1;
}

function resourceIdOf(notification: Notification) {
  return (
    notification.data?.id ??
    (notification.resource ? notification.resource.split("/").pop() : undefined) ??
    undefined
  );
}

export const Route = createFileRoute("/api/public/mercado-pago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let notification: Notification;
        try {
          notification = JSON.parse(raw) as Notification;
        } catch {
          return new Response("invalid payload", { status: 400 });
        }

        const resourceId = resourceIdOf(notification);
        if (!(await signatureValid(request, resourceId))) {
          return new Response("invalid signature", { status: 401 });
        }

        const type = notification.type ?? notification.topic ?? "unknown";
        const eventId = `${type}:${resourceId ?? "none"}:${notification.action ?? "n/a"}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotência: o primeiro insert ganha; repetições saem aqui.
        const { data: event, error: insertError } = await supabaseAdmin
          .from("mercado_pago_webhook_events")
          .insert({
            event_id: eventId,
            type,
            resource_id: resourceId ?? null,
            payload: notification as never,
          })
          .select("id")
          .maybeSingle();
        if (insertError || !event) {
          // Já registrado anteriormente (unique) — nada a fazer.
          return new Response("duplicate", { status: 200 });
        }

        try {
          if (!resourceId) throw new Error("Notificação sem identificador de recurso.");
          const { processMercadoPagoEvent } = await import("@/lib/mercadopago-events.server");
          await processMercadoPagoEvent(type, resourceId);
          await supabaseAdmin
            .from("mercado_pago_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("id", event.id);
        } catch (error) {
          console.error("[MercadoPago webhook]", error);
          await supabaseAdmin
            .from("mercado_pago_webhook_events")
            .update({ error: error instanceof Error ? error.message : String(error) })
            .eq("id", event.id);
          // 200 evita reentrega infinita; o evento fica marcado com erro para auditoria.
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
