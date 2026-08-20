/** Notificações push: permissão, assinatura do dispositivo e reagendamento do pedido. */
import { savePushSubscription } from "@/lib/push.functions";

export const VAPID_PUBLIC_KEY =
  "BAq8mKNV7WP4bKM6nIkFJngMaD6trRyhb_oK4YVtfPMzPqp6SYvgvWY1XUDygiu7npgNOkhqCHzfH89nU7dhawI";

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

/** true apenas quando o app está aberto como aplicativo instalado (não no navegador/preview). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true
  );
}

export function permission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/** Deve mostrar o pedido agora? Só no app instalado, e insistentemente até aceitar. */
export function shouldAsk() {
  if (!pushSupported() || !isStandalone()) return false;
  if (Notification.permission === "granted") return false;
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
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

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
  } catch {
    return false;
  }
}
