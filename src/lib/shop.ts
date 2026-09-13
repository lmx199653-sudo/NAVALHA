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

export const SEM_LOGIN_MESSAGE = "Entre na sua conta para criar e salvar os dados da barbearia.";

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function existingShopId(userId: string) {
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

  const name = (preferredName ?? "").trim() || "Minha barbearia";
  const slug = await uniqueSlug(name);

  const { data, error } = await supabase
    .from("barbershops")
    .insert({ owner_id: userId, name, slug })
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
