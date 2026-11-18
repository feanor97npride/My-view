import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar";
import { createClickupTask, deleteClickupTask } from "@/lib/clickup";
import { archiveEmail, markEmailsRead, markEmailsUnread, unarchiveEmail } from "@/lib/gmail";
import { getDefaultClickupList } from "@/lib/prefs";

type Payload =
  | { action: "archive" | "unarchive"; id: string }
  | { action: "markRead" | "markUnread"; ids: string[] }
  | { action: "schedule"; title: string; description: string; startIso: string; endIso: string }
  | { action: "unschedule"; eventId: string }
  | { action: "task"; title: string; description: string; listId?: string }
  | { action: "untask"; taskId: string };

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
