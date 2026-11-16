import { auth, signOut } from "@/auth";
import Link from "next/link";
import { timeline } from "@/lib/calendar";
import { openTasks } from "@/lib/clickup";
import { syncEmails } from "@/lib/gmail";

export default async function Home() {
  const session = await auth();
  const today = session?.accessToken ? await timeline(session.accessToken) : null;
  // shortcut: a Gmail failure shows a note instead of breaking the rest of the page
  const mail = session?.accessToken ? await syncEmails(session.accessToken).catch((e: Error) => e) : null;
  // shortcut: a ClickUp failure shows a note instead of breaking the calendar section
  const tasks = await openTasks().catch((e: Error) => e);
  const urgent = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue" || t.bucket === "today") : [];
  const fmt = (d: Date, tz: string) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hoje</h1>
        <Link href="/semana" className="text-sm underline">Semana</Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm underline">Sair</button>
        </form>
      </header>

      {!today && <p>Agenda indisponível. Entre de novo para reconectar o Google Calendar.</p>}

      {today && today.events.length === 0 && <p>Nenhum compromisso hoje.</p>}

      {today && (
        <ol className="flex flex-col gap-3">
          {today.events.map((e) => (
            <li key={e.id} className="rounded-lg border-l-4 border-blue-500 bg-black/5 p-3 dark:bg-white/10">
              <p className="text-sm opacity-70">
                {e.allDay ? "Dia inteiro" : `${fmt(e.start, today.tz)} – ${fmt(e.end, today.tz)}`} · {e.calendar}
              </p>
              <p className="font-medium">{e.title}</p>
            </li>
          ))}
        </ol>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tarefas</h2>
        {!Array.isArray(tasks) && <p className="text-sm opacity-70">ClickUp indisponível: {tasks.message}</p>}
        {Array.isArray(tasks) && urgent.length === 0 && <p>Nada atrasado nem para hoje.</p>}
        {urgent.map((t) => (
          <div key={t.id} className={`rounded-lg border-l-4 p-3 bg-black/5 dark:bg-white/10 ${t.bucket === "overdue" ? "border-red-500" : "border-amber-500"}`}>
            <p className="text-sm opacity-70">
              {t.bucket === "overdue" ? "Atrasada" : "Hoje"} · {t.list} · {t.status}
            </p>
            <p className="font-medium">{t.title}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">E-mails (últimos 7 dias)</h2>
        {mail instanceof Error && <p className="text-sm opacity-70">Gmail indisponível: {mail.message}</p>}
        {mail && !(mail instanceof Error) && (
          <>
            <p className="text-sm">
              {Object.entries(mail.counts).map(([c, n]) => `${c}: ${n}`).join(" · ") || "Nenhum e-mail recente."}
            </p>
            {mail.actions.map((m, i) => (
              <div key={i} className="rounded-lg border-l-4 border-violet-500 bg-black/5 p-3 dark:bg-white/10">
                <p className="text-sm opacity-70">{m.sender}</p>
                <p className="font-medium">{m.subject}</p>
              </div>
            ))}
          </>
        )}
      </section>
    </main>
  );
}
