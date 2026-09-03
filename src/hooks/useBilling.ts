import { useQuery } from "@tanstack/react-query";

import { useShop } from "@/hooks/useShop";
import { fetchBillingOverview } from "@/lib/billing";

/** Visão geral da cobrança da barbearia (atualiza a cada minuto e ao focar a aba). */
export function useBilling() {
  const { data: shop } = useShop();
  return useQuery({
    queryKey: ["billing", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => fetchBillingOverview(shop!.id),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
