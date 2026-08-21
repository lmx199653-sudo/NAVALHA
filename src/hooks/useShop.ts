import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Shop = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  accent_color: string;
  secondary_color: string;
  bg_color: string;
  font_family: string;
  brand_style: string | null;
  brand_symbol: string | null;
  template: string;
  onboarding_done: boolean;
};

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, email, ready };
}

export function useShop() {
  const { userId, ready } = useSession();

  return useQuery({
    queryKey: ["shop", userId],
    enabled: ready,
    queryFn: async (): Promise<Shop | null> => {
      // Visitante sem login: barbearia de demonstração (somente visualização).
      if (!userId) return demoShop;
      const { data, error } = await supabase
        .from("barbershops")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Shop | null;
    },
  });
}

export function useInvalidateShopData() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
