import React from "react";
import {
  CalendarPlus,
  Clock,
  MessageCircle,
  QrCode,
  Scissors,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, timeLabel, WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PixQrCard } from "@/components/PixQrCard";
import type { Barber, PaymentChoice, PlanEligibility, Service, Shop } from "./types";
import { StepTitle } from "./BookingProgress";

export function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
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

export function PaymentOption({
  icon: Icon,
  active,
  title,
  hint,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
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

interface PaymentStepProps {
  shop: Shop;
  service: Service;
  selected: Service[];
  barber: Barber;
  slot: string;
  name: string;
  phone: string;
  cpf: string;
  paymentChoice: PaymentChoice;
  onSelectPayment: (choice: PaymentChoice) => void;
  planEligible: boolean;
  eligibility?: PlanEligibility | undefined;
  coveredIds: Set<string>;
  planUncoveredCents: number;
  shopHasPix: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

export function PaymentStep({
  shop,
  service,
  selected,
  barber,
  slot,
  name,
  phone,
  cpf,
  paymentChoice,
  onSelectPayment,
  planEligible,
  eligibility,
  coveredIds,
  planUncoveredCents,
  shopHasPix,
  isPending,
  onConfirm,
}: PaymentStepProps) {
  return (
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
              onClick={() => onSelectPayment("pix")}
            />
          )}
          {planEligible && (
            <PaymentOption
              icon={Sparkles}
              active={paymentChoice === "plan"}
              title="Usar meu plano"
              hint={`Serviço incluso no plano${eligibility?.plan_name ? ` ${eligibility.plan_name}` : ""}`}
              badge="Assinante"
              onClick={() => onSelectPayment("plan")}
            />
          )}
          <PaymentOption
            icon={Wallet}
            active={paymentChoice === "on_site"}
            title="Pagar no local"
            hint="Pix, cartão ou dinheiro"
            onClick={() => onSelectPayment("on_site")}
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
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending
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
  );
}
