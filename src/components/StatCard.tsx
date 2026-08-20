import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "gold" | "danger" | "success";
}) {
  const toneClass =
    tone === "gold"
      ? "text-primary"
      : tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-success"
          : "text-foreground";

  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className={`mt-2 font-display text-3xl leading-none ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
