/**
 * Retorno do OAuth do Mercado Pago — /api/public/mercado-pago/oauth-callback
 *
 * O `state` é assinado no servidor, então só a barbearia que iniciou o fluxo
 * pode ter a conta vinculada. Os tokens são gravados apenas pelo servidor.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mercado-pago/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const back = (result: string) =>
          new Response(null, {
            status: 302,
            headers: { location: `/configuracoes?mercado_pago=${result}` },
          });

        if (!code || !state) return back("erro");

        try {
          const { verifyState } = await import("@/lib/mercadopago-state.server");
          const shopId = await verifyState(state);
          if (!shopId) return back("estado_invalido");

          const { exchangeOauthCode } = await import("@/lib/mercadopago.server");
          const token = await exchangeOauthCode({
            code,
            redirectUri: `${url.origin}/api/public/mercado-pago/oauth-callback`,
          });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("mercado_pago_accounts").upsert(
            {
              barbershop_id: shopId,
              mp_user_id: String(token.user_id),
              access_token: token.access_token,
              refresh_token: token.refresh_token ?? null,
              public_key: token.public_key ?? null,
              expires_at: token.expires_in
                ? new Date(Date.now() + token.expires_in * 1000).toISOString()
                : null,
              connected: true,
            },
            { onConflict: "barbershop_id" },
          );

          await supabaseAdmin.from("audit_logs").insert({
            barbershop_id: shopId,
            action: "mercado_pago.connected",
            entity: "mercado_pago_accounts",
            after_data: { mp_user_id: String(token.user_id) } as never,
          });

          return back("conectado");
        } catch (error) {
          console.error("[MercadoPago oauth]", error);
          return back("erro");
        }
      },
    },
  },
});
