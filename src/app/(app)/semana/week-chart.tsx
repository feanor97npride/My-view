export type DayLoad = {
  day: string;
  ocupado: number;
  livre: number;
  isToday?: boolean;
};

export default function WeekChart({ data, capacityHours }: { data: DayLoad[]; capacityHours: number }) {
  const maxScale = Math.max(capacityHours, ...data.map((d) => d.ocupado + d.livre), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-busy)" }} aria-hidden="true" />
            Ocupado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-free)" }} aria-hidden="true" />
            Livre (expediente {capacityHours.toFixed(0)}h)
          </span>
        </div>
      </div>

      <div
        role="img"
        aria-label="Horas ocupadas e livres por dia da semana"
        className="grid h-48 grid-cols-7 items-end gap-2.5 pt-4 sm:gap-4"
      >
        {data.map((d) => {
          const total = Math.max(d.ocupado + d.livre, capacityHours);
          const barPct = Math.round((total / maxScale) * 100);
          const busyPct = total > 0 ? Math.min(100, Math.round((d.ocupado / total) * 100)) : 0;
          const busyLabel = `${d.ocupado.toFixed(1).replace(".", ",")}h`;
          const freeLabel = `${d.livre.toFixed(1).replace(".", ",")}h`;

          return (
            <div key={d.day} className="group flex h-full flex-col items-center justify-end gap-2">
              <span className="font-display text-[11px] font-semibold tabular-nums text-mute transition-colors group-hover:text-ink">
                {busyLabel}
              </span>
              <div
                title={`${d.day}: ${busyLabel} ocupado · ${freeLabel} livre`}
                className="flex w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5"
                style={{ height: `${Math.max(24, barPct)}%`, background: "var(--chart-free)" }}
              >
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{ height: `${busyPct}%`, background: "var(--chart-busy)" }}
                />
              </div>
              <span
                className={`text-center text-[11px] capitalize ${
                  d.isToday ? "font-bold text-primary" : "font-medium text-mute"
                }`}
              >
                {d.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
