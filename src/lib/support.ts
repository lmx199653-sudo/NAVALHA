import { supabase } from "@/integrations/supabase/client";
import { createSupportConversation } from "@/lib/support.functions";

export type SupportStatus = "new" | "open" | "resolved";

export type SupportConversation = {
  id: string;
  barbershop_id: string | null;
  user_id: string;
  subject: string;
  status: SupportStatus;
  urgent: boolean;
  assigned_to: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  barber_unread: number;
  support_unread: number;
  resolved_at: string | null;
  created_at: string;
  barbershops?: {
    name: string;
    slug: string;
    phone: string | null;
    whatsapp: string | null;
  } | null;
  profiles?: { full_name: string | null; email: string | null; phone: string | null } | null;
};

export type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "barber" | "support";
  body: string;
  attachment_path: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export const SUPPORT_STATUS: Record<SupportStatus, { label: string; tone: string; dot: string }> = {
  new: {
    label: "Novo",
    tone: "border-primary/40 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  open: {
    label: "Em atendimento",
    tone: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    dot: "bg-sky-400",
  },
  resolved: {
    label: "Resolvido",
    tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
};

// Tipos gerados ainda não conhecem as novas tabelas — cliente sem tipagem forte.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export async function fetchIsSupport(): Promise<boolean> {
  const { data, error } = await db.rpc("is_support");
  if (error) return false;
  return data === true;
}

export async function fetchMyConversations(userId: string): Promise<SupportConversation[]> {
  const { data, error } = await db
    .from("support_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportConversation[];
}

export async function fetchInbox(): Promise<SupportConversation[]> {
  const { data, error } = await db
    .from("support_conversations")
    .select("*, barbershops(name, slug, phone, whatsapp)")
    .order("urgent", { ascending: false })
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as SupportConversation[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (ids.length === 0) return rows;
  // Dados básicos do barbeiro (nome, e-mail, telefone) — visíveis só para a equipe de suporte.
  const { data: users } = await db.rpc("support_user_info", { _user_ids: ids });
  const byId = new Map<
    string,
    { full_name: string | null; email: string | null; phone: string | null }
  >(
    (
      (users ?? []) as {
        user_id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      }[]
    ).map((u) => [u.user_id, { full_name: u.full_name, email: u.email, phone: u.phone }]),
  );
  return rows.map((r) => ({ ...r, profiles: byId.get(r.user_id) ?? null }));
}

export async function fetchMessages(conversationId: string): Promise<SupportMessage[]> {
  const { data, error } = await db
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

export async function createConversation(input: {
  userId: string;
  barbershopId: string | null;
  subject: string;
  body: string;
}): Promise<string> {
  // A criação + primeira mensagem + e-mail de aviso rodam no servidor (RLS como
  // o usuário autenticado). O e-mail não bloqueia o fluxo em caso de falha.
  return createSupportConversation({
    data: {
      subject: input.subject,
      body: input.body,
      barbershopId: input.barbershopId,
    },
  });
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  attachmentPath?: string | null;
}) {
  const { error } = await db.from("support_messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    body: input.body.trim(),
    attachment_path: input.attachmentPath ?? null,
  });
  if (error) throw error;
}

export async function uploadAttachment(conversationId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie apenas imagens (print ou foto).");
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("support-attachments")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedAttachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

export async function markRead(conversationId: string) {
  await db.rpc("support_mark_read", { _conv: conversationId });
}

export async function updateConversation(
  id: string,
  patch: Partial<Pick<SupportConversation, "status" | "urgent" | "assigned_to" | "subject">>,
) {
  const { error } = await db.from("support_conversations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markAllNotificationsRead() {
  await db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
