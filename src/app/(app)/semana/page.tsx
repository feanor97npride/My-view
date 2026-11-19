import { auth } from "@/auth";
import Reconnect from "@/components/reconnect";
import RetryNotice from "@/components/retry-notice";
import { BentoCard, SectionHeader } from "@/components/ui";
import { busyHours, timeline } from "@/lib/calendar";
import { openTasks } from "@/lib/clickup";
import { getPlanPrefs, getSelectedCalendars } from "@/lib/prefs";
import { DEFAULT_PLAN } from "@/lib/task-dates";
import WeekBoard, { type WeekDay } from "./week-board";
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

  const perDay: WeekDay[] = days.map((d) => {
    const k = key(d);
    const dayEvents = events.filter((e) => key(e.start) === k);
    const dayTasks = taskList.filter((t) => t.due && key(t.due) === k);
    const busy = busyHours(dayEvents);
    return {
      key: k,
      longLabel: longLabel(d),
      isToday: k === todayKey,
      busy,
      events: dayEvents.map((e) => ({
        id: e.id,
        title: e.title,
        allDay: e.allDay,
        timeLabel: `${time(e.start)} – ${time(e.end)}`,
        link: e.link,
      })),
      tasks: dayTasks.map((t) => ({
        id: t.id,
        title: t.title,
        list: t.list,
        url: t.url,
        dayKey: k,
      })),
    };
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
          data={perDay.map((p, idx) => ({
            day: label(days[idx]),
            ocupado: p.busy,
            livre: Math.max(0, capacityHours - p.busy),
            isToday: p.isToday,
          }))}
        />
      </BentoCard>

      {!Array.isArray(tasks) && <RetryNotice message={`ClickUp indisponível: ${tasks.message}`} />}

      <WeekBoard initialDays={perDay} capacityHours={capacityHours} />
    </main>
  );
}
