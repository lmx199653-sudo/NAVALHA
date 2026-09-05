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



    return conversationId;
  });
