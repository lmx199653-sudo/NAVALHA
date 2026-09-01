import { friendlyError } from "@@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS } from "@/lib/format";
import { BrandStudio, emptyBrand } from "@/components/BrandStudio";
import { DEFAULT_BRAND, type Brand } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
});

type Hours = {
  id?: string;
  weekday: number;
  open_time: string;
  close_time: string;
  closed: boolean;
};

function SettingsPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    phone: "",
    address: "",
    description: "",
    logo_url: "",
    cover_url: "",
  });

  useEffect(() => {
    if (shop) {
      setForm({
        name: shop.name ?? "",
        slug: shop.slug ?? "",
        phone: shop.phone ?? "",
        address: shop.address ?? "",
        description: shop.description ?? "",
        logo_url: shop.logo_url ?? "",
        cover_url: shop.cover_url ?? "",
      });
    }
  }, [shop]);

  const [brand, setBrand] = useState<Brand>(() => emptyBrand());
  useEffect(() => {
    if (shop) {
      setBrand({
        name: shop.name,
        logo_url: shop.logo_url,
        accent_color: shop.accent_color || DEFAULT_BRAND.accent_color,
        secondary_color: shop.secondary_color || DEFAULT_BRAND.secondary_color,
        bg_color: shop.bg_color || DEFAULT_BRAND.bg_color,
        font_family: shop.font_family || DEFAULT_BRAND.font_family,
      });
    }
  }, [shop]);

  const saveBrand = useMutation({
    mutationFn: async (b: Brand) => {
      const { error } = await supabase
        .from("barbershops")
        .update({
          logo_url: b.logo_url,
          accent_color: b.accent_color,
          secondary_color: b.secondary_color,
          bg_color: b.bg_color,
          font_family: b.font_family,
        })
        .eq("id", shop!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      toast.success("Identidade visual salva");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const { data: hours } = useQuery({
    queryKey: ["hours", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_hours")
        .select("*")
        .eq("barbershop_id", shop!.id)
        .order("weekday");
      const rows = (data ?? []) as Hours[];
      return WEEKDAYS.map((_, i) =>
        rows.find((r) => r.weekday === i) ?? {
          weekday: i,
          open_time: "09:00",
          close_time: "20:00",
          closed: i === 0,
        },
      );
    },
  });

  const [localHours, setLocalHours] = useState<Hours[] | null>(null);
  useEffect(() => {
    if (hours) setLocalHours(hours);
  }, [hours]);

  const saveShop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("barbershops")
        .update({
          name: form.name,
          slug: form.slug,
          phone: form.phone,
          address: form.address,
          description: form.description,
          cover_url: form.cover_url || null,

        })
        .eq("id", shop!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      toast.success("Dados atualizados");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const saveHours = useMutation({
    mutationFn: async () => {
      const rows = (localHours ?? []).map((h) => ({
        barbershop_id: shop!.id,
        weekday: h.weekday,
        open_time: h.open_time,
        close_time: h.close_time,
        closed: h.closed,
      }));
      const { error } = await supabase
        .from("business_hours")
        .upsert(rows, { onConflict: "barbershop_id,weekday" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hours"] });
      toast.success("Horários salvos");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/barbearia/${form.slug}` : "";

  return (
    <AppShell title="Configurações" subtitle="Dados da barbearia, link público e horários">
      <div className="surface-card mb-4 p-4">
        <BrandStudio
          shopName={form.name}
          value={brand}
          onChange={(b) => {
            setBrand(b);
            if (shop && b.logo_url && b.logo_url !== brand.logo_url) saveBrand.mutate(b);
          }}
          onSave={async (b) => saveBrand.mutateAsync(b)}
          saving={saveBrand.isPending}
        />

      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <h3 className="font-display text-2xl">Dados da barbearia</h3>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveShop.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Link público (slug)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Capa (URL)</Label>
              <Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                A logo é definida acima, em “Identidade visual”.
              </p>
            </div>

            <Button disabled={saveShop.isPending}>Salvar dados</Button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-4">
            <h3 className="font-display text-2xl">Seu link de agendamento</h3>
            <p className="mt-2 break-all rounded-lg bg-secondary/60 p-3 text-xs text-primary">
              {publicUrl}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="size-4" /> Copiar
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Abrir
                </a>
              </Button>
            </div>
          </div>

          <div className="surface-card p-4">
            <h3 className="font-display text-2xl">Horário de funcionamento</h3>
            <div className="mt-3 space-y-2">
              {(localHours ?? []).map((h, i) => (
                <div key={h.weekday} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-muted-foreground">{WEEKDAYS[h.weekday]}</span>
                  <Input
                    type="time"
                    className="h-9"
                    value={h.open_time.slice(0, 5)}
                    disabled={h.closed}
                    onChange={(e) => {
                      const next = [...localHours!];
                      next[i] = { ...h, open_time: e.target.value };
                      setLocalHours(next);
                    }}
                  />
                  <Input
                    type="time"
                    className="h-9"
                    value={h.close_time.slice(0, 5)}
                    disabled={h.closed}
                    onChange={(e) => {
                      const next = [...localHours!];
                      next[i] = { ...h, close_time: e.target.value };
                      setLocalHours(next);
                    }}
                  />
                  <Switch
                    checked={!h.closed}
                    onCheckedChange={(v) => {
                      const next = [...localHours!];
                      next[i] = { ...h, closed: !v };
                      setLocalHours(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <Button className="mt-3" size="sm" disabled={saveHours.isPending} onClick={() => saveHours.mutate()}>
              Salvar horários
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            <LogOut className="size-4" /> Sair da conta
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
