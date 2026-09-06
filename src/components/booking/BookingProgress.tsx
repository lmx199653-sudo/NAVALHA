import { cn } from "@/lib/utils";

export const STEPS = ["Serviço", "Profissional", "Horário", "Seus dados"];

export function BookingProgress({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex gap-1.5">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <div
            className={cn(
              "h-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-border",
            )}
          />
          <p
            className={cn(
              "mt-2 truncate text-[10px] uppercase tracking-widest",
              i === step ? "text-primary" : "text-muted-foreground",
            )}
          >
            {s}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="font-display text-3xl leading-none">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function EmptyBookingMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
