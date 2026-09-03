import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useShop";
import {
  fetchInbox,
  fetchIsSupport,
  fetchMessages,
  fetchMyConversations,
  fetchNotifications,
} from "@/lib/support";

export function useIsSupport() {
  const { userId, ready } = useSession();
  return useQuery({
    queryKey: ["is-support", userId],
    enabled: ready && !!userId,
    staleTime: 5 * 60_000,
    queryFn: fetchIsSupport,
  });
}

/** Assina alterações em tempo real das tabelas de suporte e invalida as consultas. */
export function useSupportRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("support-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { conversation_id?: string };
          if (row?.conversation_id)
            qc.invalidateQueries({ queryKey: ["support-messages", row.conversation_id] });
          qc.invalidateQueries({ queryKey: ["support-conversations"] });
          qc.invalidateQueries({ queryKey: ["support-inbox"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => {
          qc.invalidateQueries({ queryKey: ["support-conversations"] });
          qc.invalidateQueries({ queryKey: ["support-inbox"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}

export function useMyConversations() {
  const { userId, ready } = useSession();
  return useQuery({
    queryKey: ["support-conversations", userId],
    enabled: ready && !!userId,
    queryFn: () => fetchMyConversations(userId!),
  });
}

export function useInbox(enabled: boolean) {
  return useQuery({
    queryKey: ["support-inbox"],
    enabled,
    refetchInterval: 30_000,
    queryFn: fetchInbox,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["support-messages", conversationId],
    enabled: !!conversationId,
    queryFn: () => fetchMessages(conversationId!),
  });
}

export function useNotifications() {
  const { userId, ready } = useSession();
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: ready && !!userId,
    refetchInterval: 60_000,
    queryFn: fetchNotifications,
  });
}
