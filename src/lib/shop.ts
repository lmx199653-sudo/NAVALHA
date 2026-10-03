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
  const res = await supabase
    .from("barbershop_members")
    .upsert(
      { barbershop_id: shopId, user_id: userId, role: "owner" },
      { onConflict: "barbershop_id,user_id" },
    );
  if (res.error) {
    await supabase
      .from("barbershop_members")
      .insert({ barbershop_id: shopId, user_id: userId, role: "owner" });
  }
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

async function isSlugTaken(candidate: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("public_shop", { _slug: candidate });
    if (!error && Array.isArray(data) && data.length > 0) {
      return true;
    }
  } catch {
    // fallback
  }
  return false;
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "barbearia";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await isSlugTaken(candidate);
    if (!taken) return candidate;
  }
  return `${root}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Devolve o id da barbearia do usuário, criando-a se ainda não existir. */
export async function ensureShopId(preferredName?: string): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new Error(SEM_LOGIN_MESSAGE);

  const found = await existingShopId(userId);
  if (found) {
    await ensureOwnerMembership(found, userId);
    return found;
  }

  const name = (preferredName ?? "").trim() || "Minha Barbearia";
  const baseSlug = await uniqueSlug(name);

  let currentSlug = baseSlug;
  let data: { id: string } | null = null;
  let error: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await supabase
      .from("barbershops")
      .insert({ owner_id: userId, name, slug: currentSlug, onboarding_done: true })
      .select("id")
      .maybeSingle();

    data = res.data;
    error = res.error;

    if (!error && data) break;

    const isConflict =
      error &&
      (error.code === "23505" ||
        /slug/i.test(error.message) ||
        /duplicate|unique|already exists/i.test(error.message));

    if (isConflict) {
      currentSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      continue;
    }
    break;
  }

  if (error || !data) {
    console.error("[ensureShopId] Error creating barbershop:", error);
    throw error ?? new Error("Não foi possível criar a barbearia.");
  }

  await ensureOwnerMembership(data.id, userId);

  try {
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
  } catch (e) {
    console.warn("[ensureShopId] Business hours error:", e);
  }

  try {
    await seedStarterData(data.id);
  } catch {
    // Dados de exemplo são opcionais: nunca bloqueiam a criação da barbearia.
  }

  return data.id;
}
