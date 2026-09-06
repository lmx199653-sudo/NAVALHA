import { STATUS_LABEL } from "@/lib/format";
import { FALLBACK_STATUS, statusDot, statusTone } from "./types";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone[status] ?? statusTone[FALLBACK_STATUS]}`}
    >
      <span
        className={`size-1.5 rounded-full ${statusDot[status] ?? statusDot[FALLBACK_STATUS]}`}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function StatusLegend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Status
      </span>
      {[
        { status: "confirmed", label: "Confirmado" },
        { status: "scheduled", label: "Pendente" },
        { status: "done", label: "Concluído" },
        { status: "canceled", label: "Cancelado" },
        { status: "no_show", label: "Faltou" },
      ].map(({ status, label }) => (
        <div key={status} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${statusDot[status]}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
