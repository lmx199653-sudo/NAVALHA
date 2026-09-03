import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import logoAsset from "@/assets/navalha-pro-logo.png.asset.json";
import { LEGAL, LEGAL_LINKS, formatLegalDate } from "@/lib/legal";

type Props = {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  showUpdated?: boolean;
};

/** Layout público compartilhado pelas páginas legais/suporte. */
export function LegalLayout({ eyebrow, title, intro, children, showUpdated = true }: Props) {
  return (
    <div className="grid-noise min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="" className="size-7 object-contain" />
            <span className="font-display text-xl leading-none tracking-wide">
              NAVALHA <span className="text-primary">PRO</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="animate-rise">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="font-display text-4xl leading-none tracking-wide sm:text-5xl">{title}</h1>
          {intro && (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {intro}
            </p>
          )}
          {showUpdated && (
            <p className="mt-3 text-xs text-muted-foreground/80">
              Última atualização: {formatLegalDate()}
            </p>
          )}
          <div className="gold-line mt-6" />
        </div>

        <article className="legal-prose mt-8 space-y-8">{children}</article>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
          <a href={`mailto:${LEGAL.supportEmail}`} className="hover:text-foreground">
            {LEGAL.supportEmail}
          </a>
        </div>
      </footer>

      <style>{`
        .legal-prose h2 { font-family: var(--font-display); font-size: 1.5rem; letter-spacing: .02em; line-height: 1.1; margin-bottom: .6rem; }
        .legal-prose h3 { font-weight: 600; font-size: .95rem; margin-top: 1rem; margin-bottom: .35rem; }
        .legal-prose p, .legal-prose li { font-size: .925rem; line-height: 1.7; color: color-mix(in oklab, var(--foreground) 82%, transparent); }
        .legal-prose ul { list-style: disc; padding-left: 1.25rem; display: grid; gap: .35rem; }
        .legal-prose a { color: var(--primary); text-underline-offset: 3px; }
        .legal-prose a:hover { text-decoration: underline; }
        .legal-prose table { width: 100%; border-collapse: collapse; font-size: .85rem; }
        .legal-prose th, .legal-prose td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid color-mix(in oklab, var(--border) 70%, transparent); vertical-align: top; }
        .legal-prose th { color: var(--muted-foreground); font-weight: 600; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; }
      `}</style>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2>{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function legalHead(title: string, description: string) {
  const full = `${title} — NAVALHA PRO`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
