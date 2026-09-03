import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useShop } from "@/hooks/useShop";
import {
  deferAsk,
  enablePush,
  isStandalone,
  permission,
  registerDevice,
  shouldAsk,
} from "@/lib/push";

/**
 * Pede permissão de notificações apenas no app instalado (PWA), de forma insistente:
 * volta a aparecer a cada abertura e a cada poucos minutos até o usuário aceitar.
 */
export function PushPermissionPrompt() {
  const { data: shop } = useShop();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const state = permission();
    if (state === "unsupported" || !isStandalone()) return;
    if (state === "granted") {
      void registerDevice(shop?.id ?? null);
      return;
    }
    setBlocked(state === "denied");

    const evaluate = () => {
      if (permission() === "granted") {
        setOpen(false);
        return;
      }
      setBlocked(permission() === "denied");
      if (shouldAsk()) setOpen(true);
    };

    const first = window.setTimeout(evaluate, 2500);
    const interval = window.setInterval(evaluate, 30_000);
    const onFocus = () => evaluate();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [shop?.id]);

  async function accept() {
    setBusy(true);
    const result = await enablePush(shop?.id ?? null);
    setBusy(false);
    setOpen(false);
    if (result === "granted") {
      toast.success("Notificações ativadas ✓", {
        description: "Você será avisado sobre novos agendamentos.",
      });
    } else if (result === "denied") {
      setBlocked(true);
      toast.info("Notificações bloqueadas neste dispositivo", {
        description:
          "Abra as configurações do app/navegador → Notificações → Permitir para voltar a receber avisos.",
        duration: 8000,
      });
    } else {
      toast.info("Não foi possível ativar agora", {
        description: "Tente novamente pelo app instalado na tela inicial.",
        duration: 8000,
      });
    }
  }

  function later() {
    deferAsk();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 sm:p-0">
      <div className="surface-card relative border-primary/25 p-4 shadow-2xl backdrop-blur">
        <button
          onClick={later}
          aria-label="Agora não"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/15">
            <Bell className="size-5" />
          </span>
          <div className="space-y-1 pr-6">
            <p className="font-display text-xl leading-tight">
              {blocked ? "Notificações bloqueadas" : "Ativar notificações"}
            </p>
            <p className="text-sm text-muted-foreground">
              {blocked
                ? "Nas configurações do dispositivo, abra NAVALHA PRO → Notificações → Permitir para receber os avisos de novos agendamentos."
                : "Os avisos de novos agendamentos, cancelamentos e lembretes só chegam com a permissão ativada."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {blocked ? (
            <Button className="flex-1 uppercase tracking-wider" onClick={later}>
              Entendi
            </Button>
          ) : (
            <>
              <Button className="flex-1 uppercase tracking-wider" onClick={accept} disabled={busy}>
                {busy ? "Ativando..." : "Permitir"}
              </Button>
              <Button variant="ghost" onClick={later} disabled={busy}>
                Agora não
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
