import { friendlyError } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { notifyNewAppointment } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/lib/brand";
import { availableSlots, dayKey, type BreakRow, type HoursRow } from "@/lib/slots";
import { hasPix } from "@/lib/pix";

import {
  BookingHeader,
  BookingProgress,
  ServiceSelector,
  BarberSelector,
  SlotSelector,
  CustomerForm,
  PaymentStep,
  SuccessScreen,
  DEMO_SHOP,
  DEMO_SERVICES,
  DEMO_BARBERS,
  DEMO_HOURS,
  DEMO_BREAKS,
  isDemo,
  type Barber,
  type PaymentChoice,
  type PlanEligibility,
  type Service,
  type Shop,
} from "@/components/booking";

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
      // Dados públicos da barbearia (sem CPF/CNPJ) via função dedicada.
      // Importante: manter o `this` do cliente Supabase (não extrair o método solto).
      const rpc = (fn: string, args: Record<string, unknown>) =>
        (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{
          data: unknown;
        }>).call(supabase, fn, args);
      const { data: shopRows } = await rpc("public_shop", { _slug: slug });
      const shopRow = ((shopRows ?? []) as (Shop & { has_pix?: boolean })[])[0] ?? null;
      let shop: Shop | null = shopRow;
      if (shopRow?.has_pix) {
        // Chave Pix só é buscada quando a barbearia aceita Pix, e apenas para esta barbearia.
        const { data: pixRows } = await rpc("public_shop_pix", { _slug: slug });
        const pix = (
          (pixRows ?? []) as Pick<Shop, "pix_key" | "pix_key_type" | "pix_holder_name">[]
        )[0];
        shop = { ...shopRow, ...(pix ?? {}) };
      }
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
      const [services, barbers, hours, breaks, accepting] = await Promise.all([
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
        supabase.rpc("public_shop_accepting", { _slug: slug }),
      ]);
      return {
        accepting: accepting.data !== false,
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

  // Conta da barbearia suspensa por cobrança: página segue visível, sem novos agendamentos.
  if ("accepting" in data && data.accepting === false) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <EmptyState
          icon={MapPin}
          title={shop.name}
          description="Esta barbearia está temporariamente indisponível para novos agendamentos online. Entre em contato diretamente com a barbearia."
        />
      </div>
    );
  }

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
      <BookingHeader shop={shop} />

      <div className="mx-auto max-w-2xl px-4">
        <BookingProgress step={step} />

        {step === 0 && (
          <ServiceSelector
            services={services}
            selected={selected}
            onToggleService={(s) => {
              setSelected((prev) =>
                prev.some((x) => x.id === s.id)
                  ? prev.filter((x) => x.id !== s.id)
                  : [...prev, s],
              );
              setSlot(null);
            }}
            combinedService={service}
            onContinue={() => setStep(barbers.length === 1 ? 2 : 1)}
          />
        )}

        {step === 1 && (
          <BarberSelector
            barbers={barbers}
            selectedBarber={barber}
            onSelectBarber={(b) => {
              setBarber(b);
              setSlot(null);
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <SlotSelector
            days={nextDays}
            selectedDay={day}
            onSelectDay={(d) => {
              setDay(d);
              setSlot(null);
            }}
            slots={slots}
            selectedSlot={slot}
            onSelectSlot={(s) => {
              setSlot(s);
              setStep(3);
            }}
          />
        )}

        {step === 3 && (
          <CustomerForm
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            cpf={cpf}
            setCpf={setCpf}
            onSubmit={() => setStep(4)}
          />
        )}

        {step === 4 && service && barber && slot && (
          <PaymentStep
            shop={shop}
            service={service}
            selected={selected}
            barber={barber}
            slot={slot}
            name={name}
            phone={phone}
            cpf={cpf}
            paymentChoice={paymentChoice}
            onSelectPayment={setPayment}
            planEligible={planEligible}
            eligibility={eligibility}
            coveredIds={coveredIds}
            planUncoveredCents={planUncoveredCents}
            shopHasPix={shopHasPix}
            isPending={book.isPending}
            onConfirm={() => book.mutate()}
          />
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
