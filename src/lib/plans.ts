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
      "Ciclo mensal do dia 05 ao dia 05",
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
      "Ciclo mensal com início no dia 05",
      "Tolerância de pagamento até o dia 15",
      "Adesões após o dia 15 iniciam no próximo ciclo sem taxas",
      "Todos os recursos do plano Grátis",
      "Relatórios financeiros avançados",
      "Prioridade no suporte técnico",
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
  nextBillingDate: string | null;
  toleranceDate: string;
  isAfterDay15: boolean;
  isInTolerance: boolean;
  completedCount: number;
  limitAppointments: number | null;
  isLimitReached: boolean;
  percentageUsed: number;
  subscription: any;
}

/**
 * Calcula as datas do ciclo com base na regra de negócio:
 * 1. O ciclo começa no dia 5 de cada mês e vai até o dia 5 do mês seguinte.
 * 2. Tolerância de pagamento de até o dia 15.
 * 3. Se o plano for escolhido APÓS o dia 15 (dia 16 em diante):
 *    O plano é ativado imediatamente, e o ciclo de cobrança começa formalmente
 *    no PRÓXIMO ciclo (dia 5 do próximo mês) SEM TAXAS adicionais pelo período restante.
 */
export function calculateCycleInfo(referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const isAfterDay15 = day > 15;
  let cycleStart: Date;
  let cycleEnd: Date;
  let nextBillingDate: Date;
  let toleranceDate: Date;

  if (isAfterDay15) {
    // Escolha após o dia 15:
    // Começa a usufruir imediatamente sem taxas.
    // O próximo ciclo oficial de cobrança começa no dia 5 do PRÓXIMO mês.
    cycleStart = new Date(year, month, 5, 0, 0, 0); // para contagem de agendamentos
    cycleEnd = new Date(year, month + 1, 5, 0, 0, 0); // virada no próximo dia 5
    nextBillingDate = new Date(year, month + 1, 5, 12, 0, 0); // cobrança dia 5 do próximo mês
    toleranceDate = new Date(year, month + 1, 15, 23, 59, 59); // tolerância até dia 15 do próximo mês
  } else if (day < 5) {
    // Dias 1 a 4: ciclo que começou no dia 5 do mês anterior
    cycleStart = new Date(year, month - 1, 5, 0, 0, 0);
    cycleEnd = new Date(year, month, 5, 0, 0, 0);
    nextBillingDate = new Date(year, month, 5, 12, 0, 0);
    toleranceDate = new Date(year, month, 15, 23, 59, 59);
  } else {
    // Dias 5 a 15: ciclo começou no dia 5 deste mês e tolerância ativa até o dia 15
    cycleStart = new Date(year, month, 5, 0, 0, 0);
    cycleEnd = new Date(year, month + 1, 5, 0, 0, 0);
    nextBillingDate = new Date(year, month, 5, 12, 0, 0);
    toleranceDate = new Date(year, month, 15, 23, 59, 59);
  }

  // Tolerância está ativa se estamos entre o dia 5 e o dia 15 do mês corrente
  const isInTolerance = day >= 5 && day <= 15;

  return {
    cycleStart,
    cycleEnd,
    nextBillingDate,
    toleranceDate,
    isAfterDay15,
    isInTolerance,
  };
}

/**
 * Salva a escolha do plano para a barbearia seguindo as regras:
 * - Ciclo começa no dia 5
 * - Tolerância de até no dia 15
 * - Se escolher após o dia 15, começa no próximo ciclo sem cobrança de taxas no período atual
 */
export async function saveBarbershopPlan(
  barbershopId: string,
  planType: PlanType,
): Promise<{ ok: boolean; plan: PlanType; subscription: any; isAfterDay15: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  const now = new Date();
  const cycle = calculateCycleInfo(now);
  const monthlyAmount = planType === "premium" ? 49.9 : 0;

  const payload = {
    barbershop_id: barbershopId,
    user_id: userId,
    mercadopago_plan_id: planType,
    monthly_amount: monthlyAmount,
    status: "active",
    current_period_start: cycle.cycleStart.toISOString(),
    current_period_end: cycle.cycleEnd.toISOString(),
    next_payment_date: planType === "premium" ? cycle.nextBillingDate.toISOString() : null,
    grace_until: cycle.toleranceDate.toISOString(),
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

  return { ok: true, plan: planType, subscription: data, isAfterDay15: cycle.isAfterDay15 };
}

/**
 * Consulta os detalhes do plano atual, ciclo (dia 5 a dia 5), tolerância (até dia 15)
 * e a quantidade de agendamentos EXCLUSIVAMENTE com status "CONCLUÍDO" ('done' ou 'completed').
 * Agendamentos cancelados, pendentes, futuros ou não concluídos NÃO são contabilizados.
 */
export async function getBarbershopPlanInfo(
  barbershopId: string,
): Promise<BarbershopPlanInfo> {
  const now = new Date();
  const cycle = calculateCycleInfo(now);

  // 1. Busca a assinatura da barbearia
  const { data: sub } = await (supabase as any)
    .from("subscriptions")
    .select("*")
    .eq("barbershop_id", barbershopId)
    .maybeSingle();

  const planType: PlanType = sub?.mercadopago_plan_id === "premium" ? "premium" : "free";
  const plan = PLANS[planType];

  // 2. Determina o ciclo vigente (dia 5 ao dia 5 do mês seguinte)
  const cycleStart = sub?.current_period_start
    ? new Date(sub.current_period_start)
    : cycle.cycleStart;
  const cycleEnd = sub?.current_period_end
    ? new Date(sub.current_period_end)
    : cycle.cycleEnd;

  const daysLeft = Math.max(
    0,
    Math.ceil((cycleEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  // 3. Contabilização EXCLUSIVA de agendamentos CONCLUÍDOS no ciclo
  // Status válidos para conclusão: "done" ou "completed"
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
    nextBillingDate: sub?.next_payment_date ?? cycle.nextBillingDate.toISOString(),
    toleranceDate: sub?.grace_until ?? cycle.toleranceDate.toISOString(),
    isAfterDay15: cycle.isAfterDay15,
    isInTolerance: cycle.isInTolerance,
    completedCount,
    limitAppointments: plan.limitAppointments,
    isLimitReached,
    percentageUsed,
    subscription: sub,
  };
}
