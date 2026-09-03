import { friendlyError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Navigation,
  QrCode,
  Scissors,
  Sparkles,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { Landmark, Wallet } from "lucide-react";
import { serviceImages } from "@/lib/service-images";
import { notifyNewAppointment } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { brl, timeLabel, WEEKDAYS } from "@/lib/format";
import { useBrand } from "@/lib/brand";
import { availableSlots, dayKey, type BreakRow, type HoursRow } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { hasPix } from "@/lib/pix";
import { PixQrCard } from "@/components/PixQrCard";

const DEMO_SHOP: Shop = {
  id: "demo-shop-001",
  name: "Barbearia Demo",
  slug: "demo",
  description: "Experimente o agendamento online da Navalha Pro sem compromisso.",
  address: "Rua Demo, 123 - Centro",
  phone: "11999999999",
  whatsapp: null,
  instagram: null,
  logo_url: null,
  cover_url: null,
  accent_color: "#E3B341",
  secondary_color: "#C08A2E",
  bg_color: "#0D0D10",
  font_family: "Bebas Neue",
  pix_key: "demo@navalhapro.app",
  pix_key_type: "email",
  pix_holder_name: "Barbearia Demo",
};

const DEMO_SERVICES: Service[] = [
  {
    id: "demo-svc-01",
    name: "Corte Tesoura",
    description: "Corte tradicional com tesoura.",
    price_cents: 4500,
    duration_min: 45,
    image_url: null,
  },
  {
    id: "demo-svc-02",
    name: "Corte Máquina",
    description: "Corte com máquina e acabamento.",
    price_cents: 4000,
    duration_min: 40,
    image_url: null,
  },
  {
    id: "demo-svc-03",
    name: "Barba",
    description: "Barba completa com toalha quente.",
    price_cents: 3000,
    duration_min: 30,
    image_url: null,
  },
  {
    id: "demo-svc-04",
    name: "Navalhado",
    description: "Acabamento navalhado na zero.",
    price_cents: 2500,
    duration_min: 25,
    image_url: null,
  },
  {
    id: "demo-svc-05",
    name: "Sobrancelha",
    description: "Design de sobrancelha masculina.",
    price_cents: 2000,
    duration_min: 20,
    image_url: null,
  },
  {
    id: "demo-svc-06",
    name: "Pigmentação",
    description: "Pigmentação de barba ou cabelo.",
    price_cents: 6000,
    duration_min: 60,
    image_url: null,
  },
  {
    id: "demo-svc-07",
    name: "Reflexo",
    description: "Reflexo com produtos profissionais.",
    price_cents: 8000,
    duration_min: 90,
    image_url: null,
  },
  {
    id: "demo-svc-08",
    name: "Nevou",
    description: "Platinado/nevou masculino.",
    price_cents: 9000,
    duration_min: 120,
    image_url: null,
  },
];

const DEMO_BARBERS: Barber[] = [
  {
    id: "demo-barber-01",
    name: "Barbeiro Demo",
    bio: "Especialista em cortes modernos e atendimento premium.",
    photo_url: null,
    work_days: [0, 1, 2, 3, 4, 5, 6],
    start_time: "09:00",
    end_time: "20:00",
  },
];

const DEMO_HOURS: HoursRow[] = Array.from({ length: 7 }, (_, weekday) => ({
  id: `demo-hr-${weekday}`,
  barbershop_id: "demo-shop-001",
  weekday,
  open_time: "09:00:00",
  close_time: "20:00:00",
  closed: false,
}));

const DEMO_BREAKS: BreakRow[] = [];

const isDemo = (slug: string) => slug === "demo";

export const Route = createFileRoute("/barbearia/$slug")({
  head: ({ params }) => {
    const title = isDemo(params.slug)
      ? "Barbearia Demo — Navalha Pro"
      : `Agende seu horário — ${params.slug}`;
    const description =
      "Escolha o serviço, o profissional e o horário. Agendamento online em menos de 1 minuto, sem precisar ligar.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: PublicBooking,
});

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  accent_color: string;
  secondary_color: string;
  bg_color: string;
  font_family: string;
  pix_key?: string | null;
  pix_key_type?: string | null;
  pix_holder_name?: string | null;
};

type PaymentChoice = "plan" | "pix" | "pix_qr" | "on_site";

type PlanEligibility = {
  eligible: boolean;
  plan_name?: string | null;
  period_end?: string | null;
  services?: { service_id: string; covered: boolean; benefit_kind: string | null; left: number }[];
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  image_url?: string | null;
};
type Barber = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  work_days: number[];
  start_time: string;
  end_time: string;
};

const STEPS = ["Serviço", "Profissional", "Horário", "Seus dados"];

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function PublicBooking() {
  const { slug } = Route.useParams();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Service[]>([]);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [day, setDay] = useState(() => new Date());
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [done, setDone] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>("pix");

  /** Serviços selecionados combinados em um "serviço" único para agenda/resumo. */
  const service = useMemo<Service | null>(() => {
    if (selected.length === 0) return null;
    return {
      id: selected[0]!.id,
      name: selected.map((s) => s.name).join(" + "),
      description: null,
      price_cents: selected.reduce((t, s) => t + s.price_cents, 0),
      duration_min: selected.reduce((t, s) => t + s.duration_min, 0),
    };
  }, [selected]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => {
      const { data: shop } = await supabase
        .from("barbershops")
        .select(
          "id, name, slug, description, address, phone, whatsapp, instagram, logo_url, cover_url, accent_color, secondary_color, bg_color, font_family, pix_key, pix_key_type, pix_holder_name",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (isDemo(slug) && !shop) {
        return {
          shop: DEMO_SHOP,
          services: DEMO_SERVICES,
          barbers: DEMO_BARBERS,
          hours: DEMO_HOURS,
          breaks: DEMO_BREAKS,
        };
      }
      if (!shop) return null;
      const [services, barbers, hours, breaks] = await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("barbershop_id", shop.id)
          .eq("active", true)
          .order("sort_order")
          .order("name"),
        supabase
          .from("barbers")
          .select(
            "id, barbershop_id, name, bio, photo_url, work_days, start_time, end_time, active",
          )
          .eq("barbershop_id", shop.id)
          .eq("active", true),
        supabase.from("business_hours").select("*").eq("barbershop_id", shop.id),
        supabase.rpc("public_breaks", { _slug: slug }),
      ]);
      return {
        shop: shop as Shop,
        services: (services.data ?? []) as Service[],
        barbers: (barbers.data ?? []) as Barber[],
        hours: (hours.data ?? []) as HoursRow[],
        breaks: (breaks.data ?? []) as BreakRow[],
      };
    },
  });

  useBrand(data?.shop);

  // Um só profissional: já vem selecionado.
  useEffect(() => {
    if (data?.barbers.length === 1 && !barber) setBarber(data.barbers[0]!);
  }, [data, barber]);

  const { data: busy } = useQuery({
    queryKey: ["slots", slug, barber?.id, dayKey(day)],
    enabled: !!barber && step >= 2,
    queryFn: async () => {
      if (isDemo(slug)) return [];
      const { data: rows } = await supabase.rpc("booked_slots", {
        _slug: slug,
        _barber_id: barber!.id,
        _day: dayKey(day),
      });
      return (rows ?? []) as { starts_at: string; ends_at: string }[];
    },
  });

  const slots = useMemo(() => {
    if (!barber || !service) return [];
    return availableSlots({
      day,
      durationMin: service.duration_min,
      hours: data?.hours.find((h) => h.weekday === day.getDay()),
      barber,
      barberId: barber.id,
      breaks: data?.breaks ?? [],
      busy: busy ?? [],
    });
  }, [barber, service, day, busy, data]);

  const nextDays = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [],
  );

  const shopHasPix = hasPix(data?.shop);
  const cpfDigits = cpf.replace(/\D/g, "");
  const selectedIds = selected.map((s) => s.id);

  // Verifica (pelo CPF) se o cliente tem plano ativo cobrindo os serviços escolhidos.
  const { data: eligibility } = useQuery({
    queryKey: ["plan-eligibility", slug, cpfDigits, selectedIds],
    enabled: !isDemo(slug) && step === 4 && cpfDigits.length === 11 && selectedIds.length > 0,
    queryFn: async () => {
      const { data: res } = await supabase.rpc("public_plan_eligibility", {
        _slug: slug,
        _cpf: cpfDigits,
        _service_ids: selectedIds,
      });
      return (res ?? { eligible: false }) as unknown as PlanEligibility;
    },
  });
  const planEligible = !!eligibility?.eligible;
  const coveredIds = useMemo(
    () => new Set((eligibility?.services ?? []).filter((s) => s.covered).map((s) => s.service_id)),
    [eligibility],
  );
  const planUncoveredCents = selected
    .filter((s) => !coveredIds.has(s.id))
    .reduce((t, s) => t + s.price_cents, 0);

  const paymentChoice: PaymentChoice =
    payment === "plan"
      ? planEligible
        ? "plan"
        : shopHasPix
          ? "pix"
          : "on_site"
      : shopHasPix
        ? payment
        : "on_site";

  const book = useMutation({
    mutationFn: async () => {
      if (isDemo(slug)) {
        await new Promise((r) => setTimeout(r, 600));
        toast.success("Agendamento de demonstração confirmado!");
        return;
      }
      // Um agendamento por serviço, em sequência, a partir do horário escolhido.
      let cursor = new Date(slot!).getTime();
      const createdIds: string[] = [];
      for (const s of selected) {
        // Com o plano: serviços inclusos usam o benefício; os demais são pagos no local.
        const method =
          paymentChoice === "plan" ? (coveredIds.has(s.id) ? "plan" : "on_site") : paymentChoice;
        const { data: created, error } = await supabase.rpc("book_appointment", {
          _slug: slug,
          _barber_id: barber!.id,
          _service_id: s.id,
          _starts_at: new Date(cursor).toISOString(),
          _name: name,
          _phone: phone,
          _cpf: cpfDigits,
          _payment_method: method,
        });
        if (error) throw error;
        const id = (created as { id?: string } | null)?.id;
        if (id) createdIds.push(id);
        cursor += s.duration_min * 60000;
      }
      // Avisa a barbearia no app (notificação push) — falha aqui não bloqueia o agendamento.
      await Promise.all(
        createdIds.map((appointmentId) =>
          notifyNewAppointment({ data: { appointmentId } }).catch(() => null),
        ),
      );
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast.error(friendlyError(e.message) || "Horário indisponível"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <div className="surface-card animate-rise space-y-4 p-5">
          <div className="skeleton-shimmer h-20 w-20 rounded-2xl" />
          <div className="skeleton-shimmer h-6 w-2/3 rounded" />
          <div className="skeleton-shimmer h-4 w-1/2 rounded" />
        </div>
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <ErrorState
          title="Não foi possível carregar a barbearia"
          description="Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <EmptyState
          icon={MapPin}
          title="Barbearia não encontrada"
          description="Confira o link com a barbearia."
        />
      </div>
    );
  }

  const { shop, services, barbers } = data;
  const whatsappLink = shop.whatsapp
    ? `https://wa.me/55${shop.whatsapp.replace(/\D/g, "")}`
    : shop.phone
      ? `https://wa.me/55${shop.phone.replace(/\D/g, "")}`
      : null;

  if (done && slot && service && barber) {
    return (
      <SuccessScreen
        shop={shop}
        service={service}
        barber={barber}
        slot={slot}
        name={name}
        phone={phone}
        whatsappLink={whatsappLink}
        payment={paymentChoice}
        planUncoveredCents={planUncoveredCents}
      />
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <ShopHeader shop={shop} />

      <div className="mx-auto max-w-2xl px-4">
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

        {step === 0 && (
          <section className="space-y-3 pb-24">
            <StepTitle
              title="Escolha os serviços"
              hint="Pode marcar mais de um — somamos o tempo e o valor."
            />
            {services.length === 0 && <Empty>Nenhum serviço disponível no momento.</Empty>}
            {services.map((s) => {
              const active = selected.some((x) => x.id === s.id);
              const imgs = s.image_url ? [s.image_url] : serviceImages(s.name);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelected((prev) =>
                      prev.some((x) => x.id === s.id)
                        ? prev.filter((x) => x.id !== s.id)
                        : [...prev, s],
                    );
                    setSlot(null);
                  }}
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
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                        {s.description}
                      </p>
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

            {service && (
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 px-4 py-3 pb-safe backdrop-blur">
                <div className="mx-auto flex max-w-2xl items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">
                      {selected.length} serviço{selected.length > 1 ? "s" : ""} ·{" "}
                      {service.duration_min} min
                    </p>
                    <p className="font-display text-2xl leading-none text-primary">
                      {brl(service.price_cents)}
                    </p>
                  </div>
                  <Button
                    className="h-12 px-6"
                    onClick={() => setStep(barbers.length === 1 ? 2 : 1)}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <StepTitle title="Escolha o profissional" hint="Com quem você quer ser atendido?" />
            {barbers.length === 0 && <Empty>Nenhum profissional disponível.</Empty>}
            <div className="grid gap-3 sm:grid-cols-2">
              {barbers.map((b) => {
                const active = barber?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBarber(b);
                      setSlot(null);
                      setStep(2);
                    }}
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
        )}

        {step === 2 && (
          <section className="space-y-4">
            <StepTitle
              title="Escolha data e horário"
              hint="Só aparecem horários realmente livres."
            />
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {nextDays.map((d) => {
                const active = dayKey(d) === dayKey(day);
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      setDay(d);
                      setSlot(null);
                    }}
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
              <Empty>Sem horários livres neste dia. Escolha outra data.</Empty>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSlot(s);
                      setStep(3);
                    }}
                    className={cn(
                      "min-h-11 rounded-xl border py-3 text-sm font-medium transition-colors",
                      slot === s
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
        )}

        {step === 3 && (
          <section className="space-y-4">
            <StepTitle title="Seus dados" hint="Só precisamos do essencial." />
            <form
              className="surface-card space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(4);
              }}
            >
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  required
                  minLength={2}
                  className="h-12"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como podemos te chamar?"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  required
                  minLength={8}
                  inputMode="tel"
                  className="h-12"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  required
                  inputMode="numeric"
                  className="h-12"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
                <p className="text-xs text-muted-foreground">
                  Usamos o CPF só para identificar seu histórico na barbearia.
                </p>
              </div>
              <Button
                className="h-12 w-full text-base"
                disabled={cpf.replace(/\D/g, "").length !== 11}
              >
                Ver resumo
              </Button>
            </form>
          </section>
        )}

        {step === 4 && service && barber && slot && (
          <section className="space-y-4">
            <StepTitle title="Seu agendamento" hint="Confira antes de confirmar." />
            <div className="surface-card space-y-2 p-3">
              <SummaryRow icon={Scissors} label="Serviço" value={service.name} />
              <SummaryRow icon={User} label="Profissional" value={barber.name} />
              <SummaryRow
                icon={CalendarPlus}
                label="Data"
                value={`${WEEKDAYS[new Date(slot).getDay()]}, ${new Date(slot).toLocaleDateString("pt-BR")}`}
              />
              <SummaryRow icon={Clock} label="Horário" value={timeLabel(slot)} />
              <SummaryRow
                icon={MessageCircle}
                label="Cliente"
                value={`${name} · ${phone} · ${cpf}`}
              />
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="font-display text-3xl text-primary">
                  {brl(service.price_cents)}
                </span>
              </div>
            </div>
            <div className="surface-card space-y-3 p-4">
              <p className="text-sm text-muted-foreground">Como você quer pagar?</p>
              <div
                className={cn(
                  "grid gap-2",
                  planEligible ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2",
                )}
              >
                {shopHasPix && (
                  <PaymentOption
                    icon={QrCode}
                    active={paymentChoice === "pix"}
                    title="Pagar com Pix"
                    hint="QR Code ou chave · agora"
                    badge="Recomendado"
                    onClick={() => setPayment("pix")}
                  />
                )}
                {planEligible && (
                  <PaymentOption
                    icon={Sparkles}
                    active={paymentChoice === "plan"}
                    title="Usar meu plano"
                    hint={`Serviço incluso no plano${eligibility?.plan_name ? ` ${eligibility.plan_name}` : ""}`}
                    badge="Assinante"
                    onClick={() => setPayment("plan")}
                  />
                )}
                <PaymentOption
                  icon={Wallet}
                  active={paymentChoice === "on_site"}
                  title="Pagar no local"
                  hint="Pix, cartão ou dinheiro"
                  onClick={() => setPayment("on_site")}
                />
              </div>
              {paymentChoice === "plan" ? (
                <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="size-4 text-primary" />
                    <span>
                      {planUncoveredCents === 0
                        ? "Tudo incluso no seu plano — nada a pagar agora."
                        : `Parte inclusa no plano. Restante de ${brl(planUncoveredCents)} você paga no local.`}
                    </span>
                  </div>
                  {selected.length > 1 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {selected.map((s) => (
                        <li key={s.id} className="flex justify-between">
                          <span>{s.name}</span>
                          <span>
                            {coveredIds.has(s.id) ? "incluso no plano" : brl(s.price_cents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O crédito só é descontado quando o atendimento for concluído. Se cancelar ou não
                    comparecer, nada é descontado.
                  </p>
                </div>
              ) : paymentChoice === "pix" && shopHasPix ? (
                <>
                  <PixQrCard
                    showKey
                    pixKey={shop.pix_key!}
                    pixKeyType={shop.pix_key_type}
                    holderName={shop.pix_holder_name}
                    amountCents={service.price_cents}
                    description={service.name}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pague {brl(service.price_cents)} pelo QR Code ou copiando a chave, direto para o
                    barbeiro, e confirme o agendamento. Leve o comprovante no dia.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nada é cobrado agora. Você paga direto ao barbeiro no dia, por Pix, cartão ou
                  dinheiro.
                </p>
              )}
            </div>
            <div className="h-16" />
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 px-4 py-3 pb-safe backdrop-blur">
              <div className="mx-auto max-w-2xl">
                <Button
                  className="h-14 w-full text-base"
                  disabled={book.isPending}
                  onClick={() => book.mutate()}
                >
                  {book.isPending
                    ? "Confirmando…"
                    : paymentChoice === "pix" || paymentChoice === "pix_qr"
                      ? "Já fiz o Pix — confirmar agendamento"
                      : paymentChoice === "plan"
                        ? "Confirmar com meu plano"
                        : "Confirmar agendamento"}
                </Button>
              </div>
            </div>
          </section>
        )}

        {step > 0 && (
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => setStep(step === 2 && barbers.length === 1 ? 0 : step - 1)}
          >
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        )}
      </div>
    </div>
  );
}

function ShopHeader({ shop }: { shop: Shop }) {
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

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="font-display text-3xl leading-none">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0 text-primary" /> {label}
      </span>
      <span className="truncate text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function PaymentOption({
  icon: Icon,
  active,
  title,
  hint,
  badge,
  onClick,
}: {
  icon: typeof QrCode;
  active: boolean;
  title: string;
  hint: string;
  badge?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors min-h-24",
        active
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border hover:border-primary/40",
      )}
    >
      {badge && (
        <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
          {badge}
        </span>
      )}
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg ring-1",
          active
            ? "bg-primary/20 text-primary ring-primary/30"
            : "bg-secondary/70 text-muted-foreground ring-border",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div>
        <p className={cn("font-display text-xl leading-none", active && "text-primary")}>{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </button>
  );
}

function SuccessScreen({
  shop,
  service,
  barber,
  slot,
  name,
  phone,
  whatsappLink,
  payment,
  planUncoveredCents = 0,
}: {
  shop: Shop;
  service: Service;
  barber: Barber;
  slot: string;
  name: string;
  phone: string;
  whatsappLink: string | null;
  payment: PaymentChoice;
  planUncoveredCents?: number | undefined;
}) {
  const start = new Date(slot);
  const end = new Date(start.getTime() + service.duration_min * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `${service.name} — ${shop.name}`,
  )}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(
    `Profissional: ${barber.name}`,
  )}&location=${encodeURIComponent(shop.address ?? shop.name)}`;

  const usingPlan = payment === "plan";
  const paidByPix = (payment === "pix" || payment === "pix_qr") && hasPix(shop);
  const planCoveredAll = usingPlan && planUncoveredCents === 0;

  const whatsappMessage = [
    `✅ *Agendamento confirmado* — ${shop.name}`,
    "",
    `Cliente: ${name}`,
    `Serviço: ${service.name}`,
    `Profissional: ${barber.name}`,
    `Dia: ${WEEKDAYS[start.getDay()]}, ${start.toLocaleDateString("pt-BR")}`,
    `Horário: ${timeLabel(slot)}`,
    `Valor: ${usingPlan ? (planCoveredAll ? "incluso no plano" : `${brl(planUncoveredCents)} (restante fora do plano)`) : brl(service.price_cents)}`,
    `Pagamento: ${usingPlan ? "meu plano de assinatura" : paidByPix ? "Pix (segue o comprovante)" : "no local"}`,
    `Telefone: ${phone}`,
  ].join("\n");
  const whatsappConfirmLink = whatsappLink
    ? `${whatsappLink}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="surface-card overflow-hidden">
          <div className="flex flex-col items-center border-b border-border/70 bg-primary/10 px-6 py-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
              <Check className="size-8" />
            </span>
            <h1 className="mt-4 font-display text-4xl leading-none">Agendamento confirmado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Te esperamos na {shop.name}, {name.split(" ")[0]}!
            </p>
          </div>
          <div className="space-y-2 p-3">
            <SummaryRow icon={Scissors} label="Serviço" value={service.name} />
            <SummaryRow icon={User} label="Profissional" value={barber.name} />
            <SummaryRow
              icon={CalendarPlus}
              label="Data"
              value={`${WEEKDAYS[start.getDay()]}, ${start.toLocaleDateString("pt-BR")}`}
            />
            <SummaryRow icon={Clock} label="Horário" value={timeLabel(slot)} />
            <SummaryRow icon={MessageCircle} label="Seu WhatsApp" value={phone} />
            <SummaryRow
              icon={usingPlan ? Sparkles : QrCode}
              label="Pagamento"
              value={
                usingPlan
                  ? "Meu plano de assinatura"
                  : paidByPix
                    ? "Pix direto ao barbeiro"
                    : "No local (Pix, cartão ou dinheiro)"
              }
            />
            <div className="flex items-center justify-between px-3.5 py-3">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className="font-display text-3xl text-primary">
                {planCoveredAll
                  ? "Incluso"
                  : brl(usingPlan ? planUncoveredCents : service.price_cents)}
              </span>
            </div>
            {usingPlan && (
              <p className="px-3.5 py-2 text-xs text-muted-foreground">
                O crédito do seu plano só é descontado quando o atendimento for concluído. Se
                cancelar ou não comparecer, nada é descontado.
              </p>
            )}
          </div>
          <div className="space-y-3 p-5">
            {paidByPix && (
              <>
                <PixQrCard
                  compact
                  showKey
                  pixKey={shop.pix_key!}
                  pixKeyType={shop.pix_key_type}
                  holderName={shop.pix_holder_name ?? null}
                  amountCents={service.price_cents}
                  description={service.name}
                />
                <p className="text-xs text-muted-foreground">
                  Ainda não pagou? Escaneie o QR Code ou copie a chave acima e faça o Pix. Envie o
                  comprovante pelo WhatsApp para agilizar a confirmação.
                </p>
              </>
            )}
            {whatsappConfirmLink && (
              <Button className="h-14 w-full text-base font-semibold shadow-lg" size="lg" asChild>
                <a href={whatsappConfirmLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-5" />
                  {paidByPix ? "ENVIAR COMPROVANTE NO WHATSAPP" : "CONFIRMAR COM BARBEARIA"}
                </a>
              </Button>
            )}
            <Button variant="outline" className="h-12 w-full" asChild>
              <a href={calendarUrl} target="_blank" rel="noreferrer">
                <CalendarPlus className="size-4" /> Adicionar ao calendário
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
