import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclusão definitiva da conta do usuário autenticado (requisito Google Play).
 *
 * Remove, nesta ordem:
 *  1. Barbearias das quais o usuário é dono — o banco apaga em cascata
 *     agenda, clientes, serviços, profissionais, assinaturas, pagamentos,
 *     horários, campanhas e logs vinculados.
 *  2. Vínculos como membro de outras barbearias e inscrições de notificação.
 *  3. Perfil e a própria conta de acesso (e-mail/Google).
 *
 * Só o próprio usuário pode executar (token validado pelo middleware).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => {
    if (input?.confirmation !== "EXCLUIR") {
      throw new Error("Digite EXCLUIR para confirmar a exclusão da conta.");
    }
    return input;
  })
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Barbearias do usuário (cascata cobre as tabelas dependentes)
    const { error: shopsErr } = await supabaseAdmin
      .from("barbershops")
      .delete()
      .eq("owner_id", userId);
    if (shopsErr) throw new Error("Não foi possível remover os dados da barbearia.");

    // 2. Vínculos e notificações
    await supabaseAdmin.from("barbershop_members").delete().eq("user_id", userId);
    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", userId);

    // 3. Perfil e conta de acesso
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error("Não foi possível concluir a exclusão da conta.");

    return { ok: true as const };
  });

/** Resumo do que será apagado — usado na tela de confirmação. */
export const getMyDataSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId as string;
    const { supabase } = context;

    const { data: shops } = await supabase
      .from("barbershops")
      .select("id, name")
      .eq("owner_id", userId);
    const ids = (shops ?? []).map((s) => s.id);

    let customers = 0;
    let appointments = 0;
    if (ids.length) {
      const [{ count: c }, { count: a }] = await Promise.all([
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .in("barbershop_id", ids),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("barbershop_id", ids),
      ]);
      customers = c ?? 0;
      appointments = a ?? 0;
    }

    return {
      shops: (shops ?? []).map((s) => s.name),
      customers,
      appointments,
    };
  });
