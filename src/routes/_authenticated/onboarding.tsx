import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Scissors, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useSession, useShop } from "@/hooks/useShop";
import { slugify } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandStudio, emptyBrand } from "@/components/BrandStudio";
import type { Brand } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId } = useSession();
  const { data: shop, isSuccess } = useShop();
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<Brand>(() => emptyBrand());
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    whatsapp: "",
    instagram: "",
    description: "",
  });

  useEffect(() => {
    if (isSuccess && shop?.onboarding_done) navigate({ to: "/dashboard", replace: true });
  }, [isSuccess, shop, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    const slug = slugify(form.slug || form.name);
    const payload = {
      ...form,
      slug,
      owner_id: userId,
      onboarding_done: true,
      logo_url: brand.logo_url,
      accent_color: brand.accent_color,
      secondary_color: brand.secondary_color,
      bg_color: brand.bg_color,
      font_family: brand.font_family,
    };

    const returning = "id, slug, name, onboarding_done";
    const { data, error } = shop
      ? await supabase.from("barbershops").update(payload).eq("id", shop.id).select(returning).single()
      : await supabase.from("barbershops").insert(payload).select(returning).single();

    if (error || !data) {
      setLoading(false);
      toast.error(error?.message ?? "Não foi possível salvar");
      return;
    }

    await supabase
      .from("barbershop_members")
      .upsert({ barbershop_id: data.id, user_id: userId, role: "owner" }, { onConflict: "barbershop_id,user_id" });

    // Barbearia começa vazia: o barbeiro cadastra serviços, preços e clientes.
    await supabase.from("business_hours").upsert(
      Array.from({ length: 7 }, (_, weekday) => ({
        barbershop_id: data.id,
        weekday,
        open_time: "09:00",
        close_time: weekday === 6 ? "18:00" : "20:00",
        closed: weekday === 0,
      })),
      { onConflict: "barbershop_id,weekday" },
    );

    await qc.invalidateQueries();
    setLoading(false);
    toast.success("Barbearia criada com sucesso!");
    navigate({ to: "/dashboard", replace: true });
  }

  if (!isSuccess || shop?.onboarding_done) return null;

  return (
    <div className="grid-noise min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Scissors className="mx-auto size-6 text-primary" />
          <h1 className="mt-3 font-display text-4xl">Configure sua barbearia</h1>
          <p className="mt-2 text-sm font-medium text-primary">
            Comece grátis por 7 dias. Cadastre sua barbearia e faça login no app.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Leva menos de 1 minuto. Você pode ajustar tudo depois.
          </p>
        </div>

        <form onSubmit={submit} className="surface-card space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da barbearia</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) });
                setBrand((b) => ({ ...b, name: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Link da página pública</Label>
            <div className="flex items-center gap-2 rounded-lg border border-input px-3">
              <span className="shrink-0 text-xs text-muted-foreground">/barbearia/</span>
              <Input
                id="slug"
                className="border-0 px-0 focus-visible:ring-0"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" placeholder="@suabarbearia" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="rounded-xl border border-border p-4">
            <BrandStudio shopName={form.name} value={brand} onChange={setBrand} allowLogoUpload={false} />
          </div>

          <div className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left text-sm">
            <Sparkles className="size-4 text-primary" />
            <span>
              Sua barbearia começa do zero
              <span className="block text-xs text-muted-foreground">
                Você cadastra seus serviços, preços, barbeiros e clientes do seu jeito.
              </span>
            </span>
          </div>

          <Button className="w-full" size="lg" disabled={loading}>
            {loading ? "Criando..." : "Criar minha barbearia"}
          </Button>
        </form>
      </div>
    </div>
  );
}
