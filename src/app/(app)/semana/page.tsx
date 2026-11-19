import { auth } from "@/auth";
import Reconnect from "@/components/reconnect";
import RetryNotice from "@/components/retry-notice";
import { busyHours, timeline } from "@/lib/calendar";
import { openTasks } from "@/lib/clickup";
import { getPlanPrefs, getSelectedCalendars } from "@/lib/prefs";
import { DEFAULT_PLAN } from "@/lib/task-dates";
import WeekBoard, { type WeekDay } from "./week-board";

export const metadata = { title: "Semana" };

const DAY = 86_400_000;

function parseHours(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

export default async function Semana() {
  const session = await auth();
  const [selected, planPrefs, tasks] = await Promise.all([
    getSelectedCalendars().catch(() => null),
    getPlanPrefs().catch(() => DEFAULT_PLAN),
    openTasks().catch((e: Error) => e),
  ]);
  const week = session?.accessToken ? await timeline(session.accessToken, new Date(), 7, selected) : null;

  if (!week) {
    return (
      <main className="p-6">
        <Reconnect what="Agenda" />
      </main>
    );
  }

  const { tz, events } = week;
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const weekdayName = (d: Date) =>
    d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: tz }).split("-")[0];
  const dayNum = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: tz });
  const longLabel = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", timeZone: tz });
  const rangeLabel = (a: Date, b: Date) =>
    `${a.toLocaleDateString("pt-BR", { day: "numeric", timeZone: tz })} a ${b.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: tz })}`;
  const time = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const hourOf = (d: Date) => Number(d.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }));

  const now = new Date();
  const todayKey = key(now);
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() + i * DAY));
  const taskList = Array.isArray(tasks) ? tasks : [];
  const capacityHours = Math.max(1, parseHours(planPrefs.end) - parseHours(planPrefs.start));

  const perDay: WeekDay[] = days.map((d) => {
    const k = key(d);
    const shortEn = d.toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
    const dayEvents = events.filter((e) => key(e.start) === k);
    const dayTasks = taskList.filter((t) => t.due && key(t.due) === k);
    const busy = busyHours(dayEvents);
    return {
      key: k,
      weekdayName: weekdayName(d),
      dayNum: dayNum(d),
      longLabel: longLabel(d),
      isToday: k === todayKey,
      isWeekend: shortEn === "Sat" || shortEn === "Sun",
      busy,
      events: dayEvents.map((e) => ({
        id: e.id,
        title: e.title,
        allDay: e.allDay,
        timeLabel: `${time(e.start)} – ${time(e.end)}`,
        startHour: e.allDay ? undefined : hourOf(e.start),
        endHour: e.allDay ? undefined : hourOf(e.end),
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
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10">
      <header className="spring-card spring-d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-mute">{rangeLabel(days[0], days[6])} · Expediente {planPrefs.start}–{planPrefs.end}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Sua semana</h1>
        </div>
        {overdue > 0 && (
          <p className="chip chip-red m-0 rounded-xl px-3.5 py-2.5 text-sm">{overdue} tarefas atrasadas ainda abertas</p>
        )}
      </header>

      {!Array.isArray(tasks) && <RetryNotice message={`ClickUp indisponível: ${tasks.message}`} />}

      <WeekBoard initialDays={perDay} capacityHours={capacityHours} />
    </main>
  );
}
