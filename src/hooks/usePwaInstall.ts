import { useCallback, useEffect, useState } from "react";
import {
  getInstallState,
  isStandalone,
  promptNativeInstall,
  subscribeInstallState,
} from "@/lib/pwa";

/** Instalação nativa do PWA (Add to Home Screen). */
export function usePwaInstall() {
  const [state, setState] = useState({ canInstall: false, installed: false });

  useEffect(() => {
    const sync = () => {
      const s = getInstallState();
      setState({ canInstall: s.canInstall, installed: s.installed || isStandalone() });
    };
    sync();
    const unsubscribe = subscribeInstallState(sync);
    const onVisible = () => sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const promptInstall = useCallback(() => promptNativeInstall(), []);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) &&
      typeof navigator !== "undefined" &&
      (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);

  return { canInstall: state.canInstall, installed: state.installed, promptInstall, isIos };
}
