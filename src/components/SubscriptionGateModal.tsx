import { Link, useRouterState } from "@tanstack/react-router";
import { Lock, ShieldCheck, ArrowRight, RefreshCw, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { useShop } from "@/hooks/useShop";
import { createOrGetMercadoPagoSubscription } from "@/lib/mercadopago.functions";
import { Button } from "@/components/ui/button";

export function SubscriptionGateModal() {
  const { access, status, refetch } = useSubscriptionAccess();
  const { data: shop } = useShop();
  const [loading, setLoading] = useState(false);

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  // Não bloqueia caso esteja na tela de cobrança ou suporte para poder pagar/pedir ajuda
  const isAllowedPath =
    pathname.startsWith("/cobranca") ||
    pathname.startsWith("/suporte-chat") ||
    pathname.startsWith("/auth") ||
    pathname === "/";

  if (access !== "suspended" || isAllowedPath) {
    return null;
  }

  async function handleCheckout() {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const res = await createOrGetMercadoPagoSubscription({
        data: {
          barbershopId: shop.id,
          backUrl: `${window.location.origin}/cobranca?status=approved`,
        },
      });

      if (res.initPoint) {
        window.location.href = res.initPoint;
      } else {
        toast.info("Assinatura já identificada. Atualizando...");
        refetch();
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao iniciar pagamento no Mercado Pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="surface-card max-w-md w-full p-6 text-center border-rose-500/40 shadow-2xl shadow-rose-950/40 relative overflow-hidden">
        <div className="mx-auto size-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
          <Lock className="size-8 text-rose-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Acesso Temporariamente Suspenso</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Identificamos uma pendência na assinatura da sua barbearia após o ciclo do dia 5.
        </p>

        <div className="surface-card border-white/5 bg-white/[0.02] p-3 text-left mb-6 space-y-2 text-xs text-neutral-300">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Nenhum dado, agendamento ou cliente foi apagado.</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400">
            <CreditCard className="size-4 shrink-0 text-amber-400" />
            <span>Reativação instantânea e automática após o pagamento.</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold shadow-lg shadow-amber-500/20 active:scale-95"
          >
            {loading ? (
              <RefreshCw className="size-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="size-4 mr-2" />
            )}
            Regularizar no Mercado Pago
          </Button>

          <Link to="/cobranca" className="block">
            <Button variant="ghost" className="w-full text-xs text-neutral-400 hover:text-white">
              Ir para detalhes da assinatura
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
