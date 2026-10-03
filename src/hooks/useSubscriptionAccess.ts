import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import type { SubscriptionAccessResult } from "@/lib/mercadopago.functions";

export function useSubscriptionAccess() {
  const { data: shop } = useShop();
  const qc = useQueryClient();

  const barbershopId = shop?.id;

  const query = useQuery<SubscriptionAccessResult>({
    queryKey: ["subscription-access", barbershopId],
    enabled: !!barbershopId,
    staleTime: 60_000,
    retry: false, // Não fica tentando se houver erro
    queryFn: async (): Promise<SubscriptionAccessResult> => {
      if (!barbershopId) {
        return { access: "full", status: "active", message: "Carregando..." };
      }

      try {
        // Consulta diretamente no Supabase com o cliente autenticado do usuário
        const { data: sub, error } = await (supabase as any)
          .from("subscriptions")
          .select("*")
          .eq("barbershop_id", barbershopId)
          .maybeSingle();

        // Se a tabela ainda não existe ou se não há assinatura, mantém acesso liberado
        if (error || !sub) {
          return {
            access: "full",
            status: "active",
            message: "Assinatura ativa",
          };
        }

        const now = new Date();
        const status = sub.status;

        if (status === "suspended" || (sub.suspended_at && new Date(sub.suspended_at) <= now)) {
          return {
            access: "suspended",
            status: "suspended",
            subscription: sub,
            message: "Acesso suspenso por pendência na assinatura.",
          };
        }

        if (status === "restricted" || (sub.restricted_at && new Date(sub.restricted_at) <= now)) {
          const daysUntilSuspension = sub.suspended_at
            ? Math.max(0, Math.ceil((new Date(sub.suspended_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : 0;

          return {
            access: "restricted",
            status: "restricted",
            subscription: sub,
            days_until_suspension: daysUntilSuspension,
            message: "Acesso restrito. Não é possível cadastrar novos agendamentos.",
          };
        }

        if (status === "payment_pending") {
          const daysUntilRestriction = sub.restricted_at
            ? Math.max(0, Math.ceil((new Date(sub.restricted_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : 0;
          const daysUntilSuspension = sub.suspended_at
            ? Math.max(0, Math.ceil((new Date(sub.suspended_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : 0;

          return {
            access: "full",
            status: "payment_pending",
            in_grace_period: true,
            subscription: sub,
            days_until_restriction: daysUntilRestriction,
            days_until_suspension: daysUntilSuspension,
            message: "Seu pagamento está pendente. Regularize para manter seu acesso sem interrupções.",
          };
        }

        return {
          access: "full",
          status: "active",
          subscription: sub,
          message: "Assinatura ativa e em dia.",
        };
      } catch (e) {
        console.warn("[SubscriptionAccess] Fallback seguro de acesso:", e);
        return {
          access: "full",
          status: "active",
          message: "Assinatura ativa",
        };
      }
    },
  });

  // Atualização em tempo real quando o webhook atualizar o banco
  useEffect(() => {
    if (!barbershopId) return;

    try {
      const channel = supabase
        .channel(`sub-access-${barbershopId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subscriptions",
            filter: `barbershop_id=eq.${barbershopId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ["subscription-access", barbershopId] });
            qc.invalidateQueries({ queryKey: ["subscription-invoices", barbershopId] });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // ignore
    }
    return undefined;
  }, [barbershopId, qc]);

  const access = query.data?.access ?? "full";
  const status = query.data?.status ?? "active";

  return {
    ...query,
    access,
    status,
    isRestricted: access === "restricted",
    isSuspended: access === "suspended",
    inGracePeriod: Boolean(query.data?.in_grace_period),
    daysUntilRestriction: query.data?.days_until_restriction,
    daysUntilSuspension: query.data?.days_until_suspension,
    subscription: query.data?.subscription,
    message: query.data?.message,
  };
}
