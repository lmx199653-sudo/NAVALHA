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
        toast.success("Abrindo pagamento seguro no Mercado Pago...");
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
      subtitle="Mensalidade da barbearia no NAVALHA PRO"
      action={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("border font-medium px-2.5 py-1 text-xs", statusMeta.badgeCls)}>
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

        {/* TAB 1: MEU PLANO (DESIGN ULTRA LIMPO E SIMPLES) */}
        <TabsContent value="plano" className="space-y-6 mt-0">
          {/* Alerta de aviso simples caso esteja pendente */}
          {status === "payment_pending" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4 text-xs sm:text-sm text-amber-200">
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 shrink-0 text-amber-400" />
                <span>
                  Pagamento pendente. Regularize até o dia 8 para manter o acesso sem interrupções.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-8 shrink-0"
              >
                Pagar agora
              </Button>
            </div>
          )}

          {status === "restricted" && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 flex items-center justify-between gap-4 text-xs sm:text-sm text-orange-200">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="size-4 shrink-0 text-orange-400" />
                <span>
                  Acesso restrito para novos agendamentos. Regularize seu plano para desbloquear.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs h-8 shrink-0"
              >
                Regularizar
              </Button>
            </div>
          )}

          {status === "suspended" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between gap-4 text-xs sm:text-sm text-rose-200">
              <div className="flex items-center gap-2.5">
                <Lock className="size-4 shrink-0 text-rose-400" />
                <span>Acesso suspenso por pendência financeira. Seus dados estão preservados.</span>
              </div>
              <Button
                size="sm"
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs h-8 shrink-0"
              >
                Regularizar
              </Button>
            </div>
          )}

          {/* CARD PRINCIPAL CENTRAL - ULTRA SIMPLES E ELEGANTE */}
          <div className="max-w-2xl mx-auto rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#13151A] to-[#0A0C0E] p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl sm:text-3xl font-bold font-display text-white tracking-tight">
                    NAVALHA PRO
                  </h2>
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    Mensal
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Sistema completo para gestão e agendamento da sua barbearia.
                </p>
              </div>

              {/* Preço */}
              <div className="text-left sm:text-right">
                <div className="flex items-baseline gap-1 sm:justify-end">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    {monthlyPrice}
                  </span>
                  <span className="text-xs text-neutral-400">/mês</span>
                </div>
                <span className="text-[11px] text-amber-400/90 block mt-0.5">
                  Vencimento fixo todo dia 05
                </span>
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t border-white/5" />

            {/* O que está incluído (3 itens simples e diretos) */}
            <div className="space-y-2.5 text-xs sm:text-sm text-neutral-300">
              <div className="flex items-center gap-2.5">
                <div className="size-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check className="size-3 text-emerald-400" />
                </div>
                <span>Agenda, link online do cliente, finanças e profissionais ilimitados</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="size-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check className="size-3 text-emerald-400" />
                </div>
                <span>Cobrança proporcional (no 1º mês você paga só os dias até o dia 5)</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="size-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check className="size-3 text-emerald-400" />
                </div>
                <span>Cobrança automática no cartão com carência segura nos dias 6 e 7</span>
              </div>
            </div>

            {/* Ação Principal */}
            <div className="pt-2 space-y-2.5">
              <Button
                onClick={handleStartSubscription}
                disabled={checkoutLoading}
                className="w-full h-12 text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/20 active:scale-98 rounded-xl transition-all"
              >
                {checkoutLoading ? (
                  <RefreshCw className="size-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="size-4 mr-2" />
                )}
                {isPaid ? "Gerenciar Cartão no Mercado Pago" : "Ativar Assinatura no Mercado Pago"}
              </Button>

              <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
                <span>🔒 Pagamento seguro via Mercado Pago</span>
                <span>Próximo ciclo: {nextBilling}</span>
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE RECIBOS (Discreto e minimalista) */}
          {invoicesQuery.data && invoicesQuery.data.length > 0 && (
            <div className="max-w-2xl mx-auto rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                <span>Recibos Recentes</span>
                <Receipt className="size-3.5" />
              </div>

              <div className="divide-y divide-white/5">
                {invoicesQuery.data.map((inv: any) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-white font-medium block">
                        {inv.billing_type === "pro_rata" ? "Adesão Proporcional" : "Mensalidade NAVALHA PRO"}
                      </span>
                      <span className="text-neutral-500 text-[11px]">
                        {dateLabel(inv.date_approved || inv.created_at)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">
                        {brl(Math.round(Number(inv.amount) * 100))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
