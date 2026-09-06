import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Barber } from "./types";
import { EmptyBookingMessage, StepTitle } from "./BookingProgress";

interface BarberSelectorProps {
  barbers: Barber[];
  selectedBarber: Barber | null;
  onSelectBarber: (barber: Barber) => void;
}

export function BarberSelector({ barbers, selectedBarber, onSelectBarber }: BarberSelectorProps) {
  return (
    <section className="space-y-3">
      <StepTitle title="Escolha o profissional" hint="Com quem você quer ser atendido?" />
      {barbers.length === 0 && (
        <EmptyBookingMessage>Nenhum profissional disponível.</EmptyBookingMessage>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {barbers.map((b) => {
          const active = selectedBarber?.id === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onSelectBarber(b)}
              className={cn(
                "surface-card flex items-center gap-3.5 p-4 text-left transition-all active:scale-[0.99]",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "hover:border-primary/50",
              )}
            >
              <Avatar className="size-14 border border-primary/30">
                <AvatarImage src={b.photo_url ?? undefined} alt={b.name} />
                <AvatarFallback>{b.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-display text-2xl leading-none">{b.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {b.bio || "Barbeiro"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
