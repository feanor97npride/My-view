import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar";
import { createClickupTask, deleteClickupTask } from "@/lib/clickup";
import { MAX_RULES, isCategory, normalizeRule } from "@/lib/email-rules";
import { archiveEmail, createFollowupDraft, deleteDraft, markEmailsRead, markEmailsUnread, summarizeInformativosWithAI, unarchiveEmail, updateEmailCategory } from "@/lib/gmail";
import { getDefaultClickupList, getEmailRules, setEmailRules } from "@/lib/prefs";

type Payload =
  | { action: "archive" | "unarchive"; id: string }
  | { action: "markRead" | "markUnread"; ids: string[] }
  | { action: "schedule"; title: string; description: string; startIso: string; endIso: string }
  | { action: "unschedule"; eventId: string }
  | { action: "task"; title: string; description: string; listId?: string }
  | { action: "untask"; taskId: string }
  | { action: "followup"; threadId: string; to: string; subject: string }
  | { action: "unfollowup"; draftId: string }
  | { action: "summarize"; items: { sender: string; subject: string; snippet: string }[] }
  | { action: "recategorize"; emailId: string; senderEmail: string; category: string }
  | { action: "unrecategorize"; emailId: string; senderEmail: string; previousCategory: string; hadRule?: string | null };

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente no portal." }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    if (body.action === "archive" && typeof body.id === "string" && body.id) {
      await archiveEmail(token, body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "unarchive" && typeof body.id === "string" && body.id) {
      await unarchiveEmail(token, body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "markRead" && Array.isArray(body.ids)) {
      await markEmailsRead(token, body.ids.filter((x) => typeof x === "string" && x));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "markUnread" && Array.isArray(body.ids)) {
      await markEmailsUnread(token, body.ids.filter((x) => typeof x === "string" && x));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "schedule" && body.title && body.startIso && body.endIso) {
      const created = await createCalendarEvent(token, {
        title: body.title,
        description: body.description ?? "",
        startIso: body.startIso,
        endIso: body.endIso,
      });
      return NextResponse.json({ ok: true, eventId: created.id, link: created.link });
    }
    if (body.action === "unschedule" && typeof body.eventId === "string" && body.eventId) {
      await deleteCalendarEvent(token, body.eventId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "task" && body.title) {
      const listId = body.listId ?? (await getDefaultClickupList().catch(() => ""));
      const created = await createClickupTask(listId, {
        name: body.title,
        description: body.description ?? "",
      });
      return NextResponse.json({ ok: true, taskId: created.id, url: created.url });
    }
    if (body.action === "untask" && typeof body.taskId === "string" && body.taskId) {
      await deleteClickupTask(body.taskId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "followup" && typeof body.threadId === "string" && body.threadId) {
      const created = await createFollowupDraft(token, {
        threadId: body.threadId,
        to: body.to ?? "",
        subject: body.subject ?? "(sem assunto)",
      });
      return NextResponse.json({ ok: true, draftId: created.id });
    }
    if (body.action === "unfollowup" && typeof body.draftId === "string" && body.draftId) {
      await deleteDraft(token, body.draftId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "summarize" && Array.isArray(body.items)) {
      const summary = await summarizeInformativosWithAI(
        body.items.map((i) => ({
          sender: String(i.sender ?? ""),
          subject: String(i.subject ?? ""),
          snippet: String(i.snippet ?? ""),
        })),
      );
      return NextResponse.json({ ok: true, summary });
    }
    if (body.action === "recategorize") {
      const rule = normalizeRule({ match: String(body.senderEmail ?? ""), category: String(body.category ?? "") });
      if (!rule) return NextResponse.json({ error: "Remetente ou categoria inválidos para criar regra." }, { status: 400 });
      const existing = await getEmailRules().catch(() => []);
      const prevRule = existing.find((r) => r.match === rule.match)?.category ?? null;
      const others = existing.filter((r) => r.match !== rule.match);
      if (others.length >= MAX_RULES) {
        return NextResponse.json({ error: `Limite de ${MAX_RULES} regras atingido em Configurações.` }, { status: 400 });
      }
      await setEmailRules([...others, rule]);
      if (body.emailId) await updateEmailCategory(body.emailId, rule.category, "rule:user");
      return NextResponse.json({ ok: true, prevRule });
    }
    if (body.action === "unrecategorize") {
      const match = String(body.senderEmail ?? "").trim().toLowerCase();
      const existing = await getEmailRules().catch(() => []);
      const others = existing.filter((r) => r.match !== match);
      const restored = body.hadRule && isCategory(body.hadRule) ? [...others, { match, category: body.hadRule }] : others;
      await setEmailRules(restored);
      if (body.emailId && isCategory(body.previousCategory)) {
        await updateEmailCategory(body.emailId, body.previousCategory, "ai");
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao executar ação";
    if (msg.includes("403") || msg.includes("insufficient") || msg.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      return NextResponse.json(
        { error: "Sem permissão de escrita no Google. Clique em Sair e entre novamente." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
