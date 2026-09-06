import { timeLabel, WEEKDAYS } from "@/lib/format";
import { dayKey } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { EmptyBookingMessage, StepTitle } from "./BookingProgress";

interface SlotSelectorProps {
  days: Date[];
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  slots: string[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}

export function SlotSelector({
  days,
  selectedDay,
  onSelectDay,
  slots,
  selectedSlot,
  onSelectSlot,
}: SlotSelectorProps) {
  return (
    <section className="space-y-4">
      <StepTitle
        title="Escolha data e horário"
        hint="Só aparecem horários realmente livres."
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => {
          const active = dayKey(d) === dayKey(selectedDay);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "flex w-[68px] shrink-0 flex-col items-center rounded-2xl border px-2 py-3 transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              <span className="text-[10px] uppercase tracking-widest">
                {WEEKDAYS[d.getDay()]?.slice(0, 3)}
              </span>
              <span className="font-display text-2xl leading-tight text-foreground">
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {slots.length === 0 ? (
        <EmptyBookingMessage>Sem horários livres neste dia. Escolha outra data.</EmptyBookingMessage>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => onSelectSlot(s)}
              className={cn(
                "min-h-11 rounded-xl border py-3 text-sm font-medium transition-colors",
                selectedSlot === s
                  ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary hover:text-primary",
              )}
            >
              {timeLabel(s)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
