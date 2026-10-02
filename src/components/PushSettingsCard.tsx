import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, CheckCircle2, AlertCircle, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/states";
import { useShop } from "@/hooks/useShop";
import {
  enablePush,
  permission,
  pushSupported,
  registerDevice,
  unregisterDevice,
} from "@/lib/push";
import {
  sendTestPushNotification,
  getPushSubscriptionCount,
} from "@/lib/push.functions";

export function PushSettingsCard() {
  const { data: shop } = useShop();
  const [supported, setSupported] = useState(true);
  const [currentPermission, setCurrentPermission] = useState<NotificationPermission | "unsupported">("default");
  const [activeDeviceCount, setActiveDeviceCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshStatus = async () => {
    const isSup = pushSupported();
    setSupported(isSup);
    if (!isSup) {
      setCurrentPermission("unsupported");
      return;
    }
    const perm = permission();
    setCurrentPermission(perm);

    try {
      const { count } = await getPushSubscriptionCount();
      setActiveDeviceCount(count);
    } catch {
      // Falha silenciosa na contagem
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, [shop?.id]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await enablePush(shop?.id ?? null);
      if (res === "granted") {
        toast.success("Notificações push ativadas!", {
          description: "Este dispositivo agora receberá alertas sonoros e visuais de novos agendamentos.",
        });
      } else if (res === "denied") {
        toast.error("Notificações bloqueadas no navegador", {
          description: "Clique no ícone de cadeado/configurações da barra de endereço para permitir notificações.",
        });
      } else {
        toast.info("Não foi possível ativar", {
          description: "Verifique as permissões de notificação do seu navegador.",
        });
      }
    } catch (err: any) {
      toast.error("Erro ao ativar notificações", {
        description: err?.message || "Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
      void refreshStatus();
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const ok = await unregisterDevice();
      if (ok) {
        toast.success("Dispositivo desvinculado", {
          description: "Você não receberá mais notificações push neste aparelho.",
        });
      }
    } finally {
      setLoading(false);
      void refreshStatus();
    }
  };

  const handleTestPush = async () => {
    setTesting(true);
    try {
      // Garante que o dispositivo atual está registrado no banco
      if (currentPermission === "granted") {
        await registerDevice(shop?.id ?? null);
      }

      const res = await sendTestPushNotification();
      if (res.ok) {
        toast.success("🔔 Notificação de teste disparada!", {
          description: `Enviada para ${res.sent} dispositivo(s). Verifique sua barra de notificações.`,
        });
      } else {
        toast.warning("Alerta de teste não entregue", {
          description: res.reason || "Nenhum dispositivo ativo encontrado para receber a notificação.",
        });
      }
    } catch (err: any) {
      toast.error("Erro ao disparar teste", {
        description: err?.message || "Falha ao enviar notificação de teste.",
      });
    } finally {
      setTesting(false);
      void refreshStatus();
    }
  };

  return (
    <div className="surface-card p-4 sm:p-5">
      <SectionHeader icon={BellRing} title="Notificações Push" />
      <p className="mt-2 text-sm text-muted-foreground">
        Receba avisos instantâneos com som na tela sempre que um cliente fizer um novo agendamento
        pelo link público, mesmo com o app ou navegador fechados em segundo plano.
      </p>

      <div className="mt-4 space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Status neste dispositivo
          </span>
          {currentPermission === "granted" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
              <CheckCircle2 className="size-3.5" />
              Ativas e funcionando
            </span>
          )}
          {currentPermission === "denied" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive ring-1 ring-destructive/20">
              <AlertCircle className="size-3.5" />
              Bloqueadas pelo navegador
            </span>
          )}
          {currentPermission === "default" && supported && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/20">
              <Bell className="size-3.5" />
              Pendente de ativação
            </span>
          )}
          {!supported && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              <BellOff className="size-3.5" />
              Navegador não compatível
            </span>
          )}
        </div>

        {activeDeviceCount !== null && activeDeviceCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Smartphone className="size-3.5 text-primary" />
            <span>
              <strong>{activeDeviceCount}</strong> dispositivo(s) cadastrado(s) para receber notificações na sua conta.
            </span>
          </p>
        )}

        {currentPermission === "denied" && (
          <p className="text-xs text-destructive">
            As notificações foram bloqueadas neste navegador. Para reativar, clique no ícone de permissões ao lado do link do site na barra de endereços e altere Notificações para <strong>Permitir</strong>.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {currentPermission !== "granted" && supported && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={handleEnable}
          >
            <BellRing className="size-4" />
            {loading ? "Ativando..." : "Ativar neste dispositivo"}
          </Button>
        )}

        {currentPermission === "granted" && (
          <>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={testing}
              onClick={handleTestPush}
            >
              <Send className="size-4" />
              {testing ? "Disparando..." : "Enviar notificação de teste"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto text-muted-foreground hover:text-foreground"
              disabled={loading}
              onClick={handleDisable}
            >
              <BellOff className="size-4" />
              {loading ? "Desativando..." : "Desativar neste aparelho"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
