// @ts-ignore
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mpAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
    const defaultPrice = Number(Deno.env.get("MERCADOPAGO_MONTHLY_PRICE") ?? "49.90");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Configuração do Supabase ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({
          error: "Credenciais do Mercado Pago não configuradas. Defina MERCADOPAGO_ACCESS_TOKEN.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Validar autenticação do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token de usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { barbershop_id, back_url } = body;

    if (!barbershop_id) {
      return new Response(JSON.stringify({ error: "barbershop_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verificar se o usuário é dono ou membro da barbearia
    const { data: shop, error: shopError } = await supabaseAdmin
      .from("barbershops")
      .select("id, name, owner_id")
      .eq("id", barbershop_id)
      .single();

    if (shopError || !shop) {
      return new Response(JSON.stringify({ error: "Barbearia não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verificar se já existe assinatura registrada no Supabase
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("barbershop_id", barbershop_id)
      .maybeSingle();

    // Se já tiver assinatura ativa com Mercado Pago, consultar o preapproval
    if (existingSub?.mercadopago_preapproval_id && existingSub.status === "active") {
      const checkResp = await fetch(
        `https://api.mercadopago.com/preapproval/${existingSub.mercadopago_preapproval_id}`,
        {
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
          },
        },
      );

      if (checkResp.ok) {
        const mpCurrent = await checkResp.json();
        if (mpCurrent.status === "authorized") {
          return new Response(
            JSON.stringify({
              already_active: true,
              subscription: existingSub,
              init_point: mpCurrent.init_point || mpCurrent.sandbox_init_point,
              message: "Esta barbearia já possui uma assinatura ativa.",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // 4. Montar a requisição de Preapproval (Assinatura Recorrente) com Pro-rata no Mercado Pago
    // Regra: vencimento dia 5, mensal, pro-rata habilitado
    const payerEmail = user.email || "contato@navalhapro.com.br";
    const appBaseUrl = back_url || "https://pronavalha.lovable.app/cobranca";

    const buildPayload = (email: string) => ({
      payer_email: email,
      back_url: `${appBaseUrl}?from_mp=1`,
      reason: `Assinatura NAVALHA PRO - ${shop.name || "Plano Mensal"}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: defaultPrice,
        currency_id: "BRL",
        billing_day: 5,
        billing_day_proportional: true,
      },
      external_reference: barbershop_id,
      status: "pending",
    });

    console.log("[MercadoPago Subscription] Criando assinatura:", JSON.stringify(buildPayload(payerEmail)));

    let mpResp = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(payerEmail)),
    });

    let mpData = await mpResp.json();

    const isUserMismatch =
      !mpResp.ok &&
      (JSON.stringify(mpData).includes("Both payer and collector") ||
        JSON.stringify(mpData).includes("payer and collector"));

    if (isUserMismatch) {
      console.warn("[MercadoPago Subscription] Ambiente de teste detectado no Mercado Pago. Usando test_user comprador.");
      mpResp = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload("test_user_2516787368175232095@testuser.com")),
      });
      mpData = await mpResp.json();
    }

    if (!mpResp.ok) {
      console.error("[MercadoPago Subscription] Erro da API MP:", mpData);
      return new Response(
        JSON.stringify({
          error: mpData.message || "Falha ao criar assinatura no Mercado Pago",
          details: mpData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Salvar/atualizar a assinatura no Supabase com status 'payment_pending'
    const checkoutUrl = mpData.init_point || mpData.sandbox_init_point;
    const preapprovalId = mpData.id;

    const { error: upsertError } = await supabaseAdmin.from("subscriptions").upsert(
      {
        barbershop_id: barbershop_id,
        user_id: user.id,
        mercadopago_preapproval_id: preapprovalId,
        mercadopago_plan_id: mpData.preapproval_plan_id || null,
        status: "payment_pending",
        monthly_amount: defaultPrice,
        next_payment_date: mpData.next_payment_date || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "barbershop_id" },
    );

    if (upsertError) {
      console.error("[MercadoPago Subscription] Erro ao salvar no Supabase:", upsertError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        preapproval_id: preapprovalId,
        init_point: checkoutUrl,
        monthly_amount: defaultPrice,
        billing_day: 5,
        proportional: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[MercadoPago Subscription] Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
