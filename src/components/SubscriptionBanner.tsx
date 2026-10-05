import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Lock, ShieldAlert, ArrowRight, Sparkles } from "lucide-react";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { useShop } from "@/hooks/useShop";
import { getBarbershopPlanInfo } from "@/lib/plans";
import { Button } from "@/components/ui/button";

export function SubscriptionBanner() {
  const { access, status, inGracePeriod, daysUntilRestriction, daysUntilSuspension } =
    useSubscriptionAccess();
  const { data: shop } = useShop();

  const planInfoQuery = useQuery({
    queryKey: ["barbershop-plan-info", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getBarbershopPlanInfo(shop!.id),
    staleTime: 15_000,
  });

  const planInfo = planInfoQuery.data;

  // Aviso especial: Limite de 100 agendamentos concluídos atingido no plano Grátis
  if (planInfo?.isLimitReached) {
    return (
      <div className="relative z-40 bg-rose-500/20 border-b border-rose-500/40 text-rose-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-400" />
          <span>
            <strong>Limite de 100 agendamentos atingido:</strong> Você concluiu 100 agendamentos este mês no Plano Grátis.
            Faça upgrade para o <strong>Plano Premium (R$ 49,90/mês)</strong> para agendamentos ilimitados.
          </span>
        </div>
        <Link to="/cobranca">
          <Button
            size="sm"
            className="h-7 px-3 text-xs font-semibold bg-primary hover:bg-primary/90 text-black shadow-sm gap-1"
          >
            <Sparkles className="size-3" />
            Fazer Upgrade
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  // Se o acesso estiver 100% normal e ativo, não exibe banner
  if (access === "full" && status !== "payment_pending") {
    return null;
  }

  // 1. Dias 6 e 7: Pagamento pendente (tolerância)
  if (status === "payment_pending" || inGracePeriod) {
    const restMsg =
      daysUntilRestriction && daysUntilRestriction > 0
        ? `Bloqueio de novos agendamentos em ${daysUntilRestriction} dia(s).`
        : "Bloqueio de novos agendamentos iminente.";

    return (
      <div className="relative z-40 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-400" />
          <span>
            <strong>Aviso de cobrança:</strong> Seu pagamento está pendente. Regularize para manter seu acesso.{" "}
            <span className="text-amber-300/80 hidden md:inline">({restMsg})</span>
          </span>
        </div>
        <Link to="/cobranca">
          <Button
            size="sm"
            className="h-7 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black shadow-sm"
          >
            Regularizar pagamento
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  // 2. Dia 8: Acesso Restrito
  if (access === "restricted") {
    const suspMsg =
      daysUntilSuspension && daysUntilSuspension > 0
        ? `Suspensão total do sistema em ${daysUntilSuspension} dia(s).`
        : "Suspensão total iminente.";

    return (
      <div className="relative z-40 bg-orange-500/15 border-b border-orange-500/30 text-orange-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-orange-400" />
          <span>
            <strong>Acesso Restrito:</strong> Criação de novos agendamentos e cadastros bloqueada. Regularize para restabelecer o acesso completo.{" "}
            <span className="text-orange-300/80 hidden md:inline">({suspMsg})</span>
          </span>
        </div>
        <Link to="/cobranca">
          <Button
            size="sm"
            className="h-7 px-3 text-xs font-semibold bg-orange-500 hover:bg-orange-400 text-black shadow-sm"
          >
            Regularizar pagamento
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  // 3. Dia 10+: Acesso Suspenso
  if (access === "suspended") {
    return (
      <div className="relative z-40 bg-rose-500/20 border-b border-rose-500/40 text-rose-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm animate-pulse">
        <div className="flex items-center gap-2">
          <Lock className="size-4 shrink-0 text-rose-400" />
          <span>
            <strong>Acesso Suspenso:</strong> O uso do sistema está suspenso por pendência na assinatura. Seus dados e clientes estão 100% seguros.
          </span>
        </div>
        <Link to="/cobranca">
          <Button
            size="sm"
            className="h-7 px-3 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white shadow-sm"
          >
            Regularizar agora
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}
