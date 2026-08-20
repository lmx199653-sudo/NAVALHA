/** Registro do service worker + captura do evento de instalação (beforeinstallprompt). */
const SW_URL = "/sw.js";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isPreviewContext() {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev") ||
    new URL(window.location.href).searchParams.get("sw") === "off"
  );
}

/* ------------------------------------------------------------------ */
/* Captura do prompt nativo — precisa acontecer o mais cedo possível,  */
/* pois o navegador dispara o evento antes do React montar.           */
/* ------------------------------------------------------------------ */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function subscribeInstallState(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getInstallState() {
  return { canInstall: deferredPrompt !== null, installed };
}

export async function promptNativeInstall() {
  if (!deferredPrompt) return "unavailable" as const;
  const event = deferredPrompt;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      deferredPrompt = null;
      installed = true;
      emit();
      return "accepted" as const;
    }
    return "dismissed" as const;
  } catch {
    deferredPrompt = null;
    emit();
    return "unavailable" as const;
  }
}

if (typeof window !== "undefined") {
  installed = isStandalone();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

/* ------------------------------------------------------------------ */
/* Service worker                                                      */
/* ------------------------------------------------------------------ */

async function unregisterApp() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD || isPreviewContext()) {
    await unregisterApp();
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    /* noop */
  }
}
