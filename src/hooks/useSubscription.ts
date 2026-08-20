import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "./useShop";
import { checkSubscription } from "@/lib/subscription.functions";

export type SubscriptionStatus = {
  subscribed: boolean;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
};

export function useSubscription() {
  const { userId, ready } = useSession();
  const fetchSubscription = useServerFn(checkSubscription);

  return useQuery({
    queryKey: ["subscription", userId],
    enabled: ready && !!userId,
    queryFn: async (): Promise<SubscriptionStatus> => {
      return fetchSubscription({ data: undefined });
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
