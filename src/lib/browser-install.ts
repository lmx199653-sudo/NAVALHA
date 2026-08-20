/** Detecta o navegador do celular para dar instruções de instalação corretas. */
export type MobileBrowser =
  | "safari-ios"
  | "chrome-ios"
  | "other-ios"
  | "chrome-android"
  | "samsung"
  | "firefox-android"
  | "edge-android"
  | "opera-android"
  | "inapp"
  | "desktop"
  | "unknown";

export type InstallGuide = {
  browser: MobileBrowser;
  label: string;
  steps: string[];
  /** Quando true, o navegador não instala PWA — é preciso abrir em outro. */
  needsOtherBrowser: boolean;
};

export function detectMobileBrowser(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): MobileBrowser {
  const s = ua.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(s) ||
    (/macintosh/.test(s) &&
      typeof navigator !== "undefined" &&
      ((navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1);
  const isAndroid = /android/.test(s);

  const inApp =
    /fban|fbav|fb_iab|instagram|line\/|micromessenger|twitter|linkedinapp|snapchat|tiktok|pinterest|gsa\//.test(s) ||
    (/\bwv\b/.test(s) && isAndroid);

  if (inApp) return "inapp";

  if (isIos) {
    if (/crios/.test(s)) return "chrome-ios";
    if (/safari/.test(s) && !/fxios|edgios|opt\//.test(s)) return "safari-ios";
    return "other-ios";
  }

  if (isAndroid) {
    if (/samsungbrowser/.test(s)) return "samsung";
    if (/edga|edg\//.test(s)) return "edge-android";
    if (/opr\/|opera/.test(s)) return "opera-android";
    if (/firefox|fxios/.test(s)) return "firefox-android";
    if (/chrome/.test(s)) return "chrome-android";
    return "unknown";
  }

  if (/windows|macintosh|linux|cros/.test(s)) return "desktop";
  return "unknown";
}

const GUIDES: Record<MobileBrowser, Omit<InstallGuide, "browser">> = {
  "safari-ios": {
    label: "Safari (iPhone / iPad)",
    needsOtherBrowser: false,
    steps: [
      "Toque no ícone Compartilhar (quadrado com a seta para cima) na barra do Safari.",
      'Role a lista e escolha "Adicionar à Tela de Início".',
      'Toque em "Adicionar" no canto superior direito.',
    ],
  },
  "chrome-ios": {
    label: "Chrome (iPhone / iPad)",
    needsOtherBrowser: false,
    steps: [
      "Toque no ícone Compartilhar (quadrado com a seta) na barra do Chrome.",
      'Escolha "Adicionar à Tela de Início".',
      'Confirme em "Adicionar".',
    ],
  },
  "other-ios": {
    label: "Navegador do iPhone",
    needsOtherBrowser: false,
    steps: [
      "Toque no menu ou no ícone Compartilhar do navegador.",
      'Procure "Adicionar à Tela de Início".',
      "Se não encontrar, abra este mesmo link no Safari e repita os passos.",
    ],
  },
  "chrome-android": {
    label: "Chrome (Android)",
    needsOtherBrowser: false,
    steps: [
      "Toque no menu ⋮ no canto superior direito.",
      'Escolha "Instalar app" (ou "Adicionar à tela inicial").',
      'Confirme em "Instalar".',
    ],
  },
  samsung: {
    label: "Samsung Internet",
    needsOtherBrowser: false,
    steps: [
      "Toque no menu ☰ (três linhas) na barra inferior.",
      'Escolha "Adicionar página a" → "Tela inicial".',
      'Confirme em "Adicionar".',
    ],
  },
  "firefox-android": {
    label: "Firefox (Android)",
    needsOtherBrowser: false,
    steps: [
      "Toque no menu ⋮ no canto superior direito.",
      'Escolha "Instalar" ou "Adicionar à tela inicial".',
      "Confirme para criar o ícone do app.",
    ],
  },
  "edge-android": {
    label: "Microsoft Edge (Android)",
    needsOtherBrowser: false,
    steps: [
      "Toque no menu ☰ na barra inferior.",
      'Escolha "Adicionar ao telefone" / "Adicionar à tela inicial".',
      "Confirme para instalar.",
    ],
  },
  "opera-android": {
    label: "Opera (Android)",
    needsOtherBrowser: false,
    steps: [
      "Toque no menu do Opera (⋮ ou ícone do Opera).",
      'Escolha "Adicionar a" → "Tela inicial".',
      "Confirme para instalar.",
    ],
  },
  inapp: {
    label: "Navegador dentro de um app (Instagram, Facebook, WhatsApp…)",
    needsOtherBrowser: true,
    steps: [
      "Toque no menu ⋮ ou … no canto da tela.",
      'Escolha "Abrir no navegador" (Chrome no Android ou Safari no iPhone).',
      "Nesse navegador, volte a esta página e toque em INSTALAR APP.",
    ],
  },
  desktop: {
    label: "Computador",
    needsOtherBrowser: false,
    steps: [
      "Clique no ícone de instalação na barra de endereço (monitor com a seta).",
      'Ou abra o menu ⋮ → "Instalar NAVALHA PRO".',
      "Para usar no celular, abra este mesmo link no navegador do telefone.",
    ],
  },
  unknown: {
    label: "Seu navegador",
    needsOtherBrowser: false,
    steps: [
      "Abra o menu do navegador (⋮ ou ☰).",
      'Procure "Instalar app" ou "Adicionar à tela inicial".',
      "Confirme para criar o ícone na tela do celular.",
    ],
  },
};

export function getInstallGuide(browser = detectMobileBrowser()): InstallGuide {
  return { browser, ...GUIDES[browser] };
}
