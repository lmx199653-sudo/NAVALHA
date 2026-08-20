import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Stripe from "stripe";

const PRICE_ID = "price_1U6Vt7BchwKvWqF5wzKQnRsC";
const TRIAL_DAYS = 7;

function getStripe() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  return new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
}

function getOrigin() {
  return process.env["WEBSITE_URL"] || "https://pronavalha.lovable.app";
}

export const createCheckoutSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripe = getStripe();
    const { userId, supabase } = context;
    const email = context.claims.email;
    if (typeof email !== "string" || !email) throw new Error("E-mail do usuário não disponível");

    const { data: existing } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = (existing?.stripe_customer_id as string | undefined) || "";

    if (!customerId) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = getOrigin();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: "subscription",
      subscription_data: { trial_period_days: TRIAL_DAYS },
      success_url: `${origin}/assinatura?success=1`,
      cancel_url: `${origin}/assinatura?canceled=1`,
      metadata: { user_id: userId },
    };
    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) throw new Error("Falha ao criar sessão de checkout");
    return { url: session.url };
  });

export const checkSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripe = getStripe();
    const { userId, supabase } = context;
    const email = context.claims.email as string | undefined;
    if (!email) throw new Error("E-mail do usuário não disponível");

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub) {
      return {
        subscribed: false,
        status: "inactive" as const,
        trial_end: null,
        current_period_end: null,
      };
    }

    const status = sub.status as string;
    const activeStatuses = ["active", "trialing", "past_due"];
    return {
      subscribed: activeStatuses.includes(status),
      status,
      trial_end: sub.trial_end ? new Date(sub.trial_end as string).toISOString() : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end as string).toISOString()
        : null,
    };
  });

export const createCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripe = getStripe();
    const { userId, supabase } = context;

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id as string | undefined;
    if (!customerId) throw new Error("Nenhuma assinatura encontrada");

    const origin = "https://pronavalha.lovable.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/assinatura`,
    });

    if (!portal.url) throw new Error("Falha ao criar portal do cliente");
    return { url: portal.url };
  });
