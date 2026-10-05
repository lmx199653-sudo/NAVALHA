import { supabase } from "@/integrations/supabase/client";

export type PlanType = "free" | "premium";

export interface PlanConfig {
  id: PlanType;
  name: string;
  badge?: string;
  price: number;
  priceLabel: string;
  periodLabel: string;
  limitAppointments: number | null;
  description: string;
  features: string[];
  cta: string;
  recommended: boolean;
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    id: "free",
    name: "PLANO 1 — GRÁTIS",
    badge: "Básico",
    price: 0,
    priceLabel: "R$ 0",
    periodLabel: "/mês",
    limitAppointments: 100,
    description: "Ideal para barbearias começando com volume de até 100 agendamentos por mês.",
    features: [
      "Até 100 agendamentos concluídos por mês",
      "Controle completo de agenda e horários",
      "Cadastro de clientes, barbeiros e serviços",
      "Página pública de agendamento online",
      "Avisos e lembretes via WhatsApp",
      "Sem taxa de adesão ou mensalidade",
    ],
    cta: "Escolher plano",
    recommended: false,
  },
  premium: {
    id: "premium",
    name: "PLANO 2 — PREMIUM",
    badge: "RECOMENDADO",
    price: 49.9,
    priceLabel: "R$ 49,90",
    periodLabel: "/mês",
    limitAppointments: null, // ilimitado
    description: "Para barbearias em expansão que precisam de agendamentos ilimitados.",
    features: [
      "Agendamentos concluídos ilimitados",
      "Todos os recursos do plano Grátis",
      "Ciclo de 30 dias (sem cobrança imediata)",
      "Relatórios financeiros avançados",
      "Prioridade no suporte técnico",
      "Crescimento sem interrupções",
    ],
    cta: "Escolher plano",
    recommended: true,
  },
};

export interface BarbershopPlanInfo {
  planType: PlanType;
  plan: PlanConfig;
  status: string;
  cycleStart: string;
  cycleEnd: string;
  daysLeft: number;
  completedCount: number;
  limitAppointments: number | null;
  isLimitReached: boolean;
  percentageUsed: number;
  subscription: any;
}

/**
 * Salva a escolha do plano para a barbearia e inicia o ciclo de 30 dias.
 * Regra: Não realiza cobrança imediata ao escolher o plano.
 */
export async function saveBarbershopPlan(
  barbershopId: string,
  planType: PlanType,
): Promise<{ ok: boolean; plan: PlanType; subscription: any }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  const now = new Date();
  // Inicia o ciclo de 30 dias a partir deste momento
  const cycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthlyAmount = planType === "premium" ? 49.9 : 0;

  const payload = {
    barbershop_id: barbershopId,
    user_id: userId,
    mercadopago_plan_id: planType,
    monthly_amount: monthlyAmount,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: cycleEnd.toISOString(),
    next_payment_date: planType === "premium" ? cycleEnd.toISOString() : null,
    last_payment_status: "approved",
    updated_at: now.toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .upsert(payload, { onConflict: "barbershop_id" })
    .select()
    .single();

  if (error) {
    console.error("[saveBarbershopPlan] Erro ao salvar plano na tabela subscriptions:", error);
    throw new Error("Não foi possível salvar o plano. Tente novamente.");
  }

  return { ok: true, plan: planType, subscription: data };
}

/**
 * Consulta os detalhes do plano atual, ciclo de 30 dias e a quantidade
 * de agendamentos EXCLUSIVAMENTE com status "CONCLUÍDO" ('done' ou 'completed').
 * Agendamentos cancelados, pendentes, futuros ou não concluídos NÃO são contabilizados.
 */
export async function getBarbershopPlanInfo(
  barbershopId: string,
): Promise<BarbershopPlanInfo> {
  const now = new Date();

  // 1. Busca a assinatura da barbearia
  const { data: sub } = await (supabase as any)
    .from("subscriptions")
    .select("*")
    .eq("barbershop_id", barbershopId)
    .maybeSingle();

  const planType: PlanType = sub?.mercadopago_plan_id === "premium" ? "premium" : "free";
  const plan = PLANS[planType];

  // 2. Determina o ciclo de 30 dias
  let cycleStart = sub?.current_period_start
    ? new Date(sub.current_period_start)
    : new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  let cycleEnd = sub?.current_period_end
    ? new Date(sub.current_period_end)
    : new Date(cycleStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Se o ciclo já expirou, projeta a renovação do período
  if (now > cycleEnd && sub?.current_period_end) {
    cycleStart = new Date(sub.current_period_end);
    cycleEnd = new Date(cycleStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const daysLeft = Math.max(
    0,
    Math.ceil((cycleEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  // 3. Contabilização EXCLUSIVA de agendamentos CONCLUÍDOS no ciclo atual
  // Status válidos para conclusão: "done" (padrão do app) ou "completed"
  const { count, error: countErr } = await (supabase as any)
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId)
    .in("status", ["done", "completed"])
    .gte("starts_at", cycleStart.toISOString())
    .lte("starts_at", cycleEnd.toISOString());

  if (countErr) {
    console.warn("[getBarbershopPlanInfo] Erro ao contar agendamentos:", countErr);
  }

  const completedCount = count ?? 0;
  const isLimitReached = planType === "free" && completedCount >= 100;
  const percentageUsed = planType === "free" ? Math.min(100, Math.round((completedCount / 100) * 100)) : 0;

  return {
    planType,
    plan,
    status: sub?.status ?? "active",
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    daysLeft,
    completedCount,
    limitAppointments: plan.limitAppointments,
    isLimitReached,
    percentageUsed,
    subscription: sub,
  };
}
