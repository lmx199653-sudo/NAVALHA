/** Notificações push: permissão, assinatura do dispositivo e reagendamento do pedido. */
import { savePushSubscription } from "@/lib/push.functions";

export const VAPID_PUBLIC_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_VAPID_PUBLIC_KEY"]) ||
  "BEE59eSSlrngcxmOQ0LpF-6uj0XIrB-i0Mo8-cPqhPOnj7kvSkVoNZs0Vs9pY20SJf_UQZ8OcrjATRf0iu0Jt0M";

const ASK_AT_KEY = "navalha:push:askAt";
const DECLINES_KEY = "navalha:push:declines";
/** Espera curta e cíclica entre novos pedidos (ms) — insiste até aceitar. */
const RETRY_WAIT = 2 * 60_000;

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** true quando o app está aberto como aplicativo instalado (PWA/Capacitor). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isCapacitor = Boolean(
    (window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor,
  );
  return (
    iosStandalone ||
    isCapacitor ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true
  );
}

export function permission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/** Deve mostrar o pedido agora? Exibe se suportado e ainda não respondido ("default"). */
export function shouldAsk() {
  if (!pushSupported()) return false;
  if (Notification.permission === "granted" || Notification.permission === "denied") return false;
  const at = Number(localStorage.getItem(ASK_AT_KEY) ?? 0);
  return Date.now() >= at;
}

/** Registra a recusa e reagenda o pedido para poucos minutos depois. */
export function deferAsk() {
  const declines = Number(localStorage.getItem(DECLINES_KEY) ?? 0) + 1;
  localStorage.setItem(DECLINES_KEY, String(declines));
  localStorage.setItem(ASK_AT_KEY, String(Date.now() + RETRY_WAIT));
}

export function clearAsk() {
  localStorage.removeItem(ASK_AT_KEY);
  localStorage.removeItem(DECLINES_KEY);
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export type EnableResult = "granted" | "denied" | "unavailable";

/** Pede a permissão nativa e, se aceita, registra o dispositivo. */
export async function enablePush(barbershopId?: string | null): Promise<EnableResult> {
  if (!pushSupported()) return "unavailable";

  const result =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (result !== "granted") {
    deferAsk();
    return result === "denied" ? "denied" : "unavailable";
  }

  clearAsk();
  await registerDevice(barbershopId);
  return "granted";
}

/** Assina o push no navegador e guarda o dispositivo no backend. */
export async function registerDevice(barbershopId?: string | null) {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const registration = await getRegistration();
  if (!registration) return false;

  try {
    let subscription = await registration.pushManager.getSubscription();

    // Se já houver inscrição mas a chave do servidor for diferente, desinscreve para renovar com a nova chave VAPID
    if (subscription) {
      try {
        const rawKey = subscription.options?.applicationServerKey;
        if (rawKey) {
          const currentKeyBytes = new Uint8Array(rawKey);
          const targetKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          let match = currentKeyBytes.length === targetKeyBytes.length;
          if (match) {
            for (let i = 0; i < currentKeyBytes.length; i++) {
              if (currentKeyBytes[i] !== targetKeyBytes[i]) {
                match = false;
                break;
              }
            }
          }
          if (!match) {
            await subscription.unsubscribe();
            subscription = null;
          }
        }
      } catch {
        // Ignora erro de comparação e recria se necessário
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const p256dh = json.keys?.["p256dh"];
    const auth = json.keys?.["auth"];
    if (!json.endpoint || !p256dh || !auth) return false;

    await savePushSubscription({
      data: {
        endpoint: json.endpoint,
        p256dh,
        auth,
        barbershopId: barbershopId ?? null,
        userAgent: navigator.userAgent.slice(0, 300),
      },
    });
    return true;
  } catch (err) {
    console.error("[push] Erro ao registrar dispositivo:", err);
    return false;
  }
}

/** Remove a inscrição push deste dispositivo. */
export async function unregisterDevice() {
  if (!pushSupported()) return false;
  try {
    const registration = await getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      const { deletePushSubscription } = await import("@/lib/push.functions");
      await deletePushSubscription({ data: { endpoint } });
    }
    return true;
  } catch {
    return false;
  }
}
