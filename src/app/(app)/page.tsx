import Link from "next/link";
import { auth } from "@/auth";
import DailyBriefing from "@/components/daily-briefing";
import DayPlan from "@/components/day-plan";
import DayRing from "@/components/day-ring";
import HomeActionEmails from "@/components/home-action-emails";
import LiveMeeting from "@/components/live-meeting";
import ProactivePlan from "@/components/proactive-plan";
import QuickNotes from "@/components/quick-notes";
import Reconnect from "@/components/reconnect";
import RefreshButton from "@/components/refresh-button";
import RetryNotice from "@/components/retry-notice";
import TodayTasks from "@/components/today-tasks";
import { busyHours, timeline } from "@/lib/calendar";
import { cachedListStatuses, openTasks } from "@/lib/clickup";
import { staticAlerts, summarize } from "@/lib/day-summary";
import { gmailThreadUrl } from "@/lib/email-view";
import { originsByTask } from "@/lib/links";
import { awaitingReply, syncEmails } from "@/lib/gmail";
import { getAwaitingDays, getMeetingWindow, getPlanPrefs, getQuickNotes, getSelectedCalendars } from "@/lib/prefs";
import { DEFAULT_PLAN, dayKey, freeBlocks, planOverdue, scoreTask, suggestPlan, zonedMs, type Candidate } from "@/lib/task-dates";
import { extractFinance, filaOf, financeDueDays } from "@/lib/triage";

export const metadata = { title: "Hoje" };

export default async function Home() {
  const session = await auth();
  const token = session?.accessToken;
  const email = session?.user?.email;

  // Rodada 1: preferências, tarefas e e-mails em paralelo (sem waterfall sequencial)
  const [selected, windowMin, planPrefs, awaitingDays, quickNotes, tasks, mail] = await Promise.all([
    getSelectedCalendars().catch(() => null),
    getMeetingWindow().catch(() => 30),
    getPlanPrefs().catch(() => DEFAULT_PLAN),
    getAwaitingDays().catch(() => 2),
    getQuickNotes().catch(() => ""),
    openTasks().catch((e: Error) => e),
    token ? syncEmails(token).catch((e: Error) => e) : Promise.resolve(null),
  ]);

  const urgentRaw = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue" || t.bucket === "today") : [];
  const listIds = [...new Set(urgentRaw.map((t) => t.listId).filter(Boolean))];
  const urgentIds = urgentRaw.map((t) => t.id);

  // Rodada 2: timeline (depende de selected), waiting (depende de awaitingDays), statuses e origins (dependem de tasks)
  const [today, waiting, origins, ...statusEntries] = await Promise.all([
    token ? timeline(token, new Date(), 1, selected) : Promise.resolve(null),
    token && email ? awaitingReply(token, email, awaitingDays).catch(() => null) : Promise.resolve(null),
    urgentIds.length > 0
      ? originsByTask(urgentIds).catch(() => ({}) as Awaited<ReturnType<typeof originsByTask>>)
      : Promise.resolve({} as Awaited<ReturnType<typeof originsByTask>>),
    ...listIds.map(async (id) => [id, (await cachedListStatuses(id).catch(() => [])).map((x) => x.status)] as const),
  ]);
  const statuses: Record<string, string[]> = Object.fromEntries(statusEntries);

  const now = new Date();
  const tz = today?.tz ?? "UTC";
  const hour = Number(now.toLocaleString("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: tz }));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = session?.user?.name?.split(" ")[0] ?? "";
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const fmt = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  const urgent = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue" || t.bucket === "today") : [];
  const overdue = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue").length : 0;
  const dueToday = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "today").length : 0;
  const account = session?.user?.email ?? "";
  const actions = mail && !(mail instanceof Error) ? mail.emails.filter((e) => filaOf(e.category) === "acao" && e.unread) : [];
  const nextEvent = today?.events.find((e) => !e.allDay && e.start > now);

  // Summary and alerts: a source that failed is null, so it is left out instead of showing a false zero.
  const tasksOk = Array.isArray(tasks);
  const mailOk = !!mail && !(mail instanceof Error);
  const oldestOverdueDays = Array.isArray(tasks)
    ? Math.max(0, ...tasks.filter((t) => t.bucket === "overdue" && t.due).map((t) => Math.floor((now.getTime() - t.due!.getTime()) / 86_400_000)))
    : 0;
  const counts = {
    overdue: tasksOk ? overdue : null,
    dueToday: tasksOk ? dueToday : null,
    actionEmails: mailOk ? actions.length : null,
    awaiting: waiting ? waiting.length : null,
  };
  const summary = summarize({
    eventsCount: today ? today.events.length : null,
    busyHours: today ? busyHours(today.events) : 0,
    nextEventTime: nextEvent ? fmt(nextEvent.start) : null,
    ...counts,
  });
  const alerts = staticAlerts({ ...counts, oldestOverdueDays, awaitingDays });
  const timed = (today?.events ?? [])
    .filter((e) => !e.allDay && e.end > now)
    .map((e) => ({ id: e.id, title: e.title, start: e.start.toISOString(), end: e.end.toISOString() }));


  // Replan proposal and day plan. Both only use what is already loaded above.
  const todayKey = dayKey(now, tz);
  const loadByDay: Record<string, number> = {};
  const overdueTasks = Array.isArray(tasks) ? tasks.filter((t) => t.bucket === "overdue") : [];
  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t.bucket === "overdue" || !t.due) continue;
      const k = dayKey(t.due, tz);
      loadByDay[k] = (loadByDay[k] ?? 0) + 1;
    }
  }
  const replan = planOverdue(
    overdueTasks.slice(0, 50).map((t) => ({ id: t.id, priority: t.priority, dueMs: t.due?.getTime() ?? null })),
    todayKey,
    planPrefs.perDay,
    loadByDay,
  );

  const candidates: Candidate[] = [];
  if (Array.isArray(tasks)) {
    for (const t of urgent.slice(0, 8)) {
      const days = t.due ? Math.max(0, Math.floor((now.getTime() - t.due.getTime()) / 86_400_000)) : 0;
      candidates.push({ id: `task-${t.id}`, kind: "task", title: t.title, minutes: planPrefs.taskMin, score: scoreTask(t.bucket, days, t.priority), url: t.url });
    }
  }
  if (mailOk) {
    const dueSoon = mail.emails.filter((e) => {
      if (e.category !== "financeiro" || e.inInbox === false) return false;
      const d = financeDueDays(extractFinance(`${e.subject} ${e.snippet}`).vencimento, now);
      return d !== null && d <= 3;
    }).length;
    if (dueSoon > 0) {
      candidates.push({ id: "finance", kind: "finance", title: `Financeiro: ${dueSoon} ${dueSoon === 1 ? "vence" : "vencem"} em até 3 dias`, minutes: 20, score: 90 });
    }
    if (actions.length > 0) {
      candidates.push({ id: "mail-actions", kind: "email", title: `Triar ${actions.length} e-mail${actions.length === 1 ? "" : "s"} de ação`, minutes: 15, score: 60 });
    }
  }
  const workStart = zonedMs(todayKey, planPrefs.start, tz);
  const workEnd = zonedMs(todayKey, planPrefs.end, tz);
  const from = Math.max(workStart, Math.ceil(now.getTime() / 300_000) * 300_000);
  const free = freeBlocks(
    (today?.events ?? []).filter((e) => !e.allDay).map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
    from,
    workEnd,
    15,
  );
  const placed = suggestPlan(free, candidates);
  const hm = (ms: number) => fmt(new Date(ms));
  const freeMin = Math.round(free.reduce((s, b) => s + (b.end - b.start), 0) / 60_000);
  const planNote = !today
    ? "Conecte a agenda para sugerir blocos."
    : from >= workEnd
      ? `O expediente (${planPrefs.start}–${planPrefs.end}) já terminou.`
      : candidates.length === 0
        ? "Nada pendente para planejar hoje."
        : "Sem horário livre hoje dentro do expediente.";
  const planItems = placed.items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    minutes: i.minutes,
    startIso: new Date(i.startMs).toISOString(),
    endIso: new Date(i.endMs).toISOString(),
    label: `${hm(i.startMs)}–${hm(i.endMs)}`,
    url: i.url,
    href: i.kind === "email" ? "/emails?categoria=acao&naolidos=1" : i.kind === "finance" ? "/emails?categoria=financeiro" : undefined,
  }));

  const state = (e: { allDay: boolean; start: Date; end: Date }) =>
    e.allDay ? "next" : e.end < now ? "done" : e.start <= now ? "now" : "next";
  const cardClass = {
    done: "border-line bg-bg text-mute",
    now: "border-2 border-primary bg-primary-soft text-ink",
    next: "border-line-strong bg-card text-ink",
  };
  const tag = { done: ["Concluído", "chip-slate"], now: ["Em andamento", "chip-primary"], next: ["A seguir", "chip-blue"] };

  const doneEvents = (today?.events ?? []).filter((e) => !e.allDay && e.end < now).length;
  const totalEvents = (today?.events ?? []).filter((e) => !e.allDay).length;
  const totalGoal = totalEvents + urgent.length;

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10">
      {/* Hero Bento: Saudação + Resumo/Alertas + 4 KPIs integrados + Anel do dia */}
      <section aria-label="Visão geral de hoje" className="spring-card spring-d1 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="card bento-card flex flex-col justify-between gap-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-xs font-medium capitalize text-mute">{dateLabel}</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-mute">
              Atualizado às {fmt(now)} · <RefreshButton />
            </span>
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              {greeting}{first && `, ${first}`}
            </h1>
            {summary && <p className="mt-1 mb-0 text-sm text-mute">{summary}</p>}
          </div>

          <div className="flex flex-col gap-1 empty:hidden">
            <LiveMeeting events={timed} serverNow={now.toISOString()} windowMin={windowMin} />
            {alerts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alerts.map((a) => (
                  <Link key={a.id} href={a.href} className={`chip chip-${a.tone} no-underline hover:brightness-95`}>
                    {a.label}: {a.text}
                  </Link>
                ))}
              </div>
            )}
            <DailyBriefing
              account={account}
              todayKey={todayKey}
              payload={{
                events: (today?.events ?? []).filter((e) => !e.allDay && e.end > now).map((e) => ({ time: fmt(e.start), title: e.title })),
                tasks: urgent.map((t) => ({ bucket: t.bucket === "overdue" ? "Atrasada" : "Hoje", title: t.title })),
                emails: actions.map((m) => ({ sender: m.sender, subject: m.subject })),
              }}
            />
          </div>

          <div aria-label="Resumo" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-bg px-3.5 py-2.5">
              <div className="text-[11px] text-mute">Agenda</div>
              <div className="font-display text-xl font-bold tabular-nums">
                {today ? today.events.length : "–"}
                {nextEvent && <span className="ml-1 text-xs font-normal text-mute">({fmt(nextEvent.start)})</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-bg px-3.5 py-2.5">
              <div className="text-[11px] text-mute">Atrasadas</div>
              <div className="font-display text-xl font-bold tabular-nums" style={Array.isArray(tasks) && overdue > 0 ? { color: "var(--red-fg)" } : undefined}>
                {Array.isArray(tasks) ? overdue : "–"}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-bg px-3.5 py-2.5">
              <div className="text-[11px] text-mute">Vencem hoje</div>
              <div className="font-display text-xl font-bold tabular-nums" style={Array.isArray(tasks) && dueToday > 0 ? { color: "var(--amber-fg)" } : undefined}>
                {Array.isArray(tasks) ? dueToday : "–"}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-bg px-3.5 py-2.5">
              <div className="text-[11px] text-mute">E-mails ação</div>
              <div className="font-display text-xl font-bold tabular-nums text-primary">
                {mail && !(mail instanceof Error) ? actions.length : "–"}
              </div>
            </div>
          </div>
        </div>

        <DayRing done={doneEvents} total={totalGoal} />
      </section>

      <ProactivePlan account={account} todayKey={todayKey} planItems={planItems} replan={replan} />

      {/* Bloco central de ação: Fazer agora + Plano do dia */}
      <div className="spring-card spring-d2 grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <TodayTasks
            tasks={urgent.map((t) => ({ id: t.id, title: t.title, list: t.list, listId: t.listId, status: t.status, bucket: t.bucket, url: t.url, origin: origins[t.id] ? { emailId: origins[t.id].emailId, subject: origins[t.id].subject, url: gmailThreadUrl(account, origins[t.id].threadId) } : undefined }))}
            statuses={statuses}
            tasksError={tasks instanceof Error ? tasks.message : null}
            replan={replan}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <DayPlan
            items={planItems}
            unplaced={placed.unplaced.map((c) => c.title)}
            note={planNote}
            freeLabel={`${freeMin >= 60 ? `${Math.floor(freeMin / 60)}h${freeMin % 60 ? ` ${freeMin % 60}min` : ""}` : `${freeMin} min`} livres no expediente (${planPrefs.start}–${planPrefs.end})`}
          />
          <QuickNotes initialText={quickNotes} />
        </div>
      </div>

      {/* Base: Linha do tempo + E-mails que pedem ação */}
      <div className="spring-card spring-d3 grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <section className="card bento-card min-w-0 lg:col-span-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Linha do tempo de hoje</h2>
            <Link href="/semana" className="text-sm font-semibold">Ver semana</Link>
          </div>
          {!today && <Reconnect what="Agenda" />}
          {today && today.events.length === 0 && <p className="text-mute">Nenhum compromisso hoje.</p>}
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {today?.events.map((e) => {
              const s = state(e);
              return (
                <li key={e.id} className="flex items-stretch gap-4">
                  <div className="w-[52px] shrink-0 pt-3 text-right text-[13px] tabular-nums text-mute">
                    {e.allDay ? (
                      <div className="font-semibold text-ink">Dia</div>
                    ) : (
                      <>
                        <div className="font-semibold text-ink">{fmt(e.start)}</div>
                        <div>{fmt(e.end)}</div>
                      </>
                    )}
                  </div>
                  <a
                    href={e.link ?? undefined}
                    target={e.link ? "_blank" : undefined}
                    rel={e.link ? "noopener noreferrer" : undefined}
                    className={`block min-w-0 flex-1 rounded-2xl border px-3.5 py-3 no-underline transition-colors ${e.link ? "hover:border-primary" : ""} ${cardClass[s]}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{e.title}</span>
                      <span className={`chip ${tag[s][1]}`}>{tag[s][0]}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-mute">{e.calendar}</span>
                    {e.link && <span className="sr-only">Abre no Google Agenda, em nova aba</span>}
                  </a>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="card bento-card min-w-0 lg:col-span-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">E-mails que pedem ação</h2>
            {mail && !(mail instanceof Error) && <span className="text-[13px] text-mute">{actions.length} não lidos</span>}
          </div>
          {mail instanceof Error && <RetryNotice message={`Gmail indisponível: ${mail.message}`} />}
          {mail && !(mail instanceof Error) && (
            <HomeActionEmails
              initialTotal={actions.length}
              initialItems={actions.slice(0, 8).map((m) => ({
                id: m.id,
                threadId: m.threadId,
                sender: m.sender,
                subject: m.subject,
                snippet: m.snippet,
                url: gmailThreadUrl(account, m.threadId),
              }))}
            />
          )}
        </section>
      </div>
    </main>
  );
}
