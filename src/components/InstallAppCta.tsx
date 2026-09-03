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
    <div className="surface-card relative mb-4 flex flex-col gap-3 border-primary/30 p-3.5 sm:flex-row sm:items-center sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15">
          <Smartphone className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1 pr-6 sm:pr-0">
          <p className="truncate font-display text-lg leading-tight">Gerencie pelo celular</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Instale o Navalha Pro na tela inicial e receba avisos de novos agendamentos.
          </p>
        </div>
      </div>
      <div className="ml-auto hidden shrink-0 gap-2 sm:flex">
        {canInstall && !isIos ? (
          <Button size="sm" onClick={() => void promptInstall()}>
            Instalar
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link to="/instalar-app">Instalar</Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Agora não
        </Button>
      </div>
      <div className="flex gap-2 sm:hidden">
        {canInstall && !isIos ? (
          <Button size="sm" className="flex-1" onClick={() => void promptInstall()}>
            Instalar
          </Button>
        ) : (
          <Button size="sm" className="flex-1" asChild>
            <Link to="/instalar-app">Instalar</Link>
          </Button>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
