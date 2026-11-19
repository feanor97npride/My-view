import { auth } from "@/auth";
import Reconnect from "@/components/reconnect";
import { BentoCard, SectionHeader } from "@/components/ui";
import { busyHours, timeline } from "@/lib/calendar";
import { openTasks } from "@/lib/clickup";
import { getPlanPrefs, getSelectedCalendars } from "@/lib/prefs";
import { DEFAULT_PLAN } from "@/lib/task-dates";
import WeekChart from "./week-chart";

export const metadata = { title: "Semana" };

const DAY = 86_400_000;

function parseHours(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

export default async function Semana() {
  const session = await auth();
  const [selected, planPrefs] = await Promise.all([
    getSelectedCalendars().catch(() => null),
    getPlanPrefs().catch(() => DEFAULT_PLAN),
  ]);
  const week = session?.accessToken ? await timeline(session.accessToken, new Date(), 7, selected) : null;
  // shortcut: a ClickUp failure shows a note instead of breaking the calendar view
  const tasks = await openTasks().catch((e: Error) => e);

  if (!week) {
    return (
      <main className="p-6">
        <Reconnect what="Agenda" />
      </main>
    );
  }

  const { tz, events } = week;
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const label = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", timeZone: tz });
  const longLabel = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", timeZone: tz });
  const rangeLabel = (a: Date, b: Date) =>
    `${a.toLocaleDateString("pt-BR", { day: "numeric", timeZone: tz })} a ${b.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: tz })}`;
  const time = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  const now = new Date();
  const todayKey = key(now);
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() + i * DAY));
  const taskList = Array.isArray(tasks) ? tasks : [];
  const capacityHours = Math.max(1, parseHours(planPrefs.end) - parseHours(planPrefs.start));

  const perDay = days.map((d) => {
    const k = key(d);
    const dayEvents = events.filter((e) => key(e.start) === k);
    const dayTasks = taskList.filter((t) => t.due && key(t.due) === k);
    const busy = busyHours(dayEvents);
    return { d, k, isToday: k === todayKey, dayEvents, dayTasks, busy };
  });
  const overdue = taskList.filter((t) => t.bucket === "overdue").length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-10">
      <header className="spring-card spring-d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-mute">{rangeLabel(days[0], days[6])}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Sua semana</h1>
        </div>
        {overdue > 0 && (
          <p className="chip chip-red m-0 rounded-xl px-3.5 py-2.5 text-sm">{overdue} tarefas atrasadas ainda abertas</p>
        )}
      </header>

      <BentoCard className="spring-card spring-d2 flex flex-col gap-4">
        <SectionHeader
          title="Carga por dia"
          subtitle={`Baseado no expediente configurado (${planPrefs.start}–${planPrefs.end})`}
        />
        <WeekChart
          capacityHours={capacityHours}
          data={perDay.map((p) => ({
            day: label(p.d),
            ocupado: p.busy,
            livre: Math.max(0, capacityHours - p.busy),
            isToday: p.isToday,
          }))}
        />
      </BentoCard>

      {!Array.isArray(tasks) && <p className="text-sm text-mute">ClickUp indisponível: {tasks.message}</p>}

      <section aria-label="Dias da semana" className="spring-card spring-d3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {perDay.map((p) => (
          <BentoCard
            as="article"
            key={p.k}
            className={`flex flex-col gap-2.5 !p-4 ${
              p.isToday ? "!border-2 !border-primary !bg-primary-soft/45" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {p.isToday && <span className="chip chip-primary mb-1 px-2 py-0 text-[10px]">Hoje</span>}
                <h3 className="font-display text-[16px] font-semibold capitalize leading-snug">{longLabel(p.d)}</h3>
              </div>
              <span className={`chip shrink-0 ${p.busy > capacityHours * 0.75 ? "chip-red" : p.busy > 0 ? "chip-blue" : "chip-slate"}`}>
                {p.busy > 0 ? `${p.busy.toFixed(1).replace(".", ",")}h` : "livre"}
              </span>
            </div>

            {p.dayEvents.length === 0 && p.dayTasks.length === 0 && (
              <p className="mt-1 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-mute">
                Dia livre para foco.
              </p>
            )}

            {p.dayEvents.map((e) => (
              <p key={e.id} className="m-0 text-[13px] leading-snug">
                <span className="tabular-nums text-mute">{e.allDay ? "Dia inteiro" : `${time(e.start)} – ${time(e.end)}`}</span>
                <br />
                {e.link ? (
                  <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:underline">
                    {e.title}
                    <span className="sr-only"> (abre no Google Agenda, em nova aba)</span>
                  </a>
                ) : (
                  <span className="font-semibold">{e.title}</span>
                )}
              </p>
            ))}

            {p.dayTasks.map((t) => (
              <p key={t.id} className="m-0 text-[13px] leading-snug">
                <span className="chip chip-amber px-2 py-px text-[11px]">Prazo</span>
                <br />
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:underline">
                  {t.title}
                  <span className="sr-only"> (abre no ClickUp, em nova aba)</span>
                </a>
                <span className="text-mute"> · {t.list}</span>
              </p>
            ))}
          </BentoCard>
        ))}
      </section>
    </main>
  );
}
