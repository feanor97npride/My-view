import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClickupTask, updateClickupTask } from "@/lib/clickup";
import {
  getAutomationPrefs,
  getAutomationState,
  getDefaultClickupList,
  setAutomationState,
} from "@/lib/prefs";
import { dueForKey, isDayKey } from "@/lib/task-dates";

type ReplanItem = { taskId: string; date: string };
type WaitingItem = { threadId: string; to: string; subject: string; dias: number };

const MAX_FOLLOWUPS_PER_RUN = 3;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  let body: { todayKey?: string; replan?: ReplanItem[]; waiting?: WaitingItem[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const todayKey = typeof body.todayKey === "string" && isDayKey(body.todayKey) ? body.todayKey : "";
  if (!todayKey) {
    return NextResponse.json({ error: "todayKey inválido." }, { status: 400 });
  }

  const [prefs, state, defaultListId] = await Promise.all([
    getAutomationPrefs(),
    getAutomationState(),
    getDefaultClickupList(),
  ]);

  let replanned = 0;
  let followups = 0;
  const nextState = {
    lastReplanDate: state.lastReplanDate,
    followupThreads: { ...(state.followupThreads ?? {}) },
  };
  let stateChanged = false;

  if (prefs.autoReplan && Array.isArray(body.replan) && body.replan.length > 0 && state.lastReplanDate !== todayKey) {
    const valid = body.replan
      .filter((i) => typeof i?.taskId === "string" && i.taskId.length > 0 && isDayKey(i?.date))
      .slice(0, 30);

    const results = await Promise.allSettled(
      valid.map((item) => updateClickupTask(item.taskId, { dueMs: dueForKey(item.date) })),
    );
    replanned = results.filter((r) => r.status === "fulfilled").length;
    if (replanned > 0) {
      nextState.lastReplanDate = todayKey;
      stateChanged = true;
    }
  }

  if (prefs.autoFollowupTask && Array.isArray(body.waiting) && body.waiting.length > 0) {
    const dueMs = dueForKey(todayKey);
    const pending = body.waiting
      .filter((w) => w?.threadId && w?.subject && !nextState.followupThreads[w.threadId])
      .slice(0, MAX_FOLLOWUPS_PER_RUN);

    for (const item of pending) {
      try {
        await createClickupTask(defaultListId, {
          name: `Follow-up: ${item.subject.slice(0, 140)}`,
          description: `Criada automaticamente pelo radar de e-mails aguardando resposta.\nPara: ${item.to} (há ${item.dias} dias sem resposta)`,
          dueMs,
        });
        nextState.followupThreads[item.threadId] = todayKey;
        followups++;
        stateChanged = true;
      } catch {
        // skip failed item and continue
      }
    }
  }

  if (stateChanged) {
    await setAutomationState(nextState).catch(() => {});
    revalidateTag("tasks");
  }

  return NextResponse.json({ ok: true, replanned, followups });
}
