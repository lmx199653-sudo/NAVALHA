import { friendlyError } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  LifeBuoy,
  Link2,
  LogOut,
  QrCode,
  ShieldAlert,
} from "lucide-react";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/ui/states";
import { BrandStudio, emptyBrand } from "@/components/BrandStudio";
import { DEFAULT_BRAND, type Brand } from "@/lib/brand";
import { PixKeyCard } from "@/components/PixKeyCard";
import { PixQrCard } from "@/components/PixQrCard";
import { detectPixKey, pixTypeLabel } from "@/lib/pix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
});

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

  const [pix, setPix] = useState({ key: "", holder: "" });
  useEffect(() => {
    if (shop) {
      setPix({ key: shop.pix_key ?? "", holder: shop.pix_holder_name ?? "" });
    }
  }, [shop]);
  const detected = pix.key.trim() ? detectPixKey(pix.key) : null;

  const savePix = useMutation({
    mutationFn: async (clear?: boolean) => {
      if (!clear) {
        if (!detected || !detected.ok) throw new Error(detected?.reason ?? "Informe a chave Pix.");
      }
      const { error } = await supabase
        .from("barbershops")
        .update(
          clear || !detected?.ok
            ? { pix_key: null, pix_key_type: null, pix_holder_name: null }
            : {
                pix_key: detected.normalized,
                pix_key_type: detected.type,
                pix_holder_name: pix.holder.trim() || null,
              },
        )
        .eq("id", shop!.id);
      if (error) throw error;
    },
    onSuccess: (_, clear) => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      toast.success(
        clear
          ? "Chave Pix removida"
          : `Chave Pix (${pixTypeLabel(detected?.ok ? detected.type : null)}) salva`,
      );
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/barbearia/${form.slug}` : "";

  return (
    <AppShell title="Configurações" subtitle="Dados da barbearia, link público e horários">
      <div className="space-y-4 pb-24 sm:pb-0">
        <div className="surface-card p-4 sm:p-5">
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
          <div className="surface-card p-4 sm:p-5">
            <SectionHeader icon={Building2} title="Dados da barbearia" />
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveShop.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Link público (slug)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Endereço</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Capa (URL)</Label>
                <Input
                  value={form.cover_url}
                  onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  A logo é definida acima, em “Identidade visual”.
                </p>
              </div>

              <div className="flex justify-end">
                <Button className="w-full sm:w-auto" disabled={saveShop.isPending}>
                  {saveShop.isPending ? "Salvando..." : "Salvar dados"}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="surface-card p-4 sm:p-5">
              <SectionHeader icon={Link2} title="Seu link de agendamento" />
              <p className="mt-3 break-all rounded-lg bg-secondary/60 p-3 text-xs text-primary">
                {publicUrl}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
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

            <div className="surface-card p-4 sm:p-5">
              <SectionHeader
                icon={QrCode}
                title="Pix — receba direto na sua conta"
                description="Sua chave aparece para o cliente ao agendar online e na conclusão do atendimento — como chave para copiar ou QR Code. O pagamento cai direto para você, sem intermediários."
              />
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  savePix.mutate(false);
                }}
              >
                <div className="space-y-1.5">
                  <Label>Chave Pix</Label>
                  <Input
                    value={pix.key}
                    onChange={(e) => setPix({ ...pix, key: e.target.value })}
                    placeholder="CPF, CNPJ, celular, e-mail ou chave aleatória"
                    autoComplete="off"
                  />
                  {detected && (
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        detected.ok ? "text-primary" : "text-destructive",
                      )}
                    >
                      {detected.ok ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <AlertCircle className="size-3.5" />
                      )}
                      {detected.ok ? (
                        <>
                          Tipo identificado: <strong>{pixTypeLabel(detected.type)}</strong>
                          <span className="text-muted-foreground"> · {detected.normalized}</span>
                        </>
                      ) : (
                        detected.reason
                      )}
                    </p>
                  )}
                  {!detected && (
                    <p className="text-xs text-muted-foreground">
                      O tipo da chave é identificado automaticamente ao digitar.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Nome do titular (opcional)</Label>
                  <Input
                    value={pix.holder}
                    onChange={(e) => setPix({ ...pix, holder: e.target.value })}
                    placeholder="Como aparece no banco"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {shop?.pix_key && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savePix.isPending}
                      onClick={() => savePix.mutate(true)}
                    >
                      Remover
                    </Button>
                  )}
                  <Button
                    className="w-full sm:w-auto"
                    disabled={savePix.isPending || !detected?.ok}
                  >
                    {savePix.isPending ? "Salvando..." : "Salvar chave Pix"}
                  </Button>
                </div>
              </form>
              {shop?.pix_key && (
                <div className="mt-4 space-y-3">
                  <PixKeyCard
                    compact
                    pixKey={shop.pix_key}
                    pixKeyType={shop.pix_key_type}
                    holderName={shop.pix_holder_name}
                  />
                  <PixQrCard
                    compact
                    pixKey={shop.pix_key}
                    pixKeyType={shop.pix_key_type}
                    holderName={shop.pix_holder_name}
                  />
                </div>
              )}
            </div>

            <div className="surface-card p-4 sm:p-5">
              <SectionHeader icon={Clock} title="Horário de funcionamento" />
              <div className="mt-3 space-y-2">
                {(localHours ?? []).map((h, i) => (
                  <div
                    key={h.weekday}
                    className="surface-row flex flex-wrap items-center gap-2 px-3.5 py-2.5"
                  >
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
                      {WEEKDAYS[h.weekday]}
                    </span>
                    <Input
                      type="time"
                      className="h-9 w-auto min-w-0 flex-1"
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
                      className="h-9 w-auto min-w-0 flex-1"
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
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={saveHours.isPending}
                  onClick={() => saveHours.mutate()}
                >
                  {saveHours.isPending ? "Salvando..." : "Salvar horários"}
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full sm:w-auto"
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

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card p-4 sm:p-5">
            <SectionHeader icon={LifeBuoy} title="Suporte e privacidade" />
            <p className="mt-2 text-sm text-muted-foreground">
              Precisa de ajuda ou quer saber como seus dados são tratados?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LEGAL_LINKS.filter((l) => l.to !== "/excluir-conta").map((l) => (
                <Button key={l.to} asChild variant="outline" size="sm">
                  <Link to={l.to}>{l.label}</Link>
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Contato: <span className="text-foreground">{LEGAL.supportEmail}</span>
            </p>
          </div>

          <div className="surface-card border-destructive/30 p-4 sm:p-5">
            <SectionHeader icon={ShieldAlert} title="Excluir conta" />
            <p className="mt-2 text-sm text-muted-foreground">
              Apaga definitivamente sua conta, a barbearia e todos os dados (clientes, agenda,
              assinaturas, financeiro). Não pode ser desfeito.
            </p>
            <div className="mt-3">
              <DeleteAccountDialog />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
