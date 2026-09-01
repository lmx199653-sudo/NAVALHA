import { friendlyError } from "@@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, ImagePlus, Link as LinkIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase-guard";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { DEFAULT_SERVICE_IMAGES, serviceImage } from "@/lib/service-images";

export const Route = createFileRoute("/_authenticated/servicos")({
  component: ServicesPage,
});

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  active: boolean;
  image_url: string | null;
};

const EMPTY = {
  name: "",
  description: "",
  price: "",
  duration: "30",
  active: true,
  image_url: "",
};

function ServicesPage() {
  const { data: shop } = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);

  function customStoragePath(url: string) {
    const marker = "/storage/v1/object/sign/service-photos/";
    const start = url.indexOf(marker);
    if (start < 0) return null;
    return decodeURIComponent(url.slice(start + marker.length).split("?")[0] ?? "");
  }

  async function removeStoredPhoto(url: string) {
    const path = customStoragePath(url);
    if (!path || !shop?.id || !path.startsWith(`${shop.id}/`)) return;
    const { error } = await supabase.storage.from("service-photos").remove([path]);
    if (error) throw error;
  }

  async function uploadPhoto(file: File) {
    if (!shop?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${shop.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("service-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const signed = await supabase.storage
        .from("service-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error) throw signed.error;
      setForm((f) => ({ ...f, image_url: signed.data.signedUrl }));
      toast.success("Foto enviada");
    } catch (e) {
      toast.error(friendlyError((e as Error).message));
    } finally {
      setUploading(false);
    }
  }

  async function clearCustomPhoto() {
    setForm((f) => ({ ...f, image_url: "" }));
    toast.success("A imagem padrão será usada após salvar.");
  }


  const { data: services } = useQuery({
    queryKey: ["services", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      if (!shop?.id) return [] as Service[];
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", shop.id)
        .order("sort_order")
        .order("name");
      return (data ?? []) as Service[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error("Barbearia não encontrada");
      const payload = {
        barbershop_id: shop.id,
        name: form.name,
        description: form.description,
        price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
        duration_min: Number(form.duration) || 30,
        active: form.active,
        image_url: form.image_url || null,
      };
      const { error } = editing
        ? await supabase.from("services").update(payload).eq("id", editing.id)
        : await supabase.from("services").insert(payload);
      if (error) throw error;
      return editing?.image_url && editing.image_url !== payload.image_url
        ? editing.image_url
        : null;
    },
    onSuccess: async (oldImageUrl) => {
      if (oldImageUrl) {
        try {
          await removeStoredPhoto(oldImageUrl);
        } catch {
          toast.warning("Serviço salvo, mas a foto antiga não pôde ser apagada.");
        }
      }
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["public-shop"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      toast.success("Serviço salvo");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Serviço removido");
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      price: (s.price_cents / 100).toFixed(2),
      duration: String(s.duration_min),
      active: s.active,
      image_url: s.image_url ?? "",
    });
    setOpen(true);
  }

  return (
    <AppShell
      title="Serviços"
      subtitle="Preços, duração e disponibilidade"
      action={
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" /> Novo serviço
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(services ?? []).map((s) => (
          <div key={s.id} className="surface-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 gap-3">
                {(s.image_url || serviceImage(s.name)) && (
                  <img
                    src={s.image_url || serviceImage(s.name) || undefined}
                    alt={`Serviço ${s.name}`}
                    loading="lazy"
                    className="size-16 shrink-0 rounded-xl border border-border/70 object-cover object-top"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="font-display text-2xl leading-none">{s.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label={`Editar ${s.name}`} onClick={() => openEdit(s)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Excluir ${s.name}`} onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-display text-2xl text-primary">
                {s.price_cents > 0 ? brl(s.price_cents) : "Definir preço"}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" /> {s.duration_min} min
              </span>
            </div>
          </div>
        ))}
        {services?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>
              Edite o título, a descrição, o preço, a duração e a foto do serviço.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="service-name">Título do serviço</Label>
              <Input id="service-name" required placeholder="Ex.: CORTE MÁQUINA" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">Descrição</Label>
              <Textarea id="service-description" rows={2} placeholder="O que está incluído neste serviço" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service-price">Preço (R$)</Label>
                <Input id="service-price" required inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-duration">Duração (min)</Label>
                <Input id="service-duration" type="number" min={5} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Foto do serviço</Label>
              <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                <div className="aspect-square overflow-hidden rounded-lg border border-border bg-secondary/50">
                  {(form.image_url || serviceImage(form.name)) ? (
                    <img
                      src={form.image_url || serviceImage(form.name) || undefined}
                      alt="Prévia da foto do serviço"
                      className="size-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground"><ImagePlus className="size-8" /></div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="service-photo" className="sr-only">Enviar nova foto</Label>
                  <Input
                    id="service-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadPhoto(file);
                      e.currentTarget.value = "";
                    }}
                  />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Upload className="size-3.5" /> {uploading ? "Enviando foto..." : "JPG, PNG, WebP ou GIF, até 10 MB"}
                  </p>
                  <div className="flex items-center gap-2">
                    <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      type="url"
                      placeholder="https://exemplo.com/foto.jpg"
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    />
                    {form.image_url && (
                      <Button type="button" size="icon" variant="ghost" aria-label="Remover foto personalizada" title="Remover foto personalizada" onClick={() => void clearCustomPhoto()}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Banco de imagens padrão</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {DEFAULT_SERVICE_IMAGES.map((image) => {
                    const chosen = form.image_url === image.url;
                    return (
                      <Button
                        key={image.name}
                        type="button"
                        variant="outline"
                        className="relative h-auto flex-col overflow-hidden p-1"
                        title={`Usar imagem de ${image.name}`}
                        onClick={() => setForm((f) => ({ ...f, image_url: image.url }))}
                      >
                        <img src={image.url} alt={image.name} className="aspect-square w-full rounded object-cover object-top" />
                        <span className="w-full truncate px-1 py-1 text-[10px]">{image.name}</span>
                        {chosen && <span className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground"><Check className="size-3" /></span>}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Ao remover a foto personalizada, a imagem padrão correspondente ao nome do serviço volta automaticamente.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label>Serviço ativo na página pública</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <Button className="w-full" disabled={save.isPending}>
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
