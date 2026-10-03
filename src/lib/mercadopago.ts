export type SubscriptionStatus =
  | "active"
  | "payment_pending"
  | "restricted"
  | "suspended"
  | "cancelled";

export type SubscriptionData = {
  id: string;
  barbershop_id: string;
  user_id: string;
  mercadopago_preapproval_id: string | null;
  mercadopago_plan_id: string | null;
  status: SubscriptionStatus;
  monthly_amount: number;
  current_period_start: string | null;
  current_period_end: string | null;
  next_payment_date: string | null;
  last_payment_date: string | null;
  last_payment_status: string | null;
  payment_failed_at: string | null;
  grace_until: string | null;
  restricted_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
  barbershops?: {
    name: string;
    slug: string;
    phone: string | null;
    whatsapp: string | null;
  };
};

export const MP_STATUS_INFO: Record<
  SubscriptionStatus | "trial" | "no_subscription",
  {
    label: string;
    description: string;
    tone: string;
    badgeCls: string;
  }
> = {
  active: {
    label: "Ativa",
    description: "Assinatura em dia. Acesso completo a todos os recursos.",
    tone: "emerald",
    badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  payment_pending: {
    label: "Pagamento Pendente",
    description: "Cobrança gerada no dia 5. Regularize para evitar bloqueio no dia 8.",
    tone: "amber",
    badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  restricted: {
    label: "Acesso Restrito",
    description: "Acesso restrito desde o dia 8. Criação de novos agendamentos bloqueada.",
    tone: "orange",
    badgeCls: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
  suspended: {
    label: "Acesso Suspenso",
    description: "Sistema suspenso desde o dia 10. Regularize para reativar seu acesso.",
    tone: "rose",
    badgeCls: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  cancelled: {
    label: "Cancelada",
    description: "Assinatura cancelada. Ative um novo plano para voltar a utilizar.",
    tone: "zinc",
    badgeCls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  },
  trial: {
    label: "Degustação Gratuita",
    description: "Período de avaliação de 7 dias liberado para novas barbearias.",
    tone: "sky",
    badgeCls: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
  no_subscription: {
    label: "Sem Assinatura",
    description: "Nenhuma assinatura ativa. Contrate o plano para continuar.",
    tone: "rose",
    badgeCls: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
};
