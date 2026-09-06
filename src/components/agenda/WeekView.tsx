import { brl, timeLabel, WEEKDAYS } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import {
  FALLBACK_STATUS,
  isToday,
  statusTone,
  type Appointment,
  type ServiceSummary,
} from "./types";

interface WeekViewProps {
  startDate: Date;
  appts: Appointment[];
  services: ServiceSummary[];
  onSelectAppointment: (id: string) => void;
}

export function WeekView({ startDate, appts, services, onSelectAppointment }: WeekViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 7 }, (_, i) => {
        const day = new Date(startDate);
        day.setDate(day.getDate() + i);
        const list = appts.filter(
          (a) => new Date(a.starts_at).toDateString() === day.toDateString(),
        );
        return (
          <div
            key={i}
            className={`surface-card p-4 ${isToday(day) ? "border-primary/30 bg-primary/[0.03]" : ""}`}
          >
            <div className="flex items-baseline justify-between">
              <p className="font-display text-xl tracking-wide">
                {WEEKDAYS[day.getDay()]}{" "}
                <span
                  className={`text-sm ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}
                >
                  {day.getDate()}
                </span>
              </p>
              {isToday(day) && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Hoje
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2.5">
              {list.length === 0 && <p className="text-xs text-muted-foreground">Livre</p>}
              {list.map((a) => {
                const service = services.find((s) => s.id === a.service_id);
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelectAppointment(a.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition-all hover:shadow-sm ${statusTone[a.status] ?? statusTone[FALLBACK_STATUS]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold">{timeLabel(a.starts_at)}</span>
                      <span className="text-[11px] font-medium">{brl(a.price_cents)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{a.customer_name}</p>
                    {service && (
                      <p className="truncate text-[11px] text-muted-foreground/80">
                        {service.name}
                      </p>
                    )}
                    <div className="mt-1.5">
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
