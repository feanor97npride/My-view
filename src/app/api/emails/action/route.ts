import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCalendarEvent, deleteCalendarEvent, primaryTz } from "@/lib/calendar";
import { createClickupTask, deleteClickupTask, inScopeList } from "@/lib/clickup";
import { MAX_RULES, isCategory, normalizeRule } from "@/lib/email-rules";
import { archiveEmail, createFollowupDraft, createReplyDraftWithAI, createTemplateDraft, deleteDraft, deleteSenderFilter, markEmailsRead, markEmailsUnread, muteSenderFilter, summarizeInformativosWithAI, unarchiveEmail, updateEmailCategory } from "@/lib/gmail";
import { deleteTaskOrigin, saveTaskOrigin } from "@/lib/links";
import { logWarn } from "@/lib/logger";
import { getCustomCategories, getDefaultClickupList, getEmailRules, getSnoozedEmails, setEmailRules, setSnoozedEmails } from "@/lib/prefs";
import { isDayKey, isPostpone, postponeKey } from "@/lib/task-dates";

type Payload =
  | { action: "archive" | "unarchive"; id: string }
  | { action: "markRead" | "markUnread"; ids: string[] }
  | { action: "schedule"; title: string; description: string; startIso: string; endIso: string }
  | { action: "unschedule"; eventId: string }
  | { action: "task"; title: string; description: string; listId?: string; emailId?: string; threadId?: string }
  | { action: "untask"; taskId: string }
  | { action: "followup"; threadId: string; to: string; subject: string }
  | { action: "aiDraft"; threadId: string; to: string; subject: string; snippet: string; tone?: "direto" | "formal" | "followup" }
  | { action: "templateDraft"; threadId: string; to: string; subject: string; body: string }
  | { action: "unfollowup"; draftId: string }
  | { action: "snooze"; emailId: string; kind?: string; date?: string }
  | { action: "unsnooze"; emailId: string }
  | { action: "summarize"; items: { sender: string; subject: string; snippet: string }[] }
  | { action: "recategorize"; emailId: string; senderEmail: string; category: string }
  | { action: "unrecategorize"; emailId: string; senderEmail: string; previousCategory: string; hadRule?: string | null }
  | { action: "mute"; email: string; ids?: string[] }
  | { action: "unmute"; filterId: string; ids?: string[] };

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || session?.error === "RefreshAccessTokenError") {
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
      const listId = body.listId?.trim() || (await getDefaultClickupList().catch(() => ""));
      if (!inScopeList(listId)) {
        return NextResponse.json({ error: "Lista fora das listas configuradas." }, { status: 400 });
      }
      const created = await createClickupTask(listId, {
        name: body.title,
        description: body.description ?? "",
      });
      // The link back to the e-mail is a bonus: a failure here never undoes the task that was created.
      if (typeof body.emailId === "string" && body.emailId && typeof body.threadId === "string") {
        await saveTaskOrigin({ taskId: created.id, emailId: body.emailId, threadId: body.threadId, subject: body.title }).catch((err) =>
          logWarn("emails/action", "Falha ao salvar origem da tarefa", err, { taskId: created.id }),
        );
      }
      revalidateTag("tasks");
      return NextResponse.json({ ok: true, taskId: created.id, url: created.url });
    }
    if (body.action === "untask" && typeof body.taskId === "string" && body.taskId) {
      await deleteClickupTask(body.taskId);
      await deleteTaskOrigin(body.taskId).catch((err) =>
        logWarn("emails/action", "Falha ao remover origem da tarefa", err, { taskId: body.taskId }),
      );
      revalidateTag("tasks");
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
    if (body.action === "aiDraft" && typeof body.threadId === "string" && body.threadId) {
      const created = await createReplyDraftWithAI(token, {
        threadId: body.threadId,
        to: body.to ?? "",
        subject: body.subject ?? "(sem assunto)",
        snippet: body.snippet ?? "",
        tone: body.tone,
      });
      return NextResponse.json({ ok: true, draftId: created.id, text: created.text });
    }
    if (body.action === "templateDraft" && typeof body.threadId === "string" && body.threadId && typeof body.body === "string") {
      const created = await createTemplateDraft(token, {
        threadId: body.threadId,
        to: body.to ?? "",
        subject: body.subject ?? "(sem assunto)",
        body: body.body.slice(0, 10_000),
      });
      return NextResponse.json({ ok: true, draftId: created.id });
    }
    if (body.action === "unfollowup" && typeof body.draftId === "string" && body.draftId) {
      await deleteDraft(token, body.draftId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "snooze" && typeof body.emailId === "string" && body.emailId) {
      const tz = await primaryTz(token).catch(() => "UTC");
      const until = isDayKey(body.date) ? body.date : isPostpone(body.kind) ? postponeKey(body.kind, new Date(), tz) : postponeKey("tomorrow", new Date(), tz);
      const current = await getSnoozedEmails().catch(() => ({}));
      await setSnoozedEmails({ ...current, [body.emailId]: until });
      return NextResponse.json({ ok: true, until });
    }
    if (body.action === "unsnooze" && typeof body.emailId === "string" && body.emailId) {
      const current = await getSnoozedEmails().catch(() => ({}));
      const next = { ...current };
      delete next[body.emailId];
      await setSnoozedEmails(next);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "summarize" && Array.isArray(body.items)) {
      const summary = await summarizeInformativosWithAI(
        body.items.slice(0, 30).map((i) => ({
          sender: String(i.sender ?? "").slice(0, 200),
          subject: String(i.subject ?? "").slice(0, 300),
          snippet: String(i.snippet ?? "").slice(0, 500),
        })),
      );
      return NextResponse.json({ ok: true, summary });
    }
    if (body.action === "recategorize") {
      const custom = await getCustomCategories().catch(() => []);
      const customIds = custom.map((c) => c.id);
      const rule = normalizeRule(
        { match: String(body.senderEmail ?? ""), category: String(body.category ?? "") },
        customIds,
      );
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
      const custom = await getCustomCategories().catch(() => []);
      const customIds = custom.map((c) => c.id);
      const isAllowedCat = (x: unknown): x is string =>
        typeof x === "string" && (isCategory(x) || customIds.includes(x));
      const match = String(body.senderEmail ?? "").trim().toLowerCase();
      const existing = await getEmailRules().catch(() => []);
      const others = existing.filter((r) => r.match !== match);
      const restored = body.hadRule && isAllowedCat(body.hadRule) ? [...others, { match, category: body.hadRule }] : others;
      await setEmailRules(restored);
      if (body.emailId && isAllowedCat(body.previousCategory)) {
        await updateEmailCategory(body.emailId, body.previousCategory, "ai");
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === "mute" && typeof body.email === "string" && body.email.includes("@")) {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string" && x) : [];
      const created = await muteSenderFilter(token, body.email.trim(), ids);
      return NextResponse.json({ ok: true, filterId: created.id });
    }
    if (body.action === "unmute" && typeof body.filterId === "string" && body.filterId) {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string" && x) : [];
      await deleteSenderFilter(token, body.filterId, ids);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao executar ação";
    const lower = msg.toLowerCase();
    if (lower.includes("insufficient") || lower.includes("access_token_scope_insufficient")) {
      return NextResponse.json(
        { error: "Sem permissão de escrita no Google. Clique em Sair, entre novamente e marque todas as caixinhas de permissão do Gmail." },
        { status: 403 },
      );
    }
    if (/quota|ratelimitexceeded|userratelimitexceeded|total query cost|429/.test(lower)) {
      return NextResponse.json(
        { error: "Cota temporária do Gmail atingida. Aguarde cerca de 1 minuto e tente novamente." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
