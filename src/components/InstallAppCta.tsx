import { Link } from "@tanstack/react-router";
import { Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

const KEY = "navalha:install-cta-dismissed";

/**
 * CTA opcional para instalar o app (PWA) na área administrativa.
 * Não aparece se o app já estiver instalado ou se o usuário dispensar.
 */
export function InstallAppCta() {
  const { installed, canInstall, promptInstall, isIos } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(KEY) === "1");
  }, []);

  if (installed || dismissed) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="surface-card relative mb-4 flex flex-col gap-3 border-primary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 pr-6">
        <span className="rounded-lg bg-primary/15 p-2 text-primary">
          <Smartphone className="size-5" />
        </span>
        <div>
          <p className="font-display text-xl leading-tight">Gerencie pelo celular</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Instale o Navalha Pro na tela inicial e comece grátis por 60 dias. Abre mais rápido,
            funciona em tela cheia e recebe avisos de novos agendamentos. Você pode continuar
            usando pelo navegador.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {canInstall && !isIos ? (
          <Button size="sm" onClick={() => void promptInstall()}>
            Instalar app
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link to="/instalar-app">Instalar app</Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Agora não
        </Button>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground sm:hidden"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
