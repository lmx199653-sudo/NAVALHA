import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { checkSubscriptionAccessServer, type SubscriptionAccessResult } from "@/lib/mercadopago.functions";

export function useSubscriptionAccess() {
  const { data: shop } = useShop();
  const qc = useQueryClient();

  const barbershopId = shop?.id;

  const query = useQuery<SubscriptionAccessResult>({
    queryKey: ["subscription-access", barbershopId],
    enabled: !!barbershopId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!barbershopId) throw new Error("Sem barbearia");
      return await checkSubscriptionAccessServer({ data: { barbershopId } });
    },
  });

  // Atualização em tempo real quando o webhook atualizar o banco
  useEffect(() => {
    if (!barbershopId) return;

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
          qc.invalidateQueries({ queryKey: ["shop-subscription", barbershopId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
