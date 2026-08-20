export type BreakRow = {
  id: string;
  name: string;
  barber_id: string | null;
  start_time: string;
  end_time: string;
  weekdays: number[];
  specific_date: string | null;
};

export type HoursRow = {
  weekday: number;
  open_time: string;
  close_time: string;
  closed: boolean;
};

export type Busy = { starts_at: string; ends_at: string };

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const dayKey = (d: Date) => {
  const copy = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
};

/** Pausas que valem para um dia/profissional específicos. */
export function breaksForDay(breaks: BreakRow[], day: Date, barberId?: string | null) {
  const dow = day.getDay();
  const key = dayKey(day);
  return breaks.filter((b) => {
    if (b.barber_id && barberId && b.barber_id !== barberId) return false;
    if (b.specific_date) return b.specific_date === key;
    return b.weekdays.includes(dow);
  });
}

/**
 * Calcula os horários livres respeitando: expediente da barbearia,
 * jornada do profissional, duração do serviço, pausas/bloqueios,
 * agendamentos existentes e o horário atual.
 */
export function availableSlots(opts: {
  day: Date;
  durationMin: number;
  stepMin?: number;
  hours?: HoursRow | undefined;
  barber?: { work_days: number[]; start_time: string; end_time: string } | undefined;
  breaks: BreakRow[];
  busy: Busy[];
  barberId?: string | null;
}): string[] {
  const { day, durationMin, hours, barber, breaks, busy, barberId } = opts;
  const step = opts.stepMin ?? 15;
  const dow = day.getDay();

  if (hours?.closed) return [];
  if (barber && !barber.work_days.includes(dow)) return [];

  const openMin = Math.max(
    toMinutes(hours?.open_time ?? "09:00"),
    barber ? toMinutes(barber.start_time) : 0,
  );
  const closeMin = Math.min(
    toMinutes(hours?.close_time ?? "20:00"),
    barber ? toMinutes(barber.end_time) : 24 * 60,
  );
  if (closeMin <= openMin) return [];

  const dayBreaks = breaksForDay(breaks, day, barberId).map((b) => ({
    from: toMinutes(b.start_time),
    to: toMinutes(b.end_time),
  }));

  const out: string[] = [];
  for (let m = openMin; m + durationMin <= closeMin; m += step) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(m);
    const end = new Date(start.getTime() + durationMin * 60000);
    if (start.getTime() <= Date.now()) continue;

    const inBreak = dayBreaks.some((b) => m < b.to && m + durationMin > b.from);
    if (inBreak) continue;

    const taken = busy.some((b) => {
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      return start.getTime() < be && end.getTime() > bs;
    });
    if (taken) continue;

    out.push(start.toISOString());
  }
  return out;
}
