import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Clock,
  Crown,
  CreditCard,
  Headset,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  Scissors,
  Settings,
  Users,
  UserSquare2,
} from "lucide-react";

import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { useIsSupport, useMyConversations, useInbox, useSupportRealtime } from "@/hooks/useSupport";
import { canManage } from "@/lib/supabase-guard";

import { BillingBanner } from "@/components/BillingBanner";

import { useBrand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/navalha-pro-logo.png.asset.json";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "Operação" | "Cadastros" | "Negócio" | "Ajuda";
};

const NAV: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Operação" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, group: "Operação" },
  { to: "/link", label: "Link cliente", icon: Link2, group: "Operação" },
  { to: "/clientes", label: "Clientes", icon: Users, group: "Cadastros" },
  { to: "/barbeiros", label: "Profissionais", icon: UserSquare2, group: "Cadastros" },
  { to: "/servicos", label: "Serviços", icon: Scissors, group: "Cadastros" },
  { to: "/horarios", label: "Horários", icon: Clock, group: "Cadastros" },
  { to: "/financeiro", label: "Financeiro", icon: BarChart3, group: "Negócio" },
  { to: "/assinaturas", label: "Assinaturas", icon: Crown, group: "Negócio" },
  { to: "/cobranca", label: "Cobrança", icon: CreditCard, group: "Negócio" },
  { to: "/marketing", label: "Marketing", icon: Megaphone, group: "Negócio" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, group: "Negócio" },
  { to: "/suporte-chat", label: "Suporte", icon: Headset, group: "Ajuda" },
] as const;

const SUPPORT_INBOX_ITEM: NavItem = {
  to: "/suporte-inbox",
  label: "Inbox suporte",
  icon: Inbox,
  group: "Ajuda",
};

const NAV_GROUPS = ["Operação", "Cadastros", "Negócio", "Ajuda"] as const;

const MOBILE_NAV = [NAV[0]!, NAV[1]!, NAV[2]!, NAV[3]!] as const;

/** Menu completo + contadores de mensagens não lidas (barbeiro e equipe de suporte). */
function useNav() {
  const { data: isSupport } = useIsSupport();
  const { data: mine } = useMyConversations();
  const { data: inbox } = useInbox(!!isSupport);
  useSupportRealtime(true);
  const items = useMemo(() => (isSupport ? [...NAV, SUPPORT_INBOX_ITEM] : [...NAV]), [isSupport]);
  const badges: Record<string, number> = {
    "/suporte-chat": (mine ?? []).reduce((t, c) => t + c.barber_unread, 0),
    "/suporte-inbox": (inbox ?? []).reduce((t, c) => t + c.support_unread, 0),
  };
  return { items, badges };
}

function NavBadge({ count }: { count?: number | undefined }) {
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold leading-4 text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function BrandMark({
  shop,
  size = "md",
}: {
  shop?: { name?: string | null; logo_url?: string | null } | null | undefined;
  size?: "md" | "sm";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20",
          size === "md" ? "size-9" : "size-8",
        )}
      >
        <img
          src={shop?.logo_url ?? logoAsset.url}
          alt={shop?.name ? `Logo ${shop.name}` : "NAVALHA PRO"}
          className={cn("object-contain", size === "md" ? "size-6" : "size-5")}
        />
      </span>
      <span
        className={cn(
          "min-w-0 truncate font-display leading-none tracking-wide",
          size === "md" ? "text-[1.35rem]" : "text-xl",
        )}
      >
        {shop?.name ? (
          shop.name.toUpperCase()
        ) : (
          <>
            NAVALHA <span className="text-primary">PRO</span>
          </>
        )}
      </span>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { data: shop } = useShop();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const { items: navItems, badges: navBadges } = useNav();
  useBrand(shop);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-4 pb-4 pt-5">
          <BrandMark shop={shop} />
        </div>
        <div className="gold-line mx-4 h-px opacity-60" />
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group}>
              <p className="eyebrow px-2.5 pb-1.5 text-[10px] text-sidebar-foreground/40">
                {group}
              </p>
              <div className="space-y-0.5">
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const active = pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          active && "bg-sidebar-accent font-medium text-primary",
                        )}
                      >
                        {active && (
                          <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
                        )}
                        <item.icon
                          className={cn(
                            "size-4 transition-colors",
                            active
                              ? "text-primary"
                              : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                          )}
                        />
                        {item.label}
                        <NavBadge count={navBadges[item.to]} />
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
          {(
            <div>
              <p className="eyebrow px-2.5 pb-1.5 text-[10px] text-sidebar-foreground/40">
                Cliente
              </p>
              <Link
                to="/agendar"
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  pathname.startsWith("/agendar") && "bg-sidebar-accent font-medium text-primary",
                )}
              >
                <CalendarPlus className="size-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground" />
                Página do cliente
              </Link>
            </div>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-sidebar-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:flex sm:flex-wrap sm:justify-between sm:px-6 sm:py-4">
            <div className="min-w-0">
              <div className="mb-1 lg:hidden">
                <BrandMark shop={shop} size="sm" />
              </div>
              <h1 className="truncate font-display text-[1.75rem] leading-none sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 truncate text-[13px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!canManage() && (
                <span className="hidden rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground sm:inline">
                  Somente visualização
                </span>
              )}
              {action}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={signOut}
                aria-label="Sair"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 sm:pt-5 lg:pb-10">
          <BillingBanner />
          <div className="animate-rise">{children}</div>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <item.icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground",
                  !MOBILE_NAV.some((i) => pathname.startsWith(i.to)) && "text-primary",
                )}
              >
                {!MOBILE_NAV.some((i) => pathname.startsWith(i.to)) && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                )}
                <span className="flex size-7 items-center justify-center rounded-lg">
                  <Menu className="size-5" />
                </span>
                Mais
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="pb-safe max-h-[85vh] overflow-y-auto rounded-t-3xl border-border/70 bg-card px-0"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
              <SheetHeader className="px-5 pb-2">
                <SheetTitle className="flex items-center justify-center">
                  <BrandMark shop={shop} size="sm" />
                </SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2 px-4 pb-6">
                {(
                  <Link
                    to="/agendar"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "surface-row flex flex-col items-center gap-2 px-2 py-4 text-center text-xs text-foreground/85",
                      pathname.startsWith("/agendar") && "border-primary/50 text-primary",
                    )}
                  >
                    <CalendarPlus className="size-5" />
                    <span className="leading-tight">Página do cliente</span>
                  </Link>
                )}
                {navItems.map((item) => {
                  const active = pathname.startsWith(item.to);
                  const count = navBadges[item.to];
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "surface-row relative flex flex-col items-center gap-2 px-2 py-4 text-center text-xs text-foreground/85",
                        active && "border-primary/50 bg-primary/10 text-primary",
                      )}
                    >
                      {count ? (
                        <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                      <item.icon className="size-5" />
                      <span className="leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="surface-row flex flex-col items-center gap-2 px-2 py-4 text-center text-xs text-destructive"
                >
                  <LogOut className="size-5" />
                  <span className="leading-tight">Sair</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
