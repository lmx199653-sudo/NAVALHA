import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { serviceImages } from "@/lib/service-images";
import { cn } from "@/lib/utils";
import type { Service } from "./types";
import { EmptyBookingMessage, StepTitle } from "./BookingProgress";

interface ServiceSelectorProps {
  services: Service[];
  selected: Service[];
  onToggleService: (service: Service) => void;
  combinedService: Service | null;
  onContinue: () => void;
}

export function ServiceSelector({
  services,
  selected,
  onToggleService,
  combinedService,
  onContinue,
}: ServiceSelectorProps) {
  return (
    <section className="space-y-3 pb-24">
      <StepTitle
        title="Escolha os serviços"
        hint="Pode marcar mais de um — somamos o tempo e o valor."
      />

      {services.length === 0 && (
        <EmptyBookingMessage>Nenhum serviço disponível no momento.</EmptyBookingMessage>
      )}

      {services.map((s) => {
        const active = selected.some((x) => x.id === s.id);
        const imgs = s.image_url ? [s.image_url] : serviceImages(s.name);
        return (
          <button
            key={s.id}
            onClick={() => onToggleService(s)}
            className={cn(
              "surface-card grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition-all active:scale-[0.99] sm:gap-4 sm:p-5",
              active
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "hover:border-primary/50",
            )}
          >
            {imgs.length > 0 && (
              <span className="relative flex shrink-0 gap-1">
                {imgs.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Serviço ${s.name}`}
                    loading="lazy"
                    className="size-16 rounded-xl border border-border/70 object-cover object-top sm:size-20"
                  />
                ))}
                {active && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none">{s.name}</p>
              {s.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
              )}
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                <Clock className="size-3" /> {s.duration_min} min
              </p>
            </div>
            <span className="shrink-0 font-display text-2xl text-primary">
              {s.price_cents > 0 ? brl(s.price_cents) : "A combinar"}
            </span>
          </button>
        );
      })}

      {combinedService && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 px-4 py-3 pb-safe backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">
                {selected.length} serviço{selected.length > 1 ? "s" : ""} ·{" "}
                {combinedService.duration_min} min
              </p>
              <p className="font-display text-2xl leading-none text-primary">
                {brl(combinedService.price_cents)}
              </p>
            </div>
            <Button className="h-12 px-6" onClick={onContinue}>
              Continuar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
