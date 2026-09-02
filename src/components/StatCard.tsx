import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  size = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "gold" | "danger" | "success";
  size?: "default" | "hero";
}) {
  const toneClass =
    tone === "gold"
      ? "text-primary"
      : tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-success"
          : "text-foreground";

  if (size === "hero") {
    return (
      <div className="surface-card relative overflow-hidden p-5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/50" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          {Icon && <Icon className="size-4 text-muted-foreground/70" />}
        </div>
        <p className={cn("mt-3 font-display text-4xl leading-none sm:text-5xl", toneClass)}>
          {value}
        </p>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
          {label}
        </span>
        {Icon && <Icon className="size-3.5 text-muted-foreground/50" />}
      </div>
      <p className={cn("mt-1.5 font-display text-2xl leading-none", toneClass)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
