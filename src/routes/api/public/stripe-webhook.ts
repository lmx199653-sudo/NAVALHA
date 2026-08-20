import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import Stripe from "stripe";

const RELEVANT_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) {
          return new Response(
            "STRIPE_WEBHOOK_SECRET não configurado. Crie um endpoint de webhook no Stripe Dashboard e salve o signing secret.",
            { status: 400 }
          );
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("Assinatura ausente", { status: 400 });
        }

        const body = await request.text();
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return new Response("Assinatura inválida", { status: 401 });
        }

        const event = JSON.parse(body) as Stripe.Event;
        if (!RELEVANT_EVENTS.has(event.type)) {
          return new Response("ok");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const stripeKey = process.env["STRIPE_SECRET_KEY"];
        if (!stripeKey) {
          return new Response("STRIPE_SECRET_KEY não configurado", { status: 500 });
        }
        const stripe = new Stripe(stripeKey, { apiVersion: "2026-07-29.dahlia" });

        let subscription: Stripe.Subscription | null = null;

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          if (!session.subscription) {
            return new Response("ok");
          }
          subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        } else if (event.type.startsWith("customer.subscription.")) {
          subscription = event.data.object as Stripe.Subscription;
        }

        if (!subscription) {
          return new Response("ok");
        }

        const userId =
          subscription.metadata?.user_id ||
          (subscription as unknown as { metadata?: { user_id?: string } }).metadata?.user_id;
        if (!userId) {
          return new Response("ok");
        }

        const item = subscription.items.data[0];
        const priceId = item?.price.id || null;

        const { data: existing } = await supabaseAdmin
          .from("user_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        const payload = {
          user_id: userId,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          status: subscription.status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        };

        if (existing) {
          await supabaseAdmin
            .from("user_subscriptions")
            .update(payload)
            .eq("id", existing.id as string);
        } else {
          await supabaseAdmin.from("user_subscriptions").insert(payload);
        }

        return new Response("ok");
      },
    },
  },
});
