import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  size = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "gold" | "danger" | "success";
  size?: "default" | "hero";
  loading?: boolean;
}) {
  const toneClass =
    tone === "gold"
      ? "text-primary"
      : tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-success"
          : "text-foreground";

  const iconTone =
    tone === "gold"
      ? "bg-primary/12 text-primary ring-primary/20"
      : tone === "danger"
        ? "bg-destructive/12 text-destructive ring-destructive/20"
        : tone === "success"
          ? "bg-success/12 text-success ring-success/20"
          : "bg-secondary/80 text-muted-foreground ring-border/60";

  if (size === "hero") {
    return (
      <div className="surface-card surface-card-hover relative overflow-hidden p-4 sm:p-5">
        {tone === "gold" && (
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow truncate">{label}</span>
          {Icon && (
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", iconTone)}>
              <Icon className="size-4" />
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-10 w-2/3" />
        ) : (
          <p className={cn("mt-3 truncate font-display text-4xl leading-none sm:text-[2.75rem]", toneClass)}>
            {value}
          </p>
        )}
        {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="surface-row px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate text-[10px]">{label}</span>
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-1/2" />
      ) : (
        <p className={cn("mt-1.5 truncate font-display text-2xl leading-none", toneClass)}>{value}</p>
      )}
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
