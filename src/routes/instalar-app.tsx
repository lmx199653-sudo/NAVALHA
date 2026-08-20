import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Smartphone, ArrowLeft, ListOrdered, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { isPreviewContext } from "@/lib/pwa";
import { getInstallGuide, type InstallGuide } from "@/lib/browser-install";
import { toast } from "sonner";
import logoAsset from "@/assets/navalha-pro-logo.png.asset.json";

export const Route = createFileRoute("/instalar-app")({
  head: () => {
    const title = "Instalar App — NAVALHA PRO";
    const description =
      "Instale o app da sua barbearia na tela inicial do celular em qualquer navegador.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: InstallAppPage,
});

function InstallAppPage() {
  const { installed, canInstall, promptInstall } = usePwaInstall();
  const [showManual, setShowManual] = useState(false);
  const [guide, setGuide] = useState<InstallGuide | null>(null);

  useEffect(() => {
    const g = getInstallGuide();
    setGuide(g);
    // Navegador embutido de outro app nunca instala: já mostra o caminho certo.
    if (g.needsOtherBrowser) setShowManual(true);
  }, []);

  async function install() {
    if (isPreviewContext()) {
      setShowManual(true);
      toast.info("Abra o endereço público do app para instalar", {
        description:
          "Dentro do editor/preview o navegador não oferece a instalação. Abra o link público do seu sistema no navegador do celular.",
        duration: 9000,
      });
      return;
    }
    const result = await promptInstall();
    if (result === "accepted") {
      toast.success("APP instalado com sucesso ✓");
      return;
    }
    setShowManual(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/instalar-app");
      toast.success("Link copiado", {
        description: "Cole no Chrome (Android) ou Safari (iPhone) para instalar.",
      });
    } catch {
      toast.info("Copie o endereço da barra do navegador e abra no Chrome ou Safari.");
    }
  }

  return (
    <div className="grid-noise flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Smartphone className="size-10" />
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">Seu app está pronto!</h1>
          <p className="text-sm text-muted-foreground">
            O app não está publicado na Google Play: a instalação é feita diretamente pelo
            navegador, em poucos segundos — funciona no Chrome, Safari, Samsung Internet, Edge,
            Firefox e Opera.
          </p>
          <p className="text-sm text-muted-foreground">
            Siga as instruções do celular para concluir a instalação.
          </p>
        </div>

        <Button
          size="lg"
          className="h-16 w-full text-lg uppercase tracking-widest"
          onClick={install}
          disabled={installed}
        >
          {installed ? "App instalado" : "Instalar app"}
        </Button>

        {!installed && !canInstall && !showManual && (
          <button
            onClick={() => setShowManual(true)}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Instalar manualmente pelo navegador
          </button>
        )}

        {!installed && showManual && guide && (
          <div className="space-y-4 rounded-xl border border-border bg-secondary/40 p-4 text-left">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ListOrdered className="size-4 text-primary" />
                Como instalar no {guide.label}
              </p>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                {guide.steps.map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-display text-primary">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {guide.needsOtherBrowser && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={copyLink}>
                  <Copy className="mr-2 size-4" /> Copiar link
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/instalar-app" target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 size-4" /> Abrir no navegador
                  </a>
                </Button>
              </div>
            )}

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-primary">
                Uso outro navegador
              </summary>
              <ul className="mt-2 space-y-1">
                <li>Chrome / Edge / Firefox (Android): menu ⋮ → Instalar app.</li>
                <li>Samsung Internet: menu ☰ → Adicionar página a → Tela inicial.</li>
                <li>Opera: menu → Adicionar a → Tela inicial.</li>
                <li>iPhone (Safari ou Chrome): Compartilhar → Adicionar à Tela de Início.</li>
              </ul>
            </details>
          </div>
        )}

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Voltar para o site
        </Link>
      </div>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        <span className="flex items-center justify-center gap-2 font-display text-2xl text-foreground">
          <img src={logoAsset.url} alt="NAVALHA PRO" className="size-6 shrink-0 object-contain" />{" "}
          NAVALHA PRO
        </span>
      </footer>
    </div>
  );
}
