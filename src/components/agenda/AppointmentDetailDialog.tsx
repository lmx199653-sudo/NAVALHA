import { Ban, Check, MessageCircle, Pencil, UserX, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brl, timeLabel } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/pix";
import { StatusBadge } from "./StatusBadge";
import {
  durationMin,
  reminderText,
  waLink,
  type Appointment,
  type BarberSummary,
  type ServiceSummary,
} from "./types";

function Info({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-sm ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

interface AppointmentDetailDialogProps {
  appointment: Appointment | null;
  onClose: () => void;
  shopName?: string | undefined;
  barbers: BarberSummary[];
  services: ServiceSummary[];
  onEdit: (id: string) => void;
  onConfirmDone: (appointment: Appointment) => void;
  onRefund: (id: string) => void;
  onSetStatus: (params: { id: string; status: string }) => void;
  onDelete: (id: string) => void;
}

export function AppointmentDetailDialog({
  appointment,
  onClose,
  shopName,
  barbers,
  services,
  onEdit,
  onConfirmDone,
  onRefund,
  onSetStatus,
  onDelete,
}: AppointmentDetailDialogProps) {
  if (!appointment) return null;

  return (
    <Dialog open={!!appointment} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="font-display text-2xl tracking-wide">
              {appointment.customer_name}
            </DialogTitle>
            <StatusBadge status={appointment.status} />
          </div>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-border bg-secondary/20 p-4">
            <Info
              label="Horário"
              value={`${timeLabel(appointment.starts_at)} · ${durationMin(appointment.starts_at, appointment.ends_at)} min`}
            />
            <Info
              label="Valor"
              value={brl(appointment.price_cents)}
              valueClass="font-semibold text-primary"
            />
            <Info
              label="Serviço"
              value={services.find((s) => s.id === appointment.service_id)?.name ?? "—"}
            />
            <Info
              label="Barbeiro"
              value={barbers.find((b) => b.id === appointment.barber_id)?.name ?? "—"}
            />
            <Info label="Telefone" value={appointment.customer_phone ?? "—"} />
            <Info
              label="Pagamento"
              value={`${PAYMENT_METHOD_LABEL[appointment.payment_method ?? ""] ?? "—"}${
                appointment.payment_state === "paid" ? " · pago" : ""
              }`}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ações
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onEdit(appointment.id)}
              >
                <Pencil className="size-4" /> Editar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!appointment.customer_phone}
                onClick={() =>
                  window.open(
                    waLink(
                      appointment.customer_phone,
                      reminderText(
                        shopName ?? "barbearia",
                        appointment.customer_name,
                        appointment.starts_at,
                      ),
                    ),
                    "_blank",
                  )
                }
              >
                <MessageCircle className="size-4" /> Avisar cliente
              </Button>
              <Button
                size="sm"
                onClick={() => onConfirmDone(appointment)}
              >
                <Check className="size-4" /> Concluir
              </Button>
              {appointment.benefit_processed && (
                <Button size="sm" variant="outline" onClick={() => onRefund(appointment.id)}>
                  Estornar crédito
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetStatus({ id: appointment.id, status: "no_show" })}
              >
                <UserX className="size-4" /> Faltou
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetStatus({ id: appointment.id, status: "canceled" })}
              >
                <X className="size-4" /> Cancelar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(appointment.id)}
              >
                <Ban className="size-4" /> Excluir
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Dica: na visão por dia você pode arrastar o agendamento para outro horário.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
