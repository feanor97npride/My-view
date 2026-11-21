import Link from "next/link";
import { auth } from "@/auth";
import ClickupBoard, { type ClickupBoardTask } from "@/components/clickup-board";
import RetryNotice from "@/components/retry-notice";
import { BentoCard } from "@/components/ui";
import { primaryTz } from "@/lib/calendar";
import { CLICKUP_LISTS, cachedListStatuses, openTasks } from "@/lib/clickup";
import { gmailThreadUrl } from "@/lib/email-view";
import { originsByTask } from "@/lib/links";
import { getDefaultClickupList, getUserClickupToken } from "@/lib/prefs";

export const metadata = { title: "ClickUp" };

export default async function ClickupPage() {
  const session = await auth();
  const account = session?.user?.email ?? "";
  const [token, defaultListId, tz, tasks] = await Promise.all([
    getUserClickupToken().catch(() => null),
    getDefaultClickupList().catch(() => CLICKUP_LISTS[0].id),
    session?.accessToken ? primaryTz(session.accessToken).catch(() => "UTC") : Promise.resolve("UTC"),
    openTasks().catch((e: Error) => e),
  ]);

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10">
        <header>
          <p className="text-sm text-mute">Gestão completa das suas listas configuradas</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">ClickUp</h1>
        </header>
        <BentoCard className="flex flex-col items-start gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Conecte seu ClickUp</h2>
          <p className="m-0 text-sm text-mute">
            Configure o token pessoal do ClickUp (<code className="text-xs">pk_...</code>) para visualizar, criar, concluir e gerenciar todas as suas tarefas aqui.
          </p>
          <Link href="/configuracoes?aba=clickup" className="btn btn-primary spring-btn no-underline">
            Configurar token em Configurações →
          </Link>
        </BentoCard>
      </main>
    );
  }

  const taskList = Array.isArray(tasks) ? tasks : [];
  const listIds = CLICKUP_LISTS.map((l) => l.id);
  const taskIds = taskList.map((t) => t.id);

  const [origins, ...statusEntries] = await Promise.all([
    taskIds.length > 0
      ? originsByTask(taskIds).catch(() => ({}) as Awaited<ReturnType<typeof originsByTask>>)
      : Promise.resolve({} as Awaited<ReturnType<typeof originsByTask>>),
    ...listIds.map(async (id) => [id, (await cachedListStatuses(id).catch(() => [])).map((x) => x.status)] as const),
  ]);
  const statuses: Record<string, string[]> = Object.fromEntries(statusEntries);

  const mapped: ClickupBoardTask[] = taskList.map((t) => ({
    id: t.id,
    title: t.title,
    list: t.list,
    listId: t.listId,
    status: t.status,
    bucket:
      t.bucket === "overdue" || t.bucket === "today"
        ? t.bucket
        : t.bucket === "nodate"
          ? "none"
          : "upcoming",
    dueLabel: t.due ? t.due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz }) : null,
    priority: t.priority,
    url: t.url,
    origin: origins[t.id]
      ? { subject: origins[t.id].subject, url: gmailThreadUrl(account, origins[t.id].threadId) }
      : undefined,
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10">
      <header className="spring-card spring-d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-mute">Todas as tarefas abertas das suas listas configuradas</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">ClickUp</h1>
        </div>
      </header>

      {!Array.isArray(tasks) && <RetryNotice message={`ClickUp indisponível: ${tasks.message}`} />}

      <ClickupBoard
        initialTasks={mapped}
        lists={CLICKUP_LISTS.map((l) => ({ id: l.id, name: l.name }))}
        statuses={statuses}
        defaultListId={defaultListId}
      />
    </main>
  );
}
