import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Instagram, MapPin, Navigation } from "lucide-react";
import type { Shop } from "./types";

export function BookingHeader({ shop }: { shop: Shop }) {
  return (
    <header className="relative mb-6">
      <div className="relative h-40 sm:h-52">
        {shop.cover_url ? (
          <img
            src={shop.cover_url}
            alt={`Ambiente da ${shop.name}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid-noise size-full bg-gradient-to-br from-primary/15 via-secondary to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-transparent" />
      </div>

      <div className="mx-auto -mt-14 max-w-2xl px-4">
        <div className="flex items-center gap-4">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={`Logo da ${shop.name}`}
              className="size-24 shrink-0 rounded-2xl border border-primary/40 bg-background/80 object-contain p-2 shadow-lg"
            />
          ) : (
            <Avatar className="size-20 shrink-0 border border-primary/40">
              <AvatarFallback className="font-display text-2xl">
                {shop.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        <div className="mt-4">
          <h1 className="font-display text-3xl leading-[1.35] break-words sm:text-4xl">
            {shop.name}
          </h1>
          {shop.description && (
            <p className="mt-1.5 text-xs text-muted-foreground">{shop.description}</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {shop.address && (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{shop.address}</span>
            </span>
          )}
          {shop.instagram && (
            <a
              href={`https://instagram.com/${shop.instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-muted-foreground transition-colors hover:text-primary"
            >
              <Instagram className="size-3.5 text-primary" /> {shop.instagram}
            </a>
          )}
          {shop.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-primary"
            >
              <Navigation className="size-3.5" /> Como chegar
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
