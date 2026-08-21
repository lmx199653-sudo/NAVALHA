import { Link } from "@tanstack/react-router";
import { Lock, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * Mensagem exibida quando o gerenciamento é acessado pelo navegador.
 * Alterações administrativas só ficam disponíveis no app instalado.
 */
export function ManageLockNotice() {
  const { canInstall, promptInstall, isIos } = usePwaInstall();

  return (
    <div className="surface-card mx-auto max-w-xl border-primary/40 p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Lock className="size-6" />
      </span>
      <h2 className="mt-4 font-display text-3xl leading-tight">Gerenciamento só pelo app</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Para editar, cadastrar ou alterar qualquer informação da barbearia é necessário instalar o
        app Navalha Pro e fazer login por ele. Pelo site você pode continuar visualizando o
        Dashboard normalmente.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        {canInstall && !isIos ? (
          <Button onClick={() => void promptInstall()}>
            <Smartphone className="size-4" /> Instalar app
          </Button>
        ) : (
          <Button asChild>
            <Link to="/instalar-app">
              <Smartphone className="size-4" /> Instalar app
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
