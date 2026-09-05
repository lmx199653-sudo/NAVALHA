import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cria a conversa de suporte + primeira mensagem (RLS como o usuário autenticado).
 */

export const createSupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { subject: string; body: string; barbershopId: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const subject = data.subject.trim() || "Ajuda";

    // 1. Cria a conversa
    const { data: conv, error: convError } = await db
      .from("support_conversations")
      .insert({
        user_id: userId,
        barbershop_id: data.barbershopId,
        subject,
      })
      .select("id")
      .single();
    if (convError) throw convError;
    const conversationId = conv.id as string;

    // 2. Cria a primeira mensagem
    const { error: msgError } = await db.from("support_messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: data.body.trim(),
      attachment_path: null,
    });
    if (msgError) throw msgError;

    // 3. Coleta dados do barbeiro para o e-mail
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    let shopName = "—";
    if (data.barbershopId) {
      const { data: shop } = await db
        .from("barbershops")
        .select("name")
        .eq("id", data.barbershopId)
        .maybeSingle();
      if (shop?.name) shopName = shop.name;
    }

    const barberName = profile?.full_name || profile?.email || "Barbeiro";
    const when = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 4. Envia o aviso por e-mail (não bloqueia em caso de falha)
    await notifyNewTicket(
      barberName,
      profile?.email ?? null,
      shopName,
      subject,
      data.body.trim(),
      when,
    );

    return conversationId;
  });
