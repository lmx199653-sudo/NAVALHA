import { Clock } from "lucide-react";
import { brl, timeLabel } from "@/lib/format";
import type { BreakRow } from "@/lib/slots";
import { StatusBadge } from "./StatusBadge";
import {
  durationMin,
  FALLBACK_STATUS,
  HOURS,
  statusTone,
  type Appointment,
  type ServiceSummary,
} from "./types";

interface DayViewProps {
  anchor: Date;
  appts: Appointment[];
  services: ServiceSummary[];
  dayBreaks: BreakRow[];
  onSelectAppointment: (id: string) => void;
  onReschedule: (params: { id: string; starts_at: Date }) => void;
}

export function DayView({
  anchor,
  appts,
  services,
  dayBreaks,
  onSelectAppointment,
  onReschedule,
}: DayViewProps) {
  return (
    <div className="surface-card divide-y divide-border/60 overflow-hidden rounded-2xl">
      {HOURS.map((hour) => {
        const slotAppts = appts.filter((a) => new Date(a.starts_at).getHours() === hour);
        return (
          <div
            key={hour}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              const target = new Date(anchor);
              target.setHours(hour, 0, 0, 0);
              if (id) onReschedule({ id, starts_at: target });
            }}
            className="flex min-h-[5rem] gap-4 p-4 transition-colors hover:bg-secondary/20"
          >
            <span className="w-14 shrink-0 pt-1 text-xs font-semibold text-muted-foreground/70">
              {String(hour).padStart(2, "0")}:00
            </span>
            <div className="flex flex-1 flex-wrap content-start gap-2.5">
              {dayBreaks
                .filter(
                  (b) =>
                    Number(b.start_time.slice(0, 2)) <= hour &&
                    Number(b.end_time.slice(0, 2)) > hour,
                )
                .map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/50 px-3 py-1.5 text-[11px] text-muted-foreground"
                  >
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                    {b.name} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                  </span>
                ))}

              {slotAppts.map((a) => {
                const service = services.find((s) => s.id === a.service_id);
                const duration = durationMin(a.starts_at, a.ends_at);
                return (
                  <button
                    key={a.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                    onClick={() => onSelectAppointment(a.id)}
                    className={`group min-w-44 flex-1 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${statusTone[a.status] ?? statusTone[FALLBACK_STATUS]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[15px] font-medium tracking-wide">
                          {a.customer_name}
                        </p>
                        {service && (
                          <p className="truncate text-xs text-muted-foreground/80">
                            {service.name}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {brl(a.price_cents)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-background/40 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                        <Clock className="size-3" />
                        {timeLabel(a.starts_at)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{duration} min</span>
                      <StatusBadge status={a.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
