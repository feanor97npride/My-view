import { neon } from "@neondatabase/serverless";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClickupTask, updateClickupTask } from "@/lib/clickup";
import { logWarn } from "@/lib/logger";
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
const LOCK_TTL_MS = 60_000;

async function acquireAutomationLock(userEmail: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  const lockKey = `${userEmail.trim().toLowerCase()}:automation_lock`;
  const now = Date.now();
  const until = now + LOCK_TTL_MS;
  const rows = await sql`
    INSERT INTO preferences (key, value, updated_at)
    VALUES (${lockKey}, ${JSON.stringify({ until })}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = ${JSON.stringify({ until })}::jsonb, updated_at = now()
      WHERE COALESCE((preferences.value->>'until')::bigint, 0) < ${now}
    RETURNING key`;
  return rows.length > 0;
}

export async function POST(req: Request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
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

  const locked = await acquireAutomationLock(userEmail).catch((err) => {
    logWarn("automations", "Falha ao adquirir lock de automação", err);
    return true;
  });
  if (!locked) {
    return NextResponse.json({ ok: true, replanned: 0, followups: 0, skipped: "locked" });
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
      } catch (err) {
        logWarn("automations", "Falha ao criar tarefa de follow-up", err, { threadId: item.threadId });
      }
    }
  }

  if (stateChanged) {
    await setAutomationState(nextState).catch((err) => logWarn("automations", "Falha ao salvar estado", err));
    revalidateTag("tasks");
  }

  return NextResponse.json({ ok: true, replanned, followups });
}
