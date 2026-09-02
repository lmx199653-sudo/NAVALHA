import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Clock,
  Crown,
  Repeat,
  
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  Scissors,
  Settings,
  Smartphone,
  Users,
  UserSquare2,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { canManage } from "@/lib/supabase-guard";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { InstallAppCta } from "@/components/InstallAppCta";



import { useBrand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/navalha-pro-logo.png.asset.json";



const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Operação" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, group: "Operação" },
  { to: "/link", label: "Link cliente", icon: Link2, group: "Operação" },
  { to: "/clientes", label: "Clientes", icon: Users, group: "Cadastros" },
  { to: "/barbeiros", label: "Profissionais", icon: UserSquare2, group: "Cadastros" },
  { to: "/servicos", label: "Serviços", icon: Scissors, group: "Cadastros" },
  { to: "/horarios", label: "Horários", icon: Clock, group: "Cadastros" },
  { to: "/financeiro", label: "Financeiro", icon: BarChart3, group: "Negócio" },
  { to: "/planos", label: "Planos de assinatura", icon: Crown, group: "Negócio" },
  { to: "/assinaturas", label: "Assinaturas", icon: Repeat, group: "Negócio" },
  { to: "/marketing", label: "Marketing", icon: Megaphone, group: "Negócio" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, group: "Negócio" },
] as const;

const NAV_GROUPS = ["Operação", "Cadastros", "Negócio"] as const;

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3]] as const;




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
  const { installed } = usePwaInstall();
  useBrand(shop);

  // Acesso total pelo site: o app instalado é apenas uma recomendação.






  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2 px-5 py-6">
          <img
            src={shop?.logo_url ?? logoAsset.url}
            alt={shop?.name ? `Logo ${shop.name}` : "NAVALHA PRO"}
            className="size-8 shrink-0 object-contain"
          />
          <span className="break-words font-display text-2xl leading-tight tracking-wide">
            {shop?.name ? shop.name.toUpperCase() : <>NAVALHA <span className="text-primary">PRO</span></>}
          </span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  active && "bg-sidebar-accent text-primary",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          {!installed && (
            <Link
              to="/agendar"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                pathname.startsWith("/agendar") && "bg-sidebar-accent text-primary",
              )}
            >
              <CalendarPlus className="size-4" />
              Página do cliente
            </Link>
          )}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-destructive"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl leading-none">{title}</h1>
              {subtitle && (
                <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!canManage() && (
                <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground sm:inline">
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

        <main className="px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <InstallAppCta />
          {children}
        </main>


      </div>

      


      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground",
                active && "text-primary",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground",
                !MOBILE_NAV.some((i) => pathname.startsWith(i.to)) && "text-primary",
              )}
            >
              <Menu className="size-5" />
              Mais
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-center gap-2 break-words font-display text-2xl leading-tight">
                <img
                  src={shop?.logo_url ?? logoAsset.url}
                  alt={shop?.name ? `Logo ${shop.name}` : "NAVALHA PRO"}
                  className="size-6 shrink-0 object-contain"
                />
                {shop?.name ? shop.name.toUpperCase() : "NAVALHA PRO"}
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-6">
              {!installed && (
                <Link
                  to="/agendar"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/40 px-2 py-4 text-center text-xs text-foreground/80",
                    pathname.startsWith("/agendar") && "border-primary/50 text-primary",
                  )}
                >
                  <CalendarPlus className="size-5" />
                  <span className="leading-tight">Página do cliente</span>
                </Link>
              )}
              {NAV.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/40 px-2 py-4 text-center text-xs text-foreground/80",
                      active && "border-primary/50 text-primary",
                    )}
                  >
                    <item.icon className="size-5" />
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                );
              })}
              {!installed && (
                <Link
                  to="/instalar-app"
                  onClick={() => setMenuOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-primary/50 bg-secondary/40 px-2 py-4 text-center text-xs text-primary"
                >
                  <Smartphone className="size-5" />
                  <span className="leading-tight">Instalar APP</span>
                </Link>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/40 px-2 py-4 text-center text-xs text-destructive"
              >
                <LogOut className="size-5" />
                <span className="leading-tight">Sair</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

    </div>
  );
}
