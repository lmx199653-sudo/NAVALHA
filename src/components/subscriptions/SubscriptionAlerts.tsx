import { useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ALERT_META,
  chargeMessage,
  renewalMessage,
  summarizeAlerts,
  type AlertKind,
  type SubscriptionAlert,
  type SubscriptionRow,
} from "@/lib/subscription-alerts";

const TONE: Record<"danger" | "warning" | "info" | "gold", { pill: string; bar: string }> = {
  danger: {
    pill: "border-destructive/40 bg-destructive/15 text-destructive",
    bar: "bg-destructive",
  },
  warning: { pill: "border-warning/40 bg-warning/15 text-warning", bar: "bg-warning" },
  info: { pill: "border-border bg-secondary text-muted-foreground", bar: "bg-muted-foreground/60" },
  gold: { pill: "border-primary/40 bg-primary/10 text-primary", bar: "bg-primary" },
};

type Filter = "all" | AlertKind;

export function SubscriptionAlerts({
  alerts,
  shopName,
  pixKey,
  busyId,
  onMarkPaid,
  onRenew,
  onCancel,
}: {
  alerts: SubscriptionAlert[];
  shopName: string;
  pixKey?: string | null | undefined;
  busyId?: string | null | undefined;
  onMarkPaid: (row: SubscriptionRow) => void;
  onRenew: (row: SubscriptionRow) => void;
  onCancel: (row: SubscriptionRow) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeAlerts(alerts);

  const visible = alerts.filter((a) => filter === "all" || a.kind === filter);
  const shown = expanded ? visible : visible.slice(0, 6);

  const chips: Array<{ key: Filter; label: string; count: number; tone: keyof typeof TONE }> = [
    { key: "payment_overdue", label: "Atrasados", count: summary.overdue, tone: "danger" },
    { key: "payment_pending", label: "Pendentes", count: summary.pending, tone: "warning" },
    { key: "renewal_due", label: "Renovações", count: summary.renewal, tone: "gold" },
    { key: "due_soon", label: "Vencendo", count: summary.dueSoon, tone: "warning" },
  ];

  return (
    <section className="surface-card relative overflow-hidden p-4 sm:p-5">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <BellRing className="size-5" />
          </div>
          <div>
            <p className="font-display text-xl leading-tight">Central de alertas</p>
            <p className="text-xs text-muted-foreground">
              {summary.total === 0
                ? "Tudo em dia. Nenhuma ação necessária."
                : `${summary.total} ${summary.total === 1 ? "item precisa" : "itens precisam"} da sua atenção`}
            </p>
          </div>
        </div>
        {summary.total > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === "all"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Todos · {summary.total}
            </button>
            {chips
              .filter((c) => c.count > 0)
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(filter === c.key ? "all" : c.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filter === c.key
                      ? TONE[c.tone].pill
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.label} · {c.count}
                </button>
              ))}
          </div>
        )}
      </div>

      {summary.total === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 text-success" />
          Pagamentos em dia, ciclos ativos e nenhuma renovação pendente.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((a) => (
            <AlertItem
              key={a.id}
              alert={a}
              shopName={shopName}
              pixKey={pixKey}
              busy={busyId === a.row.sub.id}
              onMarkPaid={onMarkPaid}
              onRenew={onRenew}
              onCancel={onCancel}
            />
          ))}
        </ul>
      )}

      {visible.length > 6 && (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Mostrar menos" : `Ver todos (${visible.length})`}
        </button>
      )}
    </section>
  );
}

function AlertItem({
  alert,
  shopName,
  pixKey,
  busy,
  onMarkPaid,
  onRenew,
  onCancel,
}: {
  alert: SubscriptionAlert;
  shopName: string;
  pixKey?: string | null | undefined;
  busy: boolean;
  onMarkPaid: (row: SubscriptionRow) => void;
  onRenew: (row: SubscriptionRow) => void;
  onCancel: (row: SubscriptionRow) => void;
}) {
  const meta = ALERT_META[alert.kind];
  const tone = TONE[meta.tone];
  const phone = alert.row.customer?.phone?.replace(/\D/g, "");
  const wa = (text: string) => `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
  const Icon =
    alert.kind === "payment_overdue"
      ? AlertTriangle
      : alert.kind === "renewal_due"
        ? RefreshCw
        : alert.kind === "credits_out"
          ? XCircle
          : Clock3;

  return (
    <li className="surface-row relative flex flex-col gap-3 overflow-hidden p-3 pl-4 sm:flex-row sm:items-center sm:justify-between">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            meta.tone === "gold"
              ? "text-primary"
              : meta.tone === "danger"
                ? "text-destructive"
                : meta.tone === "warning"
                  ? "text-warning"
                  : "text-muted-foreground",
          )}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{alert.title}</p>
            <Badge
              variant={
                meta.tone === "danger"
                  ? "destructive"
                  : meta.tone === "warning"
                    ? "warning"
                    : meta.tone === "gold"
                      ? "default"
                      : "secondary"
              }
              className="h-5 px-1.5 text-[10px]"
            >
              {meta.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {alert.detail}
            {alert.row.plan && <> · {alert.row.plan.name}</>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {alert.actions.includes("charge") && phone && (
          <Button size="sm" variant="default" asChild>
            <a
              href={wa(chargeMessage(alert.row, shopName, pixKey))}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-3.5" /> Cobrar
            </a>
          </Button>
        )}
        {alert.actions.includes("mark_paid") && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onMarkPaid(alert.row)}>
            <CheckCircle2 className="size-3.5" /> Recebi
          </Button>
        )}
        {alert.actions.includes("renew") && (
          <Button size="sm" variant="default" disabled={busy} onClick={() => onRenew(alert.row)}>
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> Renovar
          </Button>
        )}
        {alert.actions.includes("notify") && phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={wa(renewalMessage(alert.row, shopName))} target="_blank" rel="noreferrer">
              <MessageCircle className="size-3.5" /> Avisar
            </a>
          </Button>
        )}
        {alert.actions.includes("cancel") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onCancel(alert.row)}
          >
            <XCircle className="size-3.5" /> Cancelar
          </Button>
        )}
      </div>
    </li>
  );
}
