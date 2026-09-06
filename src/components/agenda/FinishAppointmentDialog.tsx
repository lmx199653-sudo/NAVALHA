import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { brl } from "@/lib/format";
import { hasPix, PAYMENT_METHOD_LABEL } from "@/lib/pix";
import { BENEFIT_LABEL, type BenefitKind, type LocalPaymentMethod } from "@/lib/subscriptions";
import { PixKeyCard } from "@/components/PixKeyCard";
import { PixQrCard } from "@/components/PixQrCard";
import type { Appointment, ServiceSummary } from "./types";

interface FinishAppointmentDialogProps {
  appointment: Appointment | null;
  services: ServiceSummary[];
  shop: any;
  payMethod: LocalPaymentMethod;
  onPayMethodChange: (m: LocalPaymentMethod) => void;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export function FinishAppointmentDialog({
  appointment,
  services,
  shop,
  payMethod,
  onPayMethodChange,
  onClose,
  onConfirm,
}: FinishAppointmentDialogProps) {
  if (!appointment) return null;
  const service = services.find((s) => s.id === appointment.service_id);

  return (
    <AlertDialog open={!!appointment} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar conclusão do atendimento?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1 text-sm">
              <p>Cliente: {appointment.customer_name}</p>
              <p>Serviço: {service?.name ?? "—"}</p>
              {appointment.use_benefit && !appointment.benefit_processed ? (
                <p className="text-primary">
                  1{" "}
                  {BENEFIT_LABEL[(appointment.benefit_kind ?? "cut") as BenefitKind].toLowerCase()}{" "}
                  será descontado da assinatura.
                </p>
              ) : appointment.benefit_processed ? (
                <p className="text-muted-foreground">
                  Benefício já processado — não será descontado novamente.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    Atendimento avulso: {brl(appointment.price_cents)}.
                  </p>
                  <div className="pt-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Como o cliente pagou?
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(["pix", "pix_qr", "card", "cash"] as LocalPaymentMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onPayMethodChange(m)}
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                            payMethod === m
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {PAYMENT_METHOD_LABEL[m]}
                        </button>
                      ))}
                    </div>
                    {payMethod === "pix" && hasPix(shop) && (
                      <PixKeyCard
                        compact
                        className="mt-3"
                        pixKey={shop!.pix_key!}
                        pixKeyType={shop!.pix_key_type}
                        holderName={shop!.pix_holder_name}
                        amountCents={appointment.price_cents}
                      />
                    )}
                    {payMethod === "pix_qr" && hasPix(shop) && (
                      <PixQrCard
                        compact
                        className="mt-3"
                        pixKey={shop!.pix_key!}
                        pixKeyType={shop!.pix_key_type}
                        holderName={shop!.pix_holder_name}
                        amountCents={appointment.price_cents}
                        description={service?.name}
                      />
                    )}
                    {(payMethod === "pix" || payMethod === "pix_qr") && !hasPix(shop) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Cadastre sua chave Pix em Configurações para mostrá-la aqui ao cliente.
                      </p>
                    )}
                    {(appointment.payment_method === "pix" ||
                      appointment.payment_method === "pix_qr") &&
                      appointment.source === "online" && (
                        <p className="mt-2 text-xs text-primary">
                          Cliente escolheu pagar via {PAYMENT_METHOD_LABEL[appointment.payment_method]} ao
                          agendar — confira o comprovante.
                        </p>
                      )}
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(appointment.id)}>
            Concluir atendimento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
