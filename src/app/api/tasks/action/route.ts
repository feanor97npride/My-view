import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { primaryTz } from "@/lib/calendar";
import { closingStatus, createClickupTask, getClickupTask, inScopeList, listStatuses, updateClickupTask } from "@/lib/clickup";
import { markEmailsRead } from "@/lib/gmail";
import { originsByTask } from "@/lib/links";
import { getDefaultClickupList } from "@/lib/prefs";
import { dayKey, dueForKey, isDayKey, isPostpone, postponeKey } from "@/lib/task-dates";

type Payload =
  | { action: "complete"; taskId: string }
  | { action: "create"; title: string; due?: "today" | "tomorrow" | "none"; listId?: string }
  | { action: "setStatus"; taskId: string; status: string }
  | { action: "restoreStatus"; taskId: string; status: string }
  | { action: "postpone"; taskId: string; kind?: string; date?: string }
  | { action: "postponeMany"; items: { taskId: string; date: string }[] }
  | { action: "restoreDue"; items: { taskId: string; dueMs: number | null }[] };

const MAX_BATCH = 50;
const isId = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length < 40;

// Reads the task and refuses anything outside the lists the owner picked.
async function scoped(taskId: string) {
  const snap = await getClickupTask(taskId);
  if (!inScopeList(snap.listId)) throw new Error("Tarefa fora das listas configuradas.");
  return snap;
}

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return NextResponse.json({ error: "Sessão expirada. Entre novamente no portal." }, { status: 401 });

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    if (body.action === "create" && typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Informe um título para a tarefa." }, { status: 400 });
      const listId = body.listId?.trim() || (await getDefaultClickupList().catch(() => ""));
      if (!listId) {
        return NextResponse.json({ error: "Configure uma lista padrão em Configurações → ClickUp & Atalhos." }, { status: 400 });
      }
      let dueMs: number | null = null;
      if (body.due === "today" || body.due === "tomorrow") {
        const tz = await primaryTz(token).catch(() => "UTC");
        const key = body.due === "today" ? dayKey(new Date(), tz) : postponeKey("tomorrow", new Date(), tz);
        dueMs = dueForKey(key);
      }
      const created = await createClickupTask(listId, {
        name: title.slice(0, 200),
        description: "Criada pela captura rápida (My View)",
        dueMs,
      });
      revalidateTag("tasks");
      return NextResponse.json({ ok: true, id: created.id, url: created.url });
    }
    if (body.action === "complete" && isId(body.taskId)) {
      const snap = await scoped(body.taskId);
      const closing = closingStatus(await listStatuses(snap.listId));
      if (!closing) return NextResponse.json({ error: "Esta lista não tem um status de conclusão." }, { status: 400 });
      await updateClickupTask(body.taskId, { status: closing });
      const origins = await originsByTask([body.taskId]).catch(() => ({} as Awaited<ReturnType<typeof originsByTask>>));
      const origin = origins[body.taskId];
      if (origin?.emailId) {
        await markEmailsRead(token, [origin.emailId]).catch(() => {});
      }
      revalidateTag("tasks");
      return NextResponse.json({ ok: true, prevStatus: snap.status, status: closing });
    }
    if (body.action === "setStatus" && isId(body.taskId) && typeof body.status === "string") {
      const snap = await scoped(body.taskId);
      const valid = (await listStatuses(snap.listId)).some((s) => s.status === body.status);
      if (!valid) return NextResponse.json({ error: "Status inválido para esta lista." }, { status: 400 });
      await updateClickupTask(body.taskId, { status: body.status });
      revalidateTag("tasks");
      return NextResponse.json({ ok: true, prevStatus: snap.status });
    }
    if (body.action === "restoreStatus" && isId(body.taskId) && typeof body.status === "string") {
      await scoped(body.taskId);
      await updateClickupTask(body.taskId, { status: body.status });
      revalidateTag("tasks");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "postpone" && isId(body.taskId)) {
      const tz = await primaryTz(token).catch(() => "UTC");
      const key = isDayKey(body.date) ? body.date : isPostpone(body.kind) ? postponeKey(body.kind, new Date(), tz) : null;
      if (!key) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
      const snap = await scoped(body.taskId);
      const dueMs = dueForKey(key);
      await updateClickupTask(body.taskId, { dueMs });
      revalidateTag("tasks");
      return NextResponse.json({ ok: true, prevDueMs: snap.dueMs, dueMs, date: key });
    }
    if (body.action === "postponeMany" && Array.isArray(body.items) && body.items.length > 0) {
      if (body.items.length > MAX_BATCH) return NextResponse.json({ error: `Máximo de ${MAX_BATCH} tarefas por vez.` }, { status: 400 });
      const items = body.items.filter((i) => isId(i?.taskId) && isDayKey(i?.date));
      if (items.length !== body.items.length) return NextResponse.json({ error: "Itens inválidos." }, { status: 400 });
      const prev: { taskId: string; dueMs: number | null }[] = [];
      const failed: string[] = [];
      for (const it of items) {
        try {
          const snap = await scoped(it.taskId);
          await updateClickupTask(it.taskId, { dueMs: dueForKey(it.date) });
          prev.push({ taskId: it.taskId, dueMs: snap.dueMs });
        } catch {
          failed.push(it.taskId);
        }
      }
      revalidateTag("tasks");
      return NextResponse.json({ ok: true, prev, failed });
    }
    if (body.action === "restoreDue" && Array.isArray(body.items)) {
      if (body.items.length > MAX_BATCH) return NextResponse.json({ error: `Máximo de ${MAX_BATCH} tarefas por vez.` }, { status: 400 });
      for (const it of body.items) {
        if (!isId(it?.taskId)) continue;
        await scoped(it.taskId);
        await updateClickupTask(it.taskId, { dueMs: typeof it.dueMs === "number" ? it.dueMs : null });
      }
      revalidateTag("tasks");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao executar ação";
    if (msg.includes("fora das listas")) return NextResponse.json({ error: msg }, { status: 400 });
    if (msg.includes("ClickUp 401") || msg.includes("ClickUp 403")) {
      return NextResponse.json({ error: "O token do ClickUp não tem permissão para editar tarefas." }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
