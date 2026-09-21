/**
 * Garante que exista uma barbearia para o usuário logado.
 *
 * Usado nas telas administrativas: se o barbeiro tentar salvar dados antes de
 * a barbearia existir, ela é criada automaticamente (com vínculo de dono,
 * horários padrão e dados iniciais) em vez de exibir erro.
 */
import { supabase } from "@/lib/supabase-guard";
import { slugify } from "@/lib/format";
import { seedStarterData } from "@/lib/starter-data";

export const SEM_LOGIN_MESSAGE = "Não foi possível identificar sua conta agora. Tente novamente.";

async function currentUserId() {
  // A sessão local resolve na maioria dos casos; se ela ainda não estiver
  // hidratada, revalidamos direto no servidor em vez de pedir novo login.
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;
  const { data: userData } = await supabase.auth.getUser();
  return userData.user?.id ?? null;
}

/** Garante o vínculo de dono, para o app reconhecer a barbearia na hora. */
async function ensureOwnerMembership(shopId: string, userId: string) {
  await supabase
    .from("barbershop_members")
    .upsert(
      { barbershop_id: shopId, user_id: userId, role: "owner" },
      { onConflict: "barbershop_id,user_id" },
    );
}

async function existingShopId(userId: string) {
  // Primeiro pelo vínculo de equipe (cobre dono e demais membros).
  const { data: members } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("user_id", userId)
    .limit(1);
  if (members?.[0]?.barbershop_id) return members[0].barbershop_id;

  const { data } = await supabase
    .from("barbershops")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "barbearia";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data } = await supabase
      .from("barbershops")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Devolve o id da barbearia do usuário, criando-a se ainda não existir. */
export async function ensureShopId(preferredName?: string): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error(SEM_LOGIN_MESSAGE);

  const found = await existingShopId(userId);
  if (found) return found;

  const name = (preferredName ?? "").trim() || "Minha Barbearia";
  const slug = await uniqueSlug(name);

  const { data, error } = await supabase
    .from("barbershops")
    .insert({ owner_id: userId, name, slug, onboarding_done: true })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Não foi possível criar a barbearia.");

  await supabase
    .from("barbershop_members")
    .upsert(
      { barbershop_id: data.id, user_id: userId, role: "owner" },
      { onConflict: "barbershop_id,user_id" },
    );

  await supabase.from("business_hours").upsert(
    Array.from({ length: 7 }, (_, weekday) => ({
      barbershop_id: data.id,
      weekday,
      open_time: "09:00",
      close_time: weekday === 6 ? "18:00" : "20:00",
      closed: weekday === 0,
    })),
    { onConflict: "barbershop_id,weekday" },
  );

  try {
    await seedStarterData(data.id);
  } catch {
    // Dados de exemplo são opcionais: nunca bloqueiam a criação da barbearia.
  }

  return data.id;
}
