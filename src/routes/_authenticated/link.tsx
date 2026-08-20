import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { useShop } from "@/hooks/useShop";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/link")({
  component: ClientLinkPage,
});

function ClientLinkPage() {
  const { data: shop } = useShop();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = shop ? `${origin}/barbearia/${shop.slug}` : "";
  const message = `Agende seu horário na ${shop?.name ?? "barbearia"}: ${url}`;

  return (
    <AppShell title="Link para cliente" subtitle="Compartilhe e receba agendamentos online">
      <div className="mx-auto max-w-2xl">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-border/70 bg-primary/10 px-5 py-6 text-center">
            <h2 className="font-display text-3xl">Seu link de agendamento está pronto!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Envie este link para seus clientes. Eles podem escolher o serviço, profissional e
              horários disponíveis e confirmar o agendamento online.
            </p>
          </div>

          <div className="space-y-5 p-5">
            <p className="break-all rounded-xl border border-primary/30 bg-secondary/50 p-4 text-center text-sm text-primary">
              {url || "Carregando…"}
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success("Link copiado");
                }}
                disabled={!url}
              >
                <Copy className="size-4" /> Copiar link
              </Button>
              <Button size="lg" variant="outline" asChild disabled={!url}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> Compartilhar no WhatsApp
                </a>
              </Button>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/70 bg-secondary/30 p-5">
              <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <QrCode className="size-4" /> QR Code da página
              </span>
              {url && (
                <div className="rounded-xl bg-white p-3">
                  <QRCodeCanvas value={url} size={180} includeMargin={false} />
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Imprima e deixe no balcão — o cliente aponta a câmera e agenda sozinho.
              </p>
            </div>

            <Button variant="ghost" className="w-full" asChild disabled={!url}>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Ver a página do cliente
              </a>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
