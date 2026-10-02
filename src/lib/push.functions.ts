import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  endpoint: string;
  p256dh: string;
  auth: string;
  barbershopId: string | null;
  userAgent: string | null;
};

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.endpoint || !input.p256dh || !input.auth) throw new Error("Assinatura inválida");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        barbershop_id: data.barbershopId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => {
    if (!input?.endpoint) throw new Error("Endpoint inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPush } = await import("@/lib/webpush.server");

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) {
      return { ok: false, sent: 0, reason: "Nenhum dispositivo registrado neste perfil. Clique primeiro em 'Ativar neste dispositivo'." };
    }

    const payload = {
      title: "🔔 Teste do NAVALHA PRO",
      body: "Notificações push configuradas e ativas com sucesso!",
      tag: `test-${Date.now()}`,
      url: "/dashboard",
    };

    let sent = 0;
    const stale: string[] = [];
    for (const s of subs) {
      try {
        const res = await sendPush(s, payload);
        if (res.ok) sent++;
        if (res.gone) stale.push(s.endpoint);
      } catch (err) {
        console.error("[push-test] erro:", err);
      }
    }

    if (stale.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return { ok: sent > 0, sent, total: subs.length };
  });

export const getPushSubscriptionCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    return { count: count ?? 0 };
  });
