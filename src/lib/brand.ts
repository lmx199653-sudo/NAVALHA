import { useEffect } from "react";

export type Brand = {
  name: string;
  logo_url: string | null;
  accent_color: string;
  secondary_color: string;
  bg_color: string;
  font_family: string;
};

export const BRAND_STYLES = [
  { value: "premium", label: "Premium" },
  { value: "moderno", label: "Moderno" },
  { value: "classico", label: "Clássico" },
  { value: "street", label: "Street" },
  { value: "minimalista", label: "Minimalista" },
] as const;

export const BRAND_SYMBOLS = [
  { value: "navalha", label: "Navalha" },
  { value: "tesoura", label: "Tesoura" },
  { value: "pente", label: "Pente" },
  { value: "barba", label: "Barba" },
  { value: "monograma", label: "Monograma" },
  { value: "livre", label: "Livre" },
] as const;

export const BRAND_FONTS = [
  { value: "Bebas Neue", label: "Bebas Neue (impacto)" },
  { value: "Oswald", label: "Oswald (condensada)" },
  { value: "Playfair Display", label: "Playfair (clássica)" },
  { value: "Barlow", label: "Barlow (neutra)" },
] as const;

export const DEFAULT_BRAND: Brand = {
  name: "",
  logo_url: null,
  accent_color: "#E3B341",
  secondary_color: "#C08A2E",
  bg_color: "#0D0D10",
  font_family: "Bebas Neue",
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = Number.parseInt(full.slice(0, 6) || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Texto legível sobre uma cor qualquer. */
export function readableOn(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111114" : "#FFFFFF";
}

export function mixWithBg(hex: string, bg: string, amount: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(bg);
  const ch = (x: number, y: number) => Math.round(y + (x - y) * amount);
  return `#${[ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Aplica a identidade visual da barbearia nas variáveis de tema. */
export function applyBrand(brand: Partial<Brand> | null | undefined, el?: HTMLElement | null) {
  if (typeof document === "undefined") return;
  const root = el ?? document.documentElement;
  const b = { ...DEFAULT_BRAND, ...(brand ?? {}) };

  root.style.setProperty("--primary", b.accent_color);
  root.style.setProperty("--primary-foreground", readableOn(b.accent_color));
  root.style.setProperty("--ring", b.accent_color);
  root.style.setProperty("--accent", b.secondary_color);
  root.style.setProperty("--accent-foreground", readableOn(b.secondary_color));
  root.style.setProperty("--background", b.bg_color);
  root.style.setProperty("--card", mixWithBg("#FFFFFF", b.bg_color, 0.06));
  root.style.setProperty("--popover", mixWithBg("#FFFFFF", b.bg_color, 0.06));
  root.style.setProperty("--secondary", mixWithBg("#FFFFFF", b.bg_color, 0.1));
  root.style.setProperty("--muted", mixWithBg("#FFFFFF", b.bg_color, 0.1));
  root.style.setProperty("--border", mixWithBg("#FFFFFF", b.bg_color, 0.14));
  root.style.setProperty("--input", mixWithBg("#FFFFFF", b.bg_color, 0.14));
  root.style.setProperty("--sidebar", mixWithBg("#FFFFFF", b.bg_color, 0.03));
  root.style.setProperty("--sidebar-primary", b.accent_color);
  root.style.setProperty("--sidebar-ring", b.accent_color);
  root.style.setProperty("--font-display", `"${b.font_family}", ui-sans-serif, system-ui`);
}

function setFavicon(url: string) {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='apple-touch-icon']")
    .forEach((l) => l.remove());
  for (const rel of ["icon", "apple-touch-icon"]) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = url;
    link.type = "image/png";
    document.head.appendChild(link);
  }
}

/** Mantém o manifesto estático (instalável) e só ajusta a cor do tema. */
function setManifest(brand: Brand) {
  if (typeof document === "undefined") return;
  let theme = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
  if (!theme) {
    theme = document.createElement("meta");
    theme.name = "theme-color";
    document.head.appendChild(theme);
  }
  theme.content = brand.accent_color;
}

/** Aplica a identidade em tema, favicon, PWA e fontes. */
export function useBrand(brand: Partial<Brand> | null | undefined) {
  const key = JSON.stringify(brand ?? {});
  useEffect(() => {
    if (!brand) return;
    const b = { ...DEFAULT_BRAND, ...brand };
    applyBrand(b);
    if (b.logo_url) setFavicon(b.logo_url);
    setManifest(b);
    const id = "brand-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;600&family=Playfair+Display:wght@600;700&family=Barlow:wght@400;600&display=swap";
      document.head.appendChild(link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Normaliza a logo: recorta o fundo branco (transparência), quadra e reduz
 * para 512px — bom para web, favicon e PWA.
 */
export async function normalizeLogo(dataUrl: string, size = 512): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    i.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  try {
    const frame = ctx.getImageData(0, 0, size, size);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      if (min > 236 && max - min < 12) d[i + 3] = 0;
      else if (min > 216 && max - min < 16) d[i + 3] = Math.round(d[i + 3]! * 0.4);
    }
    ctx.putImageData(frame, 0, 0);
  } catch {
    /* imagem de outra origem: mantém como está */
  }

  return canvas.toDataURL("image/png");
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
