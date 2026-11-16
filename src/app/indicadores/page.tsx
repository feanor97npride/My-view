import Link from "next/link";
import { auth } from "@/auth";
import { primaryTz } from "@/lib/calendar";
import { completedDates, countByDay, openTasks } from "@/lib/clickup";
import { emailCounts } from "@/lib/gmail";
import { CategoryBars, DoneTrend, StatusPie } from "./charts";

const note = (what: string, e: Error) => <p className="text-sm opacity-70">{what} indisponível: {e.message}</p>;

export default async function Indicadores() {
  const session = await auth();
  const [tasks, done, mail, tz] = await Promise.all([
    openTasks().catch((e: Error) => e),
    completedDates().catch((e: Error) => e),
    emailCounts().catch((e: Error) => e),
    session?.accessToken ? primaryTz(session.accessToken).catch(() => "UTC") : "UTC",
  ]);

  const byStatus = Array.isArray(tasks)
    ? Object.entries(Object.groupBy(tasks, (t) => t.status)).map(([name, list]) => ({ name, value: list?.length ?? 0 }))
    : [];
  const overdue = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue").length : 0;
  const today = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "today").length : 0;
  const trend = Array.isArray(done) ? countByDay(done, 14, tz) : [];
  const tiles = [
    ["Abertas", Array.isArray(tasks) ? tasks.length : "–"],
    ["Atrasadas", Array.isArray(tasks) ? overdue : "–"],
    ["Vencem hoje", Array.isArray(tasks) ? today : "–"],
    ["Concluídas (14 dias)", Array.isArray(done) ? done.length : "–"],
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Indicadores</h1>
        <Link href="/" className="text-sm underline">Hoje</Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className={`rounded-lg bg-black/5 p-3 dark:bg-white/10 ${label === "Atrasadas" && overdue > 0 ? "text-red-600" : ""}`}>
            <p className="text-sm opacity-70">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Tarefas abertas por status</h2>
        {tasks instanceof Error ? note("ClickUp", tasks) : <StatusPie data={byStatus} />}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Tarefas concluídas por dia</h2>
        {done instanceof Error ? note("ClickUp", done) : <DoneTrend data={trend} />}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">E-mails por categoria (7 dias)</h2>
        {mail instanceof Error ? (
          note("Banco", mail)
        ) : (
          <CategoryBars data={Object.entries(mail).map(([name, value]) => ({ name, value }))} />
        )}
      </section>
    </main>
  );
}
