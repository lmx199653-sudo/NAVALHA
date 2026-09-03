import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { buildPixPayload, normalizePixKey, pixTypeLabel } from "@/lib/pix";
import { cn } from "@/lib/utils";

type Props = {
  pixKey: string;
  pixKeyType: string | null | undefined;
  holderName?: string | null | undefined;
  amountCents?: number | undefined;
  description?: string | undefined;
  /** Mostra também a chave Pix "crua" com botão "Copiar chave". */
  showKey?: boolean | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
};

/** QR Code Pix (BR Code) com valor embutido + "copia e cola" (+ chave opcional). Pagamento direto ao barbeiro. */
export function PixQrCard({
  pixKey,
  pixKeyType,
  holderName,
  amountCents,
  description,
  showKey,
  compact,
  className,
}: Props) {
  const [copied, setCopied] = useState<"code" | "key" | null>(null);
  const key = normalizePixKey(pixKey, pixKeyType);
  const payload = useMemo(
    () => buildPixPayload({ key: pixKey, keyType: pixKeyType, holderName, amountCents, description }),
    [pixKey, pixKeyType, holderName, amountCents, description],
  );

  async function copy(kind: "code" | "key") {
    try {
      await navigator.clipboard.writeText(kind === "code" ? payload : key);
      setCopied(kind);
      toast.success(kind === "code" ? "Código Pix copiado" : "Chave Pix copiada");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className={cn("rounded-xl border border-primary/40 bg-primary/5", compact ? "p-3" : "p-4", className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ScanLine className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pix{showKey ? ` · ${pixTypeLabel(pixKeyType)}` : " · QR Code"}
          </p>
          {holderName && <p className="truncate text-sm">{holderName}</p>}
        </div>
        {amountCents !== undefined && (
          <span className="font-display text-2xl text-primary">{brl(amountCents)}</span>
        )}
      </div>
      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-foreground p-2">
          <QRCodeSVG value={payload} size={compact ? 140 : 180} level="M" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">
            Aponte a câmera do app do banco para o QR Code{amountCents ? " — o valor já vem preenchido" : ""}.
            Ou use o código abaixo em “Pix copia e cola”.
          </p>
          <code className="block max-h-16 overflow-hidden break-all rounded-lg bg-background/70 px-3 py-2 text-[10px] leading-tight text-muted-foreground">
            {payload}
          </code>
          <Button type="button" size="sm" variant={showKey ? "outline" : "default"} onClick={() => copy("code")} className="w-full sm:w-auto">
            {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "code" ? "Copiado" : "Copiar código Pix"}
          </Button>
        </div>
      </div>
      {showKey && (
        <div className="mt-3 border-t border-primary/20 pt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Ou copie a chave e pague pelo app do banco:</p>
          <code className="block select-all break-all rounded-lg bg-background/70 px-3 py-2 text-sm">
            {key}
          </code>
          <Button type="button" size="sm" onClick={() => copy("key")} className="mt-2 w-full">
            {copied === "key" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "key" ? "Copiado" : "Copiar chave"}
          </Button>
        </div>
      )}
    </div>
  );
}
