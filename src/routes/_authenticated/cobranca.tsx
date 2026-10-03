import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
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
  component: MinhaAssinaturaPage,
});

function MinhaAssinaturaPage() {
  const { data: shop } = useShop();
  const { data: isSupport } = useIsSupport();
  const qc = useQueryClient();

  const {
    access,
    status,
    subscription,
    daysUntilRestriction,
    daysUntilSuspension,
    refetch: refetchAccess,
    isLoading: accessLoading,
  } = useSubscriptionAccess();

  // Histórico de faturas da barbearia
  const invoicesQuery = useQuery({
    queryKey: ["subscription-invoices", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_invoices" as any)
        .select("*")
        .eq("barbershop_id", shop!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Assinaturas para visualização administrativa
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
        toast.success("Redirecionando para o checkout seguro do Mercado Pago...");
        window.location.href = res.initPoint;
      } else {
        toast.info("Assinatura já identificada no sistema.");
        refetchAccess();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao iniciar pagamento no Mercado Pago.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const nextBilling = subscription?.next_payment_date
    ? dateLabel(subscription.next_payment_date)
    : "Dia 5 do próximo mês";

  const lastPayment = subscription?.last_payment_date
    ? dateLabel(subscription.last_payment_date)
    : "Pendente";

  const monthlyPrice = subscription?.monthly_amount
    ? brl(Math.round(subscription.monthly_amount * 100))
    : "R$ 49,90";

  return (
    <AppShell
      title="Minha assinatura"
      subtitle="Ciclo mensal fixo no dia 5 · Mercado Pago recorrente com pro-rata"
      action={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("border font-medium", statusMeta.badgeCls)}>
            {statusMeta.label}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-neutral-300"
            onClick={() => {
              refetchAccess();
              invoicesQuery.refetch();
              toast.info("Status sincronizado.");
            }}
          >
            <RefreshCw className="size-3.5" />
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="minha" className="w-full">
        {isSupport && (
          <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="minha">Minha Assinatura</TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5">
              <span>Admin (Todas)</span>
              {adminSubsQuery.data && (
                <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                  {adminSubsQuery.data.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        )}

        {/* TAB 1: MINHA ASSINATURA */}
        <TabsContent value="minha" className="space-y-6 mt-0">
          {/* Card de Alerta quando houver pendência */}
          {status === "payment_pending" && (
            <div className="surface-card border-amber-500/40 bg-amber-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="size-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-200">Pagamento Pendente</h3>
                  <p className="text-xs sm:text-sm text-amber-300/80 mt-0.5">
                    A cobrança do dia 5 não foi processada. Seu acesso será restringido em{" "}
                    <strong>{daysUntilRestriction ?? "poucos"} dia(s)</strong> (no dia 8).
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-9 shrink-0 shadow-md"
              >
                Regularizar pagamento
              </Button>
            </div>
          )}

          {status === "restricted" && (
            <div className="surface-card border-orange-500/40 bg-orange-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-200">Acesso Restrito</h3>
                  <p className="text-xs sm:text-sm text-orange-300/80 mt-0.5">
                    Seu acesso foi restringido no dia 8. Você pode consultar seus dados, mas não pode cadastrar novos agendamentos. Suspensão total em{" "}
                    <strong>{daysUntilSuspension ?? "poucos"} dia(s)</strong> (no dia 10).
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs h-9 shrink-0 shadow-md"
              >
                Regularizar pagamento
              </Button>
            </div>
          )}

          {status === "suspended" && (
            <div className="surface-card border-rose-500/40 bg-rose-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <Lock className="size-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-rose-200">Acesso Suspenso</h3>
                  <p className="text-xs sm:text-sm text-rose-300/80 mt-0.5">
                    Sistema suspenso por pendência financeira. Seus dados e histórico continuam 100% seguros. Efetue o pagamento para reativação imediata.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs h-9 shrink-0 shadow-md"
              >
                Regularizar agora
              </Button>
            </div>
          )}

          {/* Cards de Métricas do Plano */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              size="hero"
              label="Plano atual"
              value="NAVALHA PRO"
              icon={Sparkles}
              tone="gold"
              hint="Recorrente Mensal"
            />
            <StatCard
              size="hero"
              label="Valor mensal"
              value={monthlyPrice}
              icon={CreditCard}
              tone="gold"
              hint="Cobrança no cartão via Mercado Pago"
            />
            <StatCard
              size="hero"
              label="Próximo vencimento"
              value={nextBilling}
              icon={Calendar}
              hint="Ciclo fixo no dia 5 de cada mês"
            />
            <StatCard
              size="hero"
              label="Último pagamento"
              value={lastPayment}
              icon={CheckCircle2}
              hint={subscription?.last_payment_status === "approved" ? "Aprovado com sucesso" : "Aguardando confirmação"}
            />
          </div>

          {/* Como Funciona a Cobrança Proporcional (Pro-rata) */}
          <div className="surface-card border-white/5 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <HelpCircle className="size-4 text-primary" />
                </div>
              <h3 className="font-semibold text-white">Como funciona o ciclo recorrente do NAVALHA PRO</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm text-neutral-300">
              <div className="surface-card border-white/5 bg-white/[0.01] p-4 rounded-xl space-y-2">
                <strong className="text-amber-400 flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> 1. Vencimento Fixo no Dia 5
                </strong>
                <p className="text-neutral-400 leading-relaxed">
                  O ciclo financeiro da plataforma roda sempre do dia 5 até o próximo dia 5 de cada mês.
                </p>
              </div>

              <div className="surface-card border-white/5 bg-white/[0.01] p-4 rounded-xl space-y-2">
                <strong className="text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" /> 2. Cobrança Proporcional (Pro-Rata)
                </strong>
                <p className="text-neutral-400 leading-relaxed">
                  Ao assinar em qualquer outro dia, você paga apenas pelos dias restantes até o próximo dia 5. O valor integral só começa no próximo mês.
                </p>
              </div>

              <div className="surface-card border-white/5 bg-white/[0.01] p-4 rounded-xl space-y-2">
                <strong className="text-sky-400 flex items-center gap-1.5">
                  <RotateCcw className="size-3.5" /> 3. Tolerância e Reativação Automática
                </strong>
                <p className="text-neutral-400 leading-relaxed">
                  Dias 6 e 7 contam com carência total. Em caso de atraso, o pagamento via Mercado Pago reativa o sistema no mesmo segundo.
                </p>
              </div>
            </div>

            {/* Ação principal */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="h-11 px-6 font-semibold bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/20 active:scale-95"
              >
                {checkoutLoading ? (
                  <RefreshCw className="size-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="size-4 mr-2" />
                )}
                {status === "active" ? "Gerenciar / Alterar Cartão" : "Ativar Assinatura no Mercado Pago"}
              </Button>

              {subscription?.mercadopago_preapproval_id && (
                <span className="text-xs text-neutral-500 font-mono">
                  ID MP: {subscription.mercadopago_preapproval_id}
                </span>
              )}
            </div>
          </div>

          {/* Histórico de Faturas */}
          <div className="surface-card border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="font-semibold text-white">Histórico de Cobranças</h3>

            {invoicesQuery.isLoading ? (
              <CardSkeleton count={2} />
            ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
              <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
                {invoicesQuery.data.map((inv: any) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between text-sm hover:bg-white/[0.01]">
                    <div className="space-y-1">
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>{inv.billing_type === "pro_rata" ? "Adesão Proporcional (Pro-Rata)" : "Mensalidade NAVALHA PRO"}</span>
                        <Badge variant="outline" className={cn("text-[10px] py-0", inv.status === "approved" ? "border-emerald-500/30 text-emerald-400" : "border-rose-500/30 text-rose-400")}>
                          {inv.status === "approved" ? "Aprovado" : "Falhou"}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {dateLabel(inv.date_approved || inv.created_at)} · ID: {inv.mp_payment_id || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-white">{brl(Math.round(Number(inv.amount) * 100))}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 py-2">
                Nenhum pagamento registrado ainda. Assim que você ativar sua assinatura, o histórico aparecerá aqui.
              </p>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: VISÃO ADMINISTRATIVA (EQUIPE NAVALHA PRO) */}
        {isSupport && (
          <TabsContent value="admin" className="space-y-6 mt-0">
            <div className="surface-card border-white/5 p-6 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Gestão Global de Assinaturas</h3>
                  <p className="text-xs text-neutral-400">
                    Acompanhamento em tempo real das barbearias cadastradas na plataforma.
                  </p>
                </div>

                {/* Filtro por status */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "all", label: "Todas" },
                    { id: "active", label: "Ativas" },
                    { id: "payment_pending", label: "Pendentes" },
                    { id: "restricted", label: "Restritas" },
                    { id: "suspended", label: "Suspensas" },
                    { id: "cancelled", label: "Canceladas" },
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
                <CardSkeleton count={4} />
              ) : adminSubsQuery.isError ? (
                <ErrorState onRetry={() => adminSubsQuery.refetch()} />
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const list = (adminSubsQuery.data ?? []).filter((s: any) =>
                      adminFilter === "all" ? true : s.status === adminFilter,
                    );

                    if (list.length === 0) {
                      return (
                        <p className="text-sm text-neutral-400 py-6 text-center">
                          Nenhuma assinatura encontrada para este filtro.
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
                          className="surface-card border-white/5 bg-white/[0.01] hover:bg-white/[0.02] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">
                                {sub.barbershops?.name || "Barbearia sem nome"}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] py-0 font-medium", meta.badgeCls)}
                              >
                                {meta.label}
                              </Badge>
                            </div>
                            <div className="text-xs text-neutral-400 flex flex-wrap gap-x-4 gap-y-1">
                              <span>Slug: /{sub.barbershops?.slug || "-"}</span>
                              <span>WhatsApp: {sub.barbershops?.whatsapp || "N/A"}</span>
                              <span className="font-mono">ID MP: {sub.mercadopago_preapproval_id || "Nenhum"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 text-xs text-neutral-300">
                            <div>
                              <span className="text-neutral-500 block">Mensalidade</span>
                              <span className="font-semibold text-white">
                                {brl(Math.round(Number(sub.monthly_amount || 49.9) * 100))}
                              </span>
                            </div>

                            <div>
                              <span className="text-neutral-500 block">Próx. Cobrança</span>
                              <span>
                                {sub.next_payment_date ? dateLabel(sub.next_payment_date) : "Dia 5"}
                              </span>
                            </div>

                            <div>
                              <span className="text-neutral-500 block">Último Pagamento</span>
                              <span>
                                {sub.last_payment_date ? dateLabel(sub.last_payment_date) : "Pendente"}
                              </span>
                            </div>
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
