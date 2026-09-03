import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook de confirmação de pagamento Pix das cobranças da plataforma.
 *
 * Endpoint genérico, pronto para receber o provedor Pix (Asaas, Efí, etc.) ou
 * uma confirmação manual. Toda chamada precisa do cabeçalho
 * `x-billing-secret` igual ao segredo BILLING_WEBHOOK_SECRET.
 *
 * Corpo (JSON):
 *   { "txid": "NP...", "amount_cents": 1234, "provider": "asaas",
 *     "reference": "id-do-pagamento", "external_id": "id-do-evento" }
 *
 * A confirmação é idempotente (mesmo evento não é processado duas vezes) e,
 * ao marcar a cobrança como paga, a conta da barbearia é reativada
 * automaticamente.
 */
const bodySchema = z.object({
  txid: z.string().min(4).max(35),
  amount_cents: z.number().int().nonnegative().optional(),
  provider: z.string().min(1).max(40).default("manual"),
  reference: z.string().max(120).optional(),
  external_id: z.string().max(120).optional(),
});

async function secretMatches(provided: string | null) {
  const secret = process.env["BILLING_WEBHOOK_SECRET"];
  if (!secret || !provided) return false;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/billing/pix-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await secretMatches(request.headers.get("x-billing-secret")))) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }
        const body = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("billing_mark_invoice_paid", {
          _txid: body.txid,
          _amount_cents: body.amount_cents ?? null,
          _provider: body.provider,
          _reference: body.reference ?? null,
          _external_id: body.external_id ?? null,
          _payload: raw as never,
        });
        if (error) {
          console.error("billing webhook error", error.message);
          return Response.json({ ok: false, error: "processing_failed" }, { status: 500 });
        }
        const result = (data ?? {}) as { ok?: boolean; error?: string };
        return Response.json(result, { status: result.ok === false ? 422 : 200 });
      },
      GET: async () => Response.json({ ok: true, service: "navalha-pro-billing-webhook" }),
    },
  },
});
