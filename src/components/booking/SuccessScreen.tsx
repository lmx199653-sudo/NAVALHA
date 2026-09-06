import { CalendarPlus, Check, Clock, MessageCircle, QrCode, Scissors, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixQrCard } from "@/components/PixQrCard";
import { brl, timeLabel, WEEKDAYS } from "@/lib/format";
import { hasPix } from "@/lib/pix";
import type { Barber, PaymentChoice, Service, Shop } from "./types";
import { SummaryRow } from "./PaymentStep";

interface SuccessScreenProps {
  shop: Shop;
  service: Service;
  barber: Barber;
  slot: string;
  name: string;
  phone: string;
  whatsappLink: string | null;
  payment: PaymentChoice;
  planUncoveredCents?: number | undefined;
}

export function SuccessScreen({
  shop,
  service,
  barber,
  slot,
  name,
  phone,
  whatsappLink,
  payment,
  planUncoveredCents = 0,
}: SuccessScreenProps) {
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
