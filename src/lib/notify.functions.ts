import { createServerFn } from "@tanstack/react-start";

type Input = { appointmentId: string };

/**
 * Notifica a barbearia (donos/membros com push ativo) quando um cliente agenda
 * pelo link público. Endpoint público, mas só envia notificação para um
 * agendamento online recém-criado — nenhum dado sensível é retornado.
 */
export const notifyNewAppointment = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!input?.appointmentId || !/^[0-9a-f-]{36}$/i.test(input.appointmentId)) {
      throw new Error("Agendamento inválido");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPush } = await import("@/lib/webpush.server");

    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, barbershop_id, customer_name, starts_at, created_at, source, service_id")
      .eq("id", data.appointmentId)
      .maybeSingle();

    if (!appt || appt.source !== "online") return { ok: false, sent: 0 };
    if (Date.now() - new Date(appt.created_at).getTime() > 5 * 60_000) return { ok: false, sent: 0 };

    const [{ data: shop }, { data: service }, { data: owner }, { data: members }] = await Promise.all([
      supabaseAdmin.from("barbershops").select("name, owner_id").eq("id", appt.barbershop_id).maybeSingle(),
      appt.service_id
        ? supabaseAdmin.from("services").select("name").eq("id", appt.service_id).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
      Promise.resolve({ data: null }),
      supabaseAdmin.from("barbershop_members").select("user_id").eq("barbershop_id", appt.barbershop_id),
    ]);
    void owner;

    const userIds = new Set<string>();
    if (shop?.owner_id) userIds.add(shop.owner_id);
    for (const m of members ?? []) userIds.add(m.user_id);
    if (userIds.size === 0) return { ok: true, sent: 0 };

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", [...userIds]);

    if (!subs?.length) return { ok: true, sent: 0 };

    const when = new Date(appt.starts_at).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const payload = {
      title: "Novo agendamento",
      body: `${appt.customer_name} • ${service?.name ?? "Serviço"} • ${when}`,
      tag: `appt-${appt.id}`,
      url: "/agenda",
    };

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          const res = await sendPush(s, payload);
          console.info("[push] status", res.status, "ok", res.ok, s.endpoint.slice(0, 40));
          if (res.ok) sent++;
          if (res.gone) stale.push(s.endpoint);
        } catch (err) {
          console.error("[push] falha", err);
        }
      }),
    );

    if (stale.length) await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", stale);

    return { ok: true, sent };

  });
