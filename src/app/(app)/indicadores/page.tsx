import { auth } from "@/auth";
import { primaryTz } from "@/lib/calendar";
import { canonicalStatus, completedDates, countByDay, openTasks } from "@/lib/clickup";
import { emailCounts } from "@/lib/gmail";
import { CategoryBars, DoneTrend, StatusPie } from "./charts";

const note = (what: string, e: Error) => <p className="text-sm text-mute">{what} indisponível: {e.message}</p>;

export default async function Indicadores() {
  const session = await auth();
  const [tasks, done, mail, tz] = await Promise.all([
    openTasks().catch((e: Error) => e),
    completedDates().catch((e: Error) => e),
    emailCounts().catch((e: Error) => e),
    session?.accessToken ? primaryTz(session.accessToken).catch(() => "UTC") : "UTC",
  ]);

  const byStatus = Array.isArray(tasks)
    ? Object.entries(Object.groupBy(tasks, (t) => canonicalStatus(t.status))).map(([name, list]) => ({ name, value: list?.length ?? 0 }))
    : [];
  const overdue = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue").length : 0;
  const today = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "today").length : 0;
  const trend = Array.isArray(done) ? countByDay(done, 14, tz) : [];
  const tiles: [string, string | number, string][] = [
    ["Abertas", Array.isArray(tasks) ? tasks.length : "–", ""],
    ["Atrasadas", Array.isArray(tasks) ? overdue : "–", overdue > 0 ? "var(--red-fg)" : ""],
    ["Vencem hoje", Array.isArray(tasks) ? today : "–", ""],
    ["Concluídas (14 dias)", Array.isArray(done) ? done.length : "–", "var(--trend)"],
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-10">
      <header>
        <p className="text-sm text-mute">ClickUp · Gmail · últimos 14 dias</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Indicadores</h1>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {tiles.map(([label, value, color]) => (
          <div key={label} className="card px-5 py-[18px]">
            <p className="text-[13px] text-mute">{label}</p>
            <p className="font-display text-4xl font-bold leading-tight" style={color ? { color } : undefined}>{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-stretch gap-6">
        <section className="card min-w-0 flex-[1_1_360px]">
          <h2 className="font-display text-xl font-semibold">Tarefas abertas por status</h2>
          <p className="mb-3 text-[13px] text-mute">Status equivalentes já agrupados</p>
          {tasks instanceof Error ? note("ClickUp", tasks) : <StatusPie data={byStatus} />}
        </section>

        <section className="card min-w-0 flex-[1.4_1_420px]">
          <h2 className="font-display text-xl font-semibold">Tarefas concluídas por dia</h2>
          <p className="mb-3 text-[13px] text-mute">Últimos 14 dias</p>
          {done instanceof Error ? note("ClickUp", done) : <DoneTrend data={trend} />}
        </section>
      </div>

      <section className="card">
        <h2 className="font-display text-xl font-semibold">E-mails por categoria</h2>
        <p className="mb-3 text-[13px] text-mute">Últimos 7 dias · classificação por regras e IA</p>
        {mail instanceof Error ? (
          note("Banco", mail)
        ) : (
          <CategoryBars data={Object.entries(mail).map(([name, value]) => ({ name, value }))} />
        )}
      </section>
    </main>
  );
}
