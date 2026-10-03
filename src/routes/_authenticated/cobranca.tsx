import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  HelpCircle,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Receipt,
  AlertTriangle,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
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
  component: MeuPlanoPage,
});

function MeuPlanoPage() {
  const { data: shop } = useShop();
  const { data: isSupport } = useIsSupport();

  const {
    access,
    status,
    subscription,
    daysUntilRestriction,
    daysUntilSuspension,
    refetch: refetchAccess,
  } = useSubscriptionAccess();

  // Histórico de faturas
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

  const isPaid = status === "active";
  const monthlyPrice = subscription?.monthly_amount
    ? brl(Math.round(subscription.monthly_amount * 100))
    : "R$ 49,90";

  const nextBilling = subscription?.next_payment_date
    ? dateLabel(subscription.next_payment_date)
    : "Todo dia 05";

  const lastPayment = subscription?.last_payment_date
    ? dateLabel(subscription.last_payment_date)
    : isPaid ? "Confirmado" : "Pendente";

  return (
    <AppShell
      title="Meu Plano"
      subtitle="Mensalidade do sistema · Vencimento fixo todo dia 5 via Mercado Pago"
      action={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("border font-medium px-2.5 py-1 text-xs", statusMeta.badgeCls)}>
            {statusMeta.label}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-neutral-300 hover:text-white border-white/10"
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

        {/* TAB 1: MEU PLANO (BARBEIRO) */}
        <TabsContent value="plano" className="space-y-6 mt-0">
          {/* Alerta de inadimplência dinâmico */}
          {status === "payment_pending" && (
            <div className="surface-card border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="size-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-200">Pagamento Pendente</h3>
                  <p className="text-xs sm:text-sm text-amber-300/80 mt-0.5">
                    A cobrança do dia 5 não foi concluída. Regularize para evitar bloqueio de novos agendamentos{" "}
                    {daysUntilRestriction ? `em ${daysUntilRestriction} dia(s)` : "no dia 8"}.
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
            <div className="surface-card border-orange-500/40 bg-orange-500/10 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-200">Acesso Restrito</h3>
                  <p className="text-xs sm:text-sm text-orange-300/80 mt-0.5">
                    Criação de novos agendamentos bloqueada por pendência financeira. Regularize para reativar imediatamente.
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
            <div className="surface-card border-rose-500/40 bg-rose-500/10 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <Lock className="size-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-rose-200">Acesso Suspenso</h3>
                  <p className="text-xs sm:text-sm text-rose-300/80 mt-0.5">
                    Sistema suspenso por pendência financeira. Seus dados estão seguros. Regularize para restabelecer o acesso total.
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

          {/* CARD PRINCIPAL (HERO CARD) - Design Limpo, Dourado e Sofisticado */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#121418] via-[#0E1013] to-[#0A0B0D] p-6 sm:p-8 shadow-2xl">
            {/* Glow sutil ao fundo */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-15 blur-3xl"
              style={{ background: "radial-gradient(circle, #F59E0B, transparent 70%)" }}
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Informações do Plano */}
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-400">
                    <Sparkles className="size-3.5" />
                    Plano de Gestão
                  </span>
                  <Badge variant="outline" className={cn("text-xs py-0.5", statusMeta.badgeCls)}>
                    {statusMeta.label}
                  </Badge>
                </div>

                <div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                    NAVALHA PRO
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    Acesso completo ao agendamento online, link da barbearia, gestão de equipe, financeiro e controle total de clientes.
                  </p>
                </div>

                {/* Preço em Destaque */}
                <div className="pt-1 flex items-baseline gap-2">
                  <span className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                    {monthlyPrice}
                  </span>
                  <span className="text-sm font-medium text-neutral-400">/ mês</span>
                </div>
              </div>

              {/* Botão de Ação e Garantia */}
              <div className="flex flex-col items-start lg:items-end justify-center gap-3 shrink-0">
                <Button
                  onClick={handleStartSubscription}
                  disabled={checkoutLoading}
                  className="h-12 px-8 text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/20 active:scale-95 rounded-xl transition-all"
                >
                  {checkoutLoading ? (
                    <RefreshCw className="size-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="size-4 mr-2" />
                  )}
                  {isPaid ? "Gerenciar Cartão" : "Ativar Assinatura no Mercado Pago"}
                </Button>

                <p className="text-[11px] text-neutral-500 text-left lg:text-right">
                  🔒 Checkout seguro processado pelo Mercado Pago · Cancele quando quiser
                </p>
              </div>
            </div>

            {/* Linha Divisória Sutil */}
            <div className="my-6 border-t border-white/5" />

            {/* Destaques Rápidos do Ciclo (Sem cortes de texto) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Calendar className="size-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-neutral-400 block font-medium">Vencimento Fixo</span>
                  <strong className="text-sm text-white font-semibold block truncate">Todo dia 05</strong>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-neutral-400 block font-medium">Cobrança Justa</span>
                  <strong className="text-sm text-white font-semibold block truncate">Pro-Rata Automático</strong>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                <div className="size-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-4 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-neutral-400 block font-medium">Último Pagamento</span>
                  <strong className="text-sm text-white font-semibold block truncate">{lastPayment}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* GUIA EM 3 PASSOS SIMPLES (Como Funciona o Ciclo) */}
          <div className="surface-card border-white/5 p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-neutral-400">
              Regras do Ciclo Mensal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-1.5">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  1. Entrada Proporcional
                </span>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Ao assinar hoje, o Mercado Pago cobra apenas os dias que faltam até o dia 5. Você não paga um mês cheio adiantado.
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-1.5">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  2. Recorrência no Dia 5
                </span>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Todo dia 5 o valor da mensalidade ({monthlyPrice}) é cobrado de forma automática no cartão cadastrado.
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 space-y-1.5">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  3. Carência e Segurança
                </span>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Caso o cartão expire ou não tenha limite, você tem carência nos dias 6 e 7. Seus dados nunca são apagados.
                </p>
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE FATURAS */}
          <div className="surface-card border-white/5 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-neutral-400">
                Histórico de Cobranças
              </h3>
              <Receipt className="size-4 text-neutral-500" />
            </div>

            {invoicesQuery.isLoading ? (
              <CardSkeleton count={2} />
            ) : invoicesQuery.data && invoicesQuery.data.length > 0 ? (
              <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
                {invoicesQuery.data.map((inv: any) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between text-sm hover:bg-white/[0.01] transition-colors">
                    <div className="space-y-1">
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>
                          {inv.billing_type === "pro_rata"
                            ? "Cobrança Proporcional (Entrada)"
                            : "Mensalidade NAVALHA PRO"}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] py-0",
                            inv.status === "approved"
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-rose-500/30 text-rose-400"
                          )}
                        >
                          {inv.status === "approved" ? "Aprovado" : "Falhou"}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {dateLabel(inv.date_approved || inv.created_at)} · ID: {inv.mp_payment_id || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-white">
                        {brl(Math.round(Number(inv.amount) * 100))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-6 text-center text-xs text-neutral-500">
                Nenhum pagamento registrado ainda. Assim que sua assinatura for iniciada, os recibos aparecerão aqui.
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
                  <h3 className="text-lg font-bold text-white">Gestão Global de Assinaturas</h3>
                  <p className="text-xs text-neutral-400">
                    Visão de todas as barbearias e status de pagamento no Mercado Pago.
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
                                {sub.barbershops?.name || "Barbearia"}
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
                              <span className="text-neutral-500 block">Vencimento</span>
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
