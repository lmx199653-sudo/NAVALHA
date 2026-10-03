import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  Globe,
  Users,
  TrendingUp,
  Shield,
  ArrowUpRight,
  HelpCircle,
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
import { brl, dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cobranca")({
  component: MeuPlanoPage,
});

function MeuPlanoPage() {
  const { data: shop } = useShop();
  const { data: isSupport } = useIsSupport();

  const {
    status,
    subscription,
    daysUntilRestriction,
    refetch: refetchAccess,
  } = useSubscriptionAccess();

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

  const statusMeta =
    MP_STATUS_INFO[status as SubscriptionStatus] || MP_STATUS_INFO.active;

  async function handleStartSubscription() {
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

  const isPaid = status === "active";
  const monthlyPrice = subscription?.monthly_amount
    ? brl(Math.round(subscription.monthly_amount * 100))
    : "R$ 49,90";

  const nextBilling = subscription?.next_payment_date
    ? dateLabel(subscription.next_payment_date)
    : "Dia 05 do próximo mês";

  return (
    <AppShell
      title="Meu Plano"
      subtitle="Gerencie a assinatura do seu sistema NAVALHA PRO"
      action={
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("border font-medium px-3 py-1 text-xs shadow-sm", statusMeta.badgeCls)}
          >
            {statusMeta.label}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-neutral-400 hover:text-white border-white/10"
            onClick={() => {
              refetchAccess();
              invoicesQuery.refetch();
              toast.info("Status atualizado.");
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

        {/* TAB 1: MEU PLANO (DESIGN PREMIUM, COMPLETO E ORGANIZADO) */}
        <TabsContent value="plano" className="space-y-6 mt-0">
          {/* AVISOS DE STATUS (GRACE PERIOD OU RESTRIÇÃO) */}
          {status === "payment_pending" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm text-amber-200 shadow-lg shadow-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="size-4 text-amber-400" />
                </div>
                <div>
                  <span className="font-semibold block text-amber-300">
                    Aguardando renovação mensal
                  </span>
                  <span className="text-amber-200/80">
                    Sua assinatura está no período de tolerância. Regularize até o dia 8 para manter o sistema liberado.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-9 px-4 shrink-0 shadow-md"
              >
                Pagar agora
              </Button>
            </div>
          )}

          {status === "restricted" && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm text-orange-200 shadow-lg shadow-orange-500/5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-4 text-orange-400" />
                </div>
                <div>
                  <span className="font-semibold block text-orange-300">
                    Acesso restrito para novos agendamentos
                  </span>
                  <span className="text-orange-200/80">
                    Regularize seu pagamento para liberar a agenda e permitir novas marcações imediatamente.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs h-9 px-4 shrink-0 shadow-md"
              >
                Regularizar Plano
              </Button>
            </div>
          )}

          {status === "suspended" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm text-rose-200 shadow-lg shadow-rose-500/5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                  <Lock className="size-4 text-rose-400" />
                </div>
                <div>
                  <span className="font-semibold block text-rose-300">
                    Acesso suspenso
                  </span>
                  <span className="text-rose-200/80">
                    Seus dados e históricos estão 100% preservados. Ative a assinatura para desbloquear o sistema.
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs h-9 px-4 shrink-0 shadow-md"
              >
                Desbloquear Agora
              </Button>
            </div>
          )}

          {/* 4 CARDS DE STATUS / KPIS (VISUAL ELEGANTE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Status Atual */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="size-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Situação
                </span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className={cn(
                    "size-2 rounded-full",
                    isPaid ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  )} />
                  {isPaid ? "Plano Ativo" : statusMeta.label}
                </span>
              </div>
            </div>

            {/* Card 2: Valor */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CreditCard className="size-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Mensalidade
                </span>
                <span className="text-sm font-bold text-white">
                  {monthlyPrice}
                  <span className="text-xs font-normal text-neutral-400">/mês</span>
                </span>
              </div>
            </div>

            {/* Card 3: Vencimento */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Calendar className="size-5 text-blue-400" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Vencimento Fixo
                </span>
                <span className="text-sm font-bold text-white">
                  Todo dia 05
                </span>
              </div>
            </div>

            {/* Card 4: Plataforma Segura */}
            <div className="surface-card border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
              <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="size-5 text-purple-400" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                  Processamento
                </span>
                <span className="text-sm font-bold text-white">
                  Mercado Pago
                </span>
              </div>
            </div>
          </div>

          {/* CARD PRINCIPAL DO PLANO: LUXO, ELEGANTE E COMPLETO */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#15171E] via-[#0E1014] to-[#0A0B0E] p-6 sm:p-8 shadow-2xl">
            {/* Brilho de fundo sutil */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              {/* Lado Esquerdo: Identificação e Ação */}
              <div className="lg:col-span-5 space-y-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
                    <Sparkles className="size-3.5" />
                    <span>Acesso Total e Ilimitado</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
                    NAVALHA PRO
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 leading-relaxed">
                    Sua barbearia no controle total: agendamentos 24h, finanças automatizadas e gestão da equipe.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                      {monthlyPrice}
                    </span>
                    <span className="text-xs text-neutral-400">/mês</span>
                  </div>
                  <p className="text-[11px] text-amber-400/90 leading-tight">
                    Vencimento unificado todo dia 05 com cobrança proporcional na adesão.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleStartSubscription}
                    disabled={checkoutLoading}
                    className="w-full h-12 text-sm font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 hover:from-amber-400 hover:to-amber-200 text-black shadow-lg shadow-amber-500/25 active:scale-98 rounded-xl transition-all"
                  >
                    {checkoutLoading ? (
                      <RefreshCw className="size-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="size-4 mr-2" />
                    )}
                    {isPaid ? "Gerenciar Assinatura no Mercado Pago" : "Ativar Assinatura no Mercado Pago"}
                  </Button>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1 pt-1">
                    <span className="flex items-center gap-1">
                      <Shield className="size-3 text-neutral-400" />
                      Sem fidelidade, cancele quando quiser
                    </span>
                    <span>Próximo ciclo: {nextBilling}</span>
                  </div>
                </div>
              </div>

              {/* Linha Divisória para telas grandes */}
              <div className="hidden lg:block lg:col-span-1 border-r border-white/10 h-full my-auto" />

              {/* Lado Direito: Lista de Benefícios e Recursos Inclusos */}
              <div className="lg:col-span-6 space-y-3.5">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                  Tudo o que está incluído no seu plano:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Agendamentos Ilimitados</span>
                      <span className="text-[11px] text-neutral-400">Sem limite de clientes ou horários marcados</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Globe className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Página Online Própria</span>
                      <span className="text-[11px] text-neutral-400">Link exclusivo para seu cliente agendar 24h</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Barbeiros & Equipe</span>
                      <span className="text-[11px] text-neutral-400">Cadastre todos os profissionais sem taxa extra</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Financeiro & Comissões</span>
                      <span className="text-[11px] text-neutral-400">Cálculo de comissão e fluxo de caixa diário</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Planos dos Clientes</span>
                      <span className="text-[11px] text-neutral-400">Crie planos mensais para fidelizar seus clientes</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
                    <div className="size-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Dados Blindados</span>
                      <span className="text-[11px] text-neutral-400">Backups automáticos e segurança em nuvem</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 text-xs text-neutral-400">
                  <Check className="size-3.5 text-amber-400" />
                  <span>Cobrança automática sem precisar emitir boleto manualmente todo mês.</span>
                </div>
              </div>
            </div>
          </div>

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
                  Assim que sua primeira mensalidade for processada no Mercado Pago, os recibos e comprovantes aparecerão aqui.
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
