import { auth, signOut } from "@/auth";
import { todayTimeline } from "@/lib/calendar";

export default async function Home() {
  const session = await auth();
  const today = session?.accessToken ? await todayTimeline(session.accessToken) : null;
  const fmt = (d: Date, tz: string) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hoje</h1>
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
    </main>
  );
}
