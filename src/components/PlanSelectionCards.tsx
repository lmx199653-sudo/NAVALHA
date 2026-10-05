import { Check, Sparkles, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, type PlanType } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface PlanSelectionCardsProps {
  onSelectPlan: (plan: PlanType) => void;
  currentPlan?: PlanType | null;
  loadingPlan?: PlanType | null;
  className?: string;
  hideCurrentBadge?: boolean;
}

export function PlanSelectionCards({
  onSelectPlan,
  currentPlan,
  loadingPlan,
  className,
  hideCurrentBadge = false,
}: PlanSelectionCardsProps) {
  const freePlan = PLANS.free;
  const premiumPlan = PLANS.premium;

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch", className)}>
      {/* ============================================================ */}
      {/* PLANO 1 — GRÁTIS                                             */}
      {/* ============================================================ */}
      <div
        className={cn(
          "surface-card relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200",
          currentPlan === "free" && !hideCurrentBadge
            ? "border-primary/50 bg-secondary/30 ring-1 ring-primary/30"
            : "border-border/80 hover:border-border hover:bg-secondary/20",
        )}
      >
        <div>
          {/* Header do Card */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {freePlan.name}
            </span>
            {currentPlan === "free" && !hideCurrentBadge && (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px]">
                Plano Atual
              </Badge>
            )}
          </div>

          {/* Preço */}
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              {freePlan.priceLabel}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {freePlan.periodLabel}
            </span>
          </div>

          <p className="text-sm font-medium text-emerald-400 mb-5 flex items-center gap-1.5">
            <Zap className="size-4 shrink-0" />
            Até 100 agendamentos concluídos por mês
          </p>

          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            {freePlan.description}
          </p>

          {/* Lista de Recursos */}
          <div className="space-y-3 pt-4 border-t border-border/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              O que está incluso:
            </p>
            <ul className="space-y-2.5">
              {freePlan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90">
                  <span className="size-4 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="size-3" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Botão de Ação */}
        <div className="pt-6 mt-6 border-t border-border/60">
          <Button
            type="button"
            variant={currentPlan === "free" ? "secondary" : "outline"}
            className="w-full h-11 text-sm font-semibold transition-all"
            disabled={loadingPlan !== null || (currentPlan === "free" && !hideCurrentBadge)}
            onClick={() => onSelectPlan("free")}
          >
            {loadingPlan === "free"
              ? "Ativando plano..."
              : currentPlan === "free" && !hideCurrentBadge
              ? "Plano selecionado"
              : freePlan.cta}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-2">
            Sem custos · Inicia ciclo de 30 dias
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PLANO 2 — PREMIUM (DESTAQUE VISUAL RECOMENDADO)               */}
      {/* ============================================================ */}
      <div
        className={cn(
          "surface-card relative flex flex-col justify-between rounded-2xl border-2 p-6 transition-all duration-200 overflow-hidden",
          "border-primary/80 bg-gradient-to-b from-primary/10 via-secondary/30 to-secondary/15 ring-2 ring-primary/40 shadow-xl shadow-primary/10",
        )}
      >
        {/* Glow de fundo */}
        <div className="absolute -top-12 -right-12 size-36 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

        <div>
          {/* Badge Recomendado */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              {premiumPlan.name}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-primary text-black shadow-sm">
              ★ RECOMENDADO
            </span>
          </div>

          {/* Preço */}
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-primary">
              {premiumPlan.priceLabel}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {premiumPlan.periodLabel}
            </span>
          </div>

          <p className="text-sm font-semibold text-primary mb-5 flex items-center gap-1.5">
            <Zap className="size-4 shrink-0 fill-primary" />
            Agendamentos concluídos ilimitados
          </p>

          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            {premiumPlan.description}
          </p>

          {/* Lista de Recursos */}
          <div className="space-y-3 pt-4 border-t border-primary/20">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
              Vantagens exclusivas do Premium:
            </p>
            <ul className="space-y-2.5">
              {premiumPlan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground font-medium">
                  <span className="size-4 rounded-full bg-primary/25 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="size-3 stroke-[2.5]" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Botão de Ação */}
        <div className="pt-6 mt-6 border-t border-primary/20">
          <Button
            type="button"
            className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20 transition-all gap-1.5"
            disabled={loadingPlan !== null || (currentPlan === "premium" && !hideCurrentBadge)}
            onClick={() => onSelectPlan("premium")}
          >
            {loadingPlan === "premium" ? (
              "Ativando plano..."
            ) : currentPlan === "premium" && !hideCurrentBadge ? (
              "Plano ativo"
            ) : (
              <>
                {premiumPlan.cta}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <p className="text-[11px] text-center text-primary/80 font-medium mt-2">
            Não cobra nada agora · Ciclo de 30 dias
          </p>
        </div>
      </div>
    </div>
  );
}
