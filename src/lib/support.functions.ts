import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LEGAL } from "@/lib/legal";

const GMAIL_GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

/** Base64url de uma string UTF-8 (exigido pelo Gmail API). */
function b64url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Codifica um cabeçalho MIME com RFC 2047 quando há caracteres não-ASCII. */
function encodeHeader(v: string): string {
  return /^[\x00-\x7F]*$/.test(v)
    ? v
    : `=?UTF-8?B?${Buffer.from(v, "utf-8").toString("base64")}?=`;
}

/** Monta a mensagem RFC 2822 e retorna o payload base64url pronto para o Gmail. */
function buildRawEmail(to: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    `From: NAVALHA PRO <${LEGAL.supportEmail}>`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return b64url(email);
}

/** Envia o aviso de novo chamado via Gmail conectado. Falhas não bloqueiam o fluxo. */
async function notifyNewTicket(
  barberName: string,
  barberEmail: string | null,
  shopName: string,
  subject: string,
  body: string,
  when: string,
) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const mailKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!apiKey || !mailKey) {
    console.error("[support-email] LOVABLE_API_KEY ou GOOGLE_MAIL_API_KEY ausente");
    return;
  }

  const emailSubject = `Novo chamado de suporte — ${subject}`;
  const emailBody = [
    "Um novo chamado foi aberto no suporte do NAVALHA PRO.",
    "",
    `Barbeiro: ${barberName}`,
    `Barbearia: ${shopName}`,
    barberEmail ? `E-mail: ${barberEmail}` : "",
    "",
    `Assunto: ${subject}`,
    "",
    "Mensagem inicial:",
    body,
    "",
    `Aberto em: ${when}`,
    "",
    "Acesse o painel de suporte (Suporte › Inbox) para responder.",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = buildRawEmail(LEGAL.supportEmail, emailSubject, emailBody);

  try {
    const res = await fetch(`${GMAIL_GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": mailKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[support-email] Gmail send failed [${res.status}]: ${errBody}`);
    }
  } catch (e) {
    console.error("[support-email] Erro ao enviar notificação:", e);
  }
}

/**
 * Cria a conversa de suporte + primeira mensagem (RLS como o usuário autenticado)
 * e dispara o e-mail de aviso para a equipe. Substitui o insert direto do cliente.
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
