import { auth } from "@/auth";
import { primaryTz } from "@/lib/calendar";
import { canonicalStatus, completedDates, countByDay, openTasks } from "@/lib/clickup";
import { CATEGORIES } from "@/lib/email-rules";
import { emailCounts } from "@/lib/gmail";
import IndicadoresView, { type ListRow, type MailRow, type StatusRow } from "./indicadores-view";

export const metadata = { title: "Indicadores" };

const CATEGORY_LABELS: Record<string, string> = {
  acao: "Ação",
  financeiro: "Financeiro",
  agendamento: "Agendamento",
  trabalho: "Trabalho",
  pessoal: "Pessoal",
  informativo: "Informativo",
  compras: "Compras",
  viagens: "Viagens",
  seguranca: "Segurança",
  saude: "Saúde",
  educacao: "Educação",
  social: "Social",
  promocao: "Promoções",
};

export default async function Indicadores() {
  const session = await auth();
  const [tasks, done, mail, tz] = await Promise.all([
    openTasks().catch((e: Error) => e),
    completedDates().catch((e: Error) => e),
    emailCounts().catch((e: Error) => e),
    session?.accessToken ? primaryTz(session.accessToken).catch(() => "UTC") : "UTC",
  ]);

  const tasksOk = Array.isArray(tasks);
  const doneOk = Array.isArray(done);
  const mailOk = !(mail instanceof Error);

  const byStatus: StatusRow[] = tasksOk
    ? Object.entries(Object.groupBy(tasks, (t) => canonicalStatus(t.status)))
        .map(([name, list]) => ({ name, value: list?.length ?? 0 }))
        .sort((a, b) => b.value - a.value)
    : [];

  const byList: ListRow[] = tasksOk
    ? Object.entries(Object.groupBy(tasks, (t) => t.list))
        .map(([name, list]) => ({
          name,
          total: list?.length ?? 0,
          overdue: list?.filter((t) => t.bucket === "overdue").length ?? 0,
          today: list?.filter((t) => t.bucket === "today").length ?? 0,
        }))
        .sort((a, b) => b.total - a.total)
    : [];

  const overdue = tasksOk ? tasks.filter((t) => t.bucket === "overdue").length : 0;
  const dueToday = tasksOk ? tasks.filter((t) => t.bucket === "today").length : 0;
  const trend = doneOk ? countByDay(done, 14, tz) : [];

  const mailRows: MailRow[] = mailOk
    ? CATEGORIES.map((key) => ({
        key,
        label: CATEGORY_LABELS[key] ?? key,
        value: mail[key] ?? 0,
      }))
    : [];

  return (
    <IndicadoresView
      tasksError={tasks instanceof Error ? tasks.message : null}
      doneError={done instanceof Error ? done.message : null}
      mailError={mail instanceof Error ? mail.message : null}
      totalOpen={tasksOk ? tasks.length : 0}
      overdue={overdue}
      dueToday={dueToday}
      doneCount={doneOk ? done.length : 0}
      byStatus={byStatus}
      byList={byList}
      trend={trend}
      mailRows={mailRows}
    />
  );
}
