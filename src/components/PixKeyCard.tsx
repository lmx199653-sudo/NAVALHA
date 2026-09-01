import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { normalizePixKey, pixTypeLabel } from "@/lib/pix";
import { cn } from "@/lib/utils";

type Props = {
  pixKey: string;
  pixKeyType: string | null | undefined;
  holderName?: string | null | undefined;
  amountCents?: number | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
};

/** Exibe a chave Pix do barbeiro com botão de copiar — o pagamento vai direto para ele. */
export function PixKeyCard({ pixKey, pixKeyType, holderName, amountCents, compact, className }: Props) {
  const [copied, setCopied] = useState(false);
  const key = normalizePixKey(pixKey, pixKeyType);

  async function copy() {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      toast.success("Chave Pix copiada");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave e copie manualmente.");
    }
  }

  return (
    <div className={cn("rounded-xl border border-primary/40 bg-primary/5", compact ? "p-3" : "p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <QrCode className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pix · {pixTypeLabel(pixKeyType)}
          </p>
          {holderName && <p className="truncate text-sm">{holderName}</p>}
        </div>
        {amountCents !== undefined && (
          <span className="font-display text-2xl text-primary">{brl(amountCents)}</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-background/70 px-3 py-2 text-sm">
          {key}
        </code>
        <Button type="button" size={compact ? "sm" : "default"} onClick={copy} className="shrink-0">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
