import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CreditCard,
  RefreshCw,
  Clock,
  ShieldAlert,
  Lock,
  Calendar,
  Receipt,
  Sparkles,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Info,
  ArrowRight,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, ErrorState } from "@/components/ui/states";
import { useShop } from "@/hooks/useShop";
import { useIsSupport } from "@/hooks/useSupport";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import {
  createOrGetMercadoPagoSubscription,
  fetchAllSubscriptionsAdmin,
} from "@/lib/mercadopago.functions";
import { MP_STATUS_INFO, type SubscriptionStatus } from "@/lib/mercadopago";
import {
  getBarbershopPlanInfo,
  saveBarbershopPlan,
  PLANS,
  type PlanType,
} from "@/lib/plans";
import { PlanSelectionCards } from "@/components/PlanSelectionCards";
import { brl, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cobranca")({
  component: MeuPlanoPage,
});

function MeuPlanoPage() {
  const { data: shop } = useShop();
  const { data: isSupport } = useIsSupport();
  const qc = useQueryClient();

  const {
    status,
    subscription,
    refetch: refetchAccess,
  } = useSubscriptionAccess();

  // Consulta detalhes do plano, ciclo de 30 dias e contagem de agendamentos CONCLUÍDOS
  const planInfoQuery = useQuery({
    queryKey: ["barbershop-plan-info", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getBarbershopPlanInfo(shop!.id),
    staleTime: 10_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ["subscription-invoices", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_invoices")
        .select("*")
        .eq("barbershop_id", shop!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const adminSubsQuery = useQuery({
    queryKey: ["admin-all-subscriptions"],
    enabled: !!isSupport,
    queryFn: async () => {
      return await fetchAllSubscriptionsAdmin();
    },
  });

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [switchingPlan, setSwitchingPlan] = useState<PlanType | null>(null);

  const statusMeta =
    MP_STATUS_INFO[status as SubscriptionStatus] || MP_STATUS_INFO.active;

  const planInfo = planInfoQuery.data;
  const currentPlanType: PlanType = planInfo?.planType ?? (subscription?.mercadopago_plan_id === "premium" ? "premium" : "free");
  const isPremium = currentPlanType === "premium";

  // Troca de plano limpa e direta: salva na conta, inicia ciclo de 30 dias sem cobrança imediata
  async function handleSelectPlan(chosenPlan: PlanType) {
    if (!shop?.id) {
      toast.error("Barbearia não selecionada.");
      return;
    }
    setSwitchingPlan(chosenPlan);
    try {
      await saveBarbershopPlan(shop.id, chosenPlan);
      await qc.invalidateQueries({ queryKey: ["barbershop-plan-info", shop.id] });
      await qc.invalidateQueries({ queryKey: ["subscription-access", shop.id] });
      refetchAccess();
      toast.success(
        chosenPlan === "premium"
          ? "Plano Premium selecionado! Ciclo de 30 dias iniciado."
          : "Plano Grátis ativado com sucesso!",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar o plano escolhido.");
    } finally {
      setSwitchingPlan(null);
    }
  }

  async function handleStartMercadoPago() {
    if (!shop?.id) {
      toast.error("Barbearia não selecionada.");
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await createOrGetMercadoPagoSubscription({
        data: {
          barbershopId: shop.id,
          backUrl: `${window.location.origin}/cobranca?status=approved`,
        },
      });

      if (res.initPoint) {
        toast.success("Abrindo ambiente seguro do Mercado Pago...");
        window.location.href = res.initPoint;
      } else {
        toast.info("Assinatura identificada.");
        refetchAccess();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao conectar com o Mercado Pago.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <AppShell
      title="Meu Plano"
      subtitle="Gerencie seu plano, ciclo de faturamento e agendamentos concluídos"
      action={
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("border font-medium px-3 py-1 text-xs shadow-sm", statusMeta.badgeCls)}
          >
            {isPremium ? "Plano Premium" : "Plano Grátis"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-neutral-400 hover:text-white border-white/10"
            onClick={() => {
              refetchAccess();
              planInfoQuery.refetch();
              invoicesQuery.refetch();
              toast.info("Dados atualizados.");
            }}
          >
            <RefreshCw className="size-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="plano" className="w-full">
        {isSupport && (
          <TabsList className="mb-6 grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="plano">Meu Plano</TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <span>Admin</span>
              {adminSubsQuery.data && (
                <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                  {adminSubsQuery.data.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        )}

        {/* TAB 1: MEU PLANO */}
        <TabsContent value="plano" className="space-y-6 mt-0">
          {/* ALERTA: LIMITE DE 100 AGENDAMENTOS CONCLUÍDOS ATINGIDO NO PLANO GRÁTIS */}
          {planInfo?.isLimitReached && (
            <div className="rounded-2xl border-2 border-rose-500/50 bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-rose-950/20">
              <div className="flex items-start gap-3.5">
                <div className="size-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="size-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Limite de 100 agendamentos concluídos atingido no mês!
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-2xl leading-relaxed">
                    Você atingiu o teto de 100 atendimentos concluídos do Plano Grátis neste ciclo.
                    Faça upgrade para o <strong>Plano Premium (R$ 49,90/mês)</strong> para agendamentos ilimitados e continuar atendendo sem barreiras.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleSelectPlan("premium")}
                disabled={switchingPlan !== null}
                className="bg-primary hover:bg-primary/90 text-black font-bold text-sm h-11 px-5 shrink-0 shadow-lg shadow-primary/25 gap-1.5"
              >
                <Sparkles className="size-4" />
                Fazer Upgrade para Premium
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {/* 4 CARDS DE INDICADORES / KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Plano Atual */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className={cn(
                "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                isPremium
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              )}>
                {isPremium ? <Sparkles className="size-5" /> : <Zap className="size-5" />}
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Plano Atual
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  {isPremium ? "Plano 2 — Premium" : "Plano 1 — Grátis"}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {isPremium ? "R$ 49,90/mês" : "R$ 0 · Grátis"}
                </span>
              </div>
            </div>

            {/* Card 2: Ciclo Vigente de 30 Dias */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="size-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                <Calendar className="size-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Ciclo de 30 Dias
                </span>
                <span className="text-sm font-bold text-white">
                  {planInfo ? `${planInfo.daysLeft} dias restantes` : "Ciclo em andamento"}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {planInfo?.cycleEnd ? `Renovação: ${dateLabel(planInfo.cycleEnd)}` : "30 dias"}
                </span>
              </div>
            </div>

            {/* Card 3: Agendamentos Concluídos no Mês */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className={cn(
                "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                planInfo?.isLimitReached
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              )}>
                <Check className="size-5" />
              </div>
              <div className="w-full min-w-0">
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Agendamentos Concluídos
                </span>
                <span className="text-sm font-bold text-white">
                  {planInfo ? (
                    isPremium ? (
                      `${planInfo.completedCount} (Ilimitados)`
                    ) : (
                      `${planInfo.completedCount} / 100`
                    )
                  ) : (
                    "0"
                  )}
                </span>
                {/* Barra de progresso para o plano Grátis */}
                {!isPremium && (
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        planInfo?.isLimitReached
                          ? "bg-rose-500"
                          : (planInfo?.percentageUsed ?? 0) > 80
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                      )}
                      style={{ width: `${planInfo?.percentageUsed ?? 0}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Status do Acesso */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="size-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Status da Conta
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  Ativa e Regular
                </span>
                <span className="text-[11px] text-neutral-400">
                  {isPremium ? "Cobrança mensal no ciclo" : "Sem cobranças"}
                </span>
              </div>
            </div>
          </div>

          {/* NOTA DE CONTABILIZAÇÃO EXCLUSIVA DE AGENDAMENTOS CONCLUÍDOS */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 flex items-start gap-3 text-xs text-neutral-300">
            <Info className="size-4 shrink-0 text-primary mt-0.5" />
            <span>
              <strong>Regra de contabilização transparente:</strong> Apenas agendamentos com status{" "}
              <strong className="text-white">CONCLUÍDO</strong> são somados ao volume do ciclo.
              Agendamentos cancelados, pendentes, futuros ou com falta do cliente <strong>não são contabilizados nem geram cobrança</strong>.
            </span>
          </div>

          {/* SEÇÃO PRINCIPAL: ESCOLHA E ALTERNÂNCIA DE PLANOS (LADO A LADO) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">Planos Disponíveis</h2>
                <p className="text-xs text-neutral-400">
                  Alterne seu plano a qualquer momento clicando em "Escolher plano". Não realizamos cobrança imediata.
                </p>
              </div>
            </div>

            {/* CARDS COMPARATIVOS DOS 2 PLANOS LADO A LADO COM DESTAQUE VISUAL */}
            <PlanSelectionCards
              currentPlan={currentPlanType}
              loadingPlan={switchingPlan}
              onSelectPlan={handleSelectPlan}
            />
          </div>

          {/* SEÇÃO COMPLEMENTAR: ASSINATURA MERCADO PAGO (PARA PAGAMENTO DO PREMIUM AO FIM DO CICLO) */}
          {isPremium && (
            <div className="surface-card border-white/5 p-6 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard className="size-4 text-amber-400" />
                    Ambiente de Pagamento Mercado Pago
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                    Configure a autorização de pagamento recorrente para o ciclo de R$ 49,90/mês.
                    O Mercado Pago gerencia sua recorrência de forma segura.
                  </p>
                </div>
                <Button
                  onClick={handleStartMercadoPago}
                  disabled={checkoutLoading}
                  variant="outline"
                  className="h-10 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0 gap-2"
                >
                  {checkoutLoading ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <CreditCard className="size-3.5" />
                  )}
                  Abrir Checkout Mercado Pago
                </Button>
              </div>
            </div>
          )}

          {/* HISTÓRICO DE RECIBOS E FATURAS */}
          <div className="surface-card border-white/5 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="size-4 text-amber-400" />
                  Histórico de Recibos
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Comprovantes e faturas emitidas pelo Mercado Pago para a sua barbearia.
                </p>
              </div>
            </div>

            {invoicesQuery.isLoading ? (
              <CardSkeleton count={2} />
            ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
              <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden bg-white/[0.01]">
                {invoicesQuery.data.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">
                          {inv.billing_type === "pro_rata"
                            ? "Adesão Proporcional (Pro-rata)"
                            : "Mensalidade NAVALHA PRO"}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] py-0 font-medium",
                            inv.status === "approved"
                              ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                              : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                          )}
                        >
                          {inv.status === "approved" ? "Pago" : "Processando"}
                        </Badge>
                      </div>
                      <div className="text-neutral-400 text-[11px] flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Data: {dateLabel(inv.date_approved || inv.created_at)}</span>
                        {inv.mp_payment_id && <span>Transação: #{inv.mp_payment_id}</span>}
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-white font-bold text-sm block">
                        {brl(Math.round(Number(inv.amount) * 100))}
                      </span>
                      <span className="text-[11px] text-neutral-500">Cartão de Crédito</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-6 text-center text-xs text-neutral-400 space-y-1">
                <Receipt className="size-8 mx-auto text-neutral-600 mb-2" />
                <p className="font-medium text-neutral-300">Nenhum recibo emitido ainda</p>
                <p className="text-neutral-500">
                  Os comprovantes de pagamentos processados aparecerão aqui ao final de cada ciclo.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: VISÃO ADMINISTRATIVA (EQUIPE NAVALHA PRO) */}
        {isSupport && (
          <TabsContent value="admin" className="space-y-6 mt-0">
            <div className="surface-card border-white/5 p-6 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Todas as Assinaturas</h3>
                  <p className="text-xs text-neutral-400">
                    Acompanhamento de assinaturas ativas e pendentes no Mercado Pago.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "all", label: "Todas" },
                    { id: "active", label: "Ativas" },
                    { id: "payment_pending", label: "Pendentes" },
                    { id: "restricted", label: "Restritas" },
                    { id: "suspended", label: "Suspensas" },
                  ].map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={adminFilter === f.id ? "default" : "outline"}
                      className={cn(
                        "h-8 text-xs",
                        adminFilter === f.id
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "border-white/10 text-neutral-300 hover:text-white"
                      )}
                      onClick={() => setAdminFilter(f.id)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              {adminSubsQuery.isLoading ? (
                <CardSkeleton count={3} />
              ) : adminSubsQuery.isError ? (
                <ErrorState onRetry={() => adminSubsQuery.refetch()} />
              ) : (
                <div className="space-y-2.5">
                  {(() => {
                    const list = (adminSubsQuery.data ?? []).filter((s: any) =>
                      adminFilter === "all" ? true : s.status === adminFilter,
                    );

                    if (list.length === 0) {
                      return (
                        <p className="text-sm text-neutral-400 py-6 text-center">
                          Nenhuma assinatura encontrada.
                        </p>
                      );
                    }

                    return list.map((sub: any) => {
                      const meta =
                        MP_STATUS_INFO[sub.status as SubscriptionStatus] ||
                        MP_STATUS_INFO.active;

                      return (
                        <div
                          key={sub.id}
                          className="surface-card border-white/5 bg-white/[0.01] p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {sub.barbershops?.name || "Barbearia"}
                              </span>
                              <Badge variant="outline" className={cn("text-[10px] py-0", meta.badgeCls)}>
                                {meta.label}
                              </Badge>
                            </div>
                            <span className="text-neutral-500 font-mono text-[11px] block mt-0.5">
                              ID MP: {sub.mercadopago_preapproval_id || "Nenhum"}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-neutral-300">
                            <span>{brl(Math.round(Number(sub.monthly_amount || 49.9) * 100))}/mês</span>
                            <span className="text-neutral-500">
                              {sub.next_payment_date ? dateLabel(sub.next_payment_date) : "Dia 5"}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </AppShell>
  );
}
