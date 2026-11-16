import Link from "next/link";
import { auth } from "@/auth";
import { busyHours, timeline } from "@/lib/calendar";
import { openTasks } from "@/lib/clickup";
import WeekChart from "./week-chart";

const DAY = 86_400_000;

export default async function Semana() {
  const session = await auth();
  const week = session?.accessToken ? await timeline(session.accessToken, new Date(), 7) : null;
  // shortcut: a ClickUp failure shows a note instead of breaking the calendar view
  const tasks = await openTasks().catch((e: Error) => e);

  if (!week) {
    return <main className="p-4">Agenda indisponível. Entre de novo para reconectar o Google Calendar.</main>;
  }

  const { tz, events } = week;
  const key = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const label = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", timeZone: tz });
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Semana</h1>
        <Link href="/" className="text-sm underline">Hoje</Link>
      </header>

      <WeekChart data={perDay.map((p) => ({ day: label(p.d), ocupado: p.busy, livre: Math.max(0, 12 - p.busy) }))} />

      {!Array.isArray(tasks) && <p className="text-sm opacity-70">ClickUp indisponível: {tasks.message}</p>}
      {overdue > 0 && <p className="text-sm text-red-600">{overdue} tarefa(s) atrasada(s) ainda abertas.</p>}

      <ol className="flex flex-col gap-4">
        {perDay.map((p) => (
          <li key={key(p.d)} className="rounded-lg bg-black/5 p-3 dark:bg-white/10">
            <h2 className="font-semibold capitalize">{label(p.d)}</h2>
            {p.dayEvents.length === 0 && p.dayTasks.length === 0 && <p className="text-sm opacity-70">Livre.</p>}
            {p.dayEvents.map((e) => (
              <p key={e.id} className="text-sm">
                <span className="opacity-70">{e.allDay ? "Dia inteiro" : `${time(e.start)} – ${time(e.end)}`}</span> {e.title}
              </p>
            ))}
            {p.dayTasks.map((t) => (
              <p key={t.id} className="text-sm">
                <span className="text-amber-600">Prazo</span> {t.title} <span className="opacity-70">· {t.list}</span>
              </p>
            ))}
          </li>
        ))}
      </ol>
    </main>
  );
}
