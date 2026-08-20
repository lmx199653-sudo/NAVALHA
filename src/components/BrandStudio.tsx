import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Sliders, Upload } from "lucide-react";
import {
  BRAND_FONTS,
  DEFAULT_BRAND,
  type Brand,
  applyBrand,
  fileToDataUrl,
  normalizeLogo,
} from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  shopName: string;
  value: Brand;
  onChange: (brand: Brand) => void;
  /** Persistência opcional (usada nas Configurações). */
  onSave?: (brand: Brand) => Promise<void> | void;
  saving?: boolean;
  /** Permite enviar a logo (desativado na criação da barbearia). */
  allowLogoUpload?: boolean;
};

export function BrandStudio({ shopName, value, onChange, onSave, saving, allowLogoUpload = true }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState(false);

  const name = value.name || shopName;

  function pick(logo: string) {
    const next = { ...value, name, logo_url: logo };
    onChange(next);
    applyBrand(next);
    toast.success("Identidade visual aplicada!");
  }

  async function upload(file: File) {
    try {
      const raw = await fileToDataUrl(file);
      const logo = await normalizeLogo(raw);
      pick(logo);
    } catch {
      toast.error("Não foi possível ler a imagem.");
    }
  }

  function patch(p: Partial<Brand>) {
    const next = { ...value, ...p, name };
    onChange(next);
    applyBrand(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">Identidade visual</h3>
          <p className="text-xs text-muted-foreground">
            Envie sua logo e ajuste as cores da sua barbearia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {value.logo_url && (
            <img
              src={value.logo_url}
              alt="Logo da barbearia"
              className="size-14 rounded-lg border border-border bg-secondary object-contain p-1"
            />
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setCustom((c) => !c)}>
            <Sliders className="size-4" /> Personalizar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <ColorField label="Cor principal" value={value.accent_color} onChange={(v) => patch({ accent_color: v })} />
          {custom && (
            <>
              <ColorField
                label="Cor secundária"
                value={value.secondary_color}
                onChange={(v) => patch({ secondary_color: v })}
              />
              <ColorField label="Cor de fundo" value={value.bg_color} onChange={(v) => patch({ bg_color: v })} />
            </>
          )}
        </div>

        {custom && (
          <div className="space-y-2">
            <Label>Tipografia</Label>
            <div className="flex flex-wrap gap-2">
              {BRAND_FONTS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => patch({ font_family: f.value })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    value.font_family === f.value ? "border-primary bg-primary/10 text-primary" : "border-border",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> Enviar minha logo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        {value.logo_url && (
          <Button type="button" variant="ghost" onClick={() => patch({ logo_url: null })}>
            Remover logo
          </Button>
        )}
        {onSave && (
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void onSave({ ...value, name })}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar identidade
          </Button>
        )}
      </div>

      {!value.logo_url && (
        <p className="text-xs text-muted-foreground">
          Sem logo? Sem problema — usamos a identidade padrão até você enviar a sua.
        </p>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="text-xs text-muted-foreground">Pré-visualização</span>
        <div className="flex items-center gap-2 rounded-md px-3 py-2" style={{ backgroundColor: value.bg_color }}>
          {value.logo_url ? (
            <img src={value.logo_url} alt="Logo" className="size-7 object-contain" />
          ) : (
            <span className="size-7 rounded-full" style={{ backgroundColor: value.accent_color }} />
          )}
          <span
            className="text-lg leading-none"
            style={{ color: value.accent_color, fontFamily: `"${value.font_family}", sans-serif` }}
          >
            {(name || "Sua Barbearia").toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function emptyBrand(name = ""): Brand {
  return { ...DEFAULT_BRAND, name };
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded-md border border-input bg-transparent"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}
