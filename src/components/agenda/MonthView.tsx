import { STATUS_LABEL, WEEKDAYS } from "@/lib/format";
import { FALLBACK_STATUS, isToday, statusDot, type Appointment } from "./types";

interface MonthViewProps {
  range: { start: Date; end: Date };
  appts: Appointment[];
  onSelectDay: (day: Date) => void;
}

export function MonthView({ range, appts, onSelectDay }: MonthViewProps) {
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {WEEKDAYS.map((w) => (
        <div
          key={w}
          className="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {w.slice(0, 3)}
        </div>
      ))}
      {Array.from({ length: range.start.getDay() }, (_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {Array.from({ length: new Date(range.end.getTime() - 1).getDate() }, (_, i) => {
        const day = new Date(range.start);
        day.setDate(i + 1);
        const list = appts.filter(
          (a) => new Date(a.starts_at).toDateString() === day.toDateString(),
        );
        return (
          <button
            key={i}
            onClick={() => onSelectDay(day)}
            className={`surface-card flex min-h-20 flex-col p-2.5 text-left transition-colors hover:border-primary/30 ${isToday(day) ? "border-primary/40 bg-primary/[0.04]" : ""}`}
          >
            <span
              className={`text-sm font-semibold ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}
            >
              {i + 1}
            </span>
            {list.length > 0 && (
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {Array.from(new Set(list.map((a) => a.status))).map((s) => (
                  <span
                    key={s}
                    className={`size-2 rounded-full ${statusDot[s] ?? statusDot[FALLBACK_STATUS]}`}
                    title={STATUS_LABEL[s]}
                  />
                ))}
                <span className="text-[11px] font-medium text-muted-foreground">
                  {list.length}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
