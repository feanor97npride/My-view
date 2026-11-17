import { auth } from "@/auth";
import { busyHours, timeline } from "@/lib/calendar";
import { openTasks } from "@/lib/clickup";
import { getSelectedCalendars } from "@/lib/prefs";
import Reconnect from "@/components/reconnect";
import WeekChart from "./week-chart";

export const metadata = { title: "Semana" };

const DAY = 86_400_000;

export default async function Semana() {
  const session = await auth();
  const selected = await getSelectedCalendars().catch(() => null);
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
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * DAY));
  const taskList = Array.isArray(tasks) ? tasks : [];

  const perDay = days.map((d) => {
    const k = key(d);
    const dayEvents = events.filter((e) => key(e.start) === k);
    const dayTasks = taskList.filter((t) => t.due && key(t.due) === k);
    // shortcut: assumes a 12h waking day, so free time is 12h minus meetings
    const busy = busyHours(dayEvents);
    return { d, dayEvents, dayTasks, busy };
  });
  const overdue = taskList.filter((t) => t.bucket === "overdue").length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-mute">{rangeLabel(days[0], days[6])}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Sua semana</h1>
        </div>
        {overdue > 0 && (
          <p className="chip chip-red m-0 rounded-xl px-3.5 py-2.5 text-sm">{overdue} tarefas atrasadas ainda abertas</p>
        )}
      </header>

      <section className="card">
        <h2 className="mb-2 font-display text-xl font-semibold">Carga por dia</h2>
        <WeekChart data={perDay.map((p) => ({ day: label(p.d), ocupado: p.busy, livre: Math.max(0, 12 - p.busy) }))} />
      </section>

      {!Array.isArray(tasks) && <p className="text-sm text-mute">ClickUp indisponível: {tasks.message}</p>}

      <section aria-label="Dias da semana" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {perDay.map((p) => (
          <article key={key(p.d)} className="card flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-[17px] font-semibold capitalize">{longLabel(p.d)}</h3>
              <span className={`chip ${p.busy > 6 ? "chip-red" : p.busy > 0 ? "chip-blue" : "chip-slate"}`}>
                {p.busy > 0 ? `${p.busy.toFixed(1).replace(".", ",")}h` : "livre"}
              </span>
            </div>
            {p.dayEvents.length === 0 && p.dayTasks.length === 0 && <p className="text-sm text-mute">Dia livre.</p>}
            {p.dayEvents.map((e) => (
              <p key={e.id} className="text-[13px] leading-snug">
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
              <p key={t.id} className="text-[13px] leading-snug">
                <span className="chip chip-amber px-2 py-px text-[11px]">Prazo</span>
                <br />
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink no-underline hover:underline">
                  {t.title}
                  <span className="sr-only"> (abre no ClickUp, em nova aba)</span>
                </a>
                <span className="text-mute"> · {t.list}</span>
              </p>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
