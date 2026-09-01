import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Shop = {
  id: string;
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
  pix_key: string | null;
  pix_key_type: string | null;
  pix_holder_name: string | null;
};

const SHOP_COLUMNS =
  "id, name, slug, description, address, phone, whatsapp, instagram, logo_url, cover_url, accent_color, secondary_color, bg_color, font_family, brand_style, brand_symbol, template, onboarding_done, pix_key, pix_key_type, pix_holder_name";

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
      if (!userId) return null;
      // A barbearia é localizada pelo vínculo de equipe (o dono recebe o vínculo
      // automaticamente), evitando expor o identificador do proprietário.
      const { data: memberships, error: memberError } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("user_id", userId);
      if (memberError) throw memberError;
      const ids = (memberships ?? []).map((m: { barbershop_id: string }) => m.barbershop_id);
      if (ids.length === 0) return null;

      const { data, error } = await supabase
        .from("barbershops")
        .select(SHOP_COLUMNS)
        .in("id", ids)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Shop | null;
    },
  });
}

export function useInvalidateShopData() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
