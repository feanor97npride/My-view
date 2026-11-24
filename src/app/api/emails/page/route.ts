import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { primaryTz } from "@/lib/calendar";
import { gmailThreadUrl, shortDate } from "@/lib/email-view";
import { syncEmails } from "@/lib/gmail";
import { tasksByEmail } from "@/lib/links";
import type { TriItem } from "@/lib/triage";

export async function GET(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const url = new URL(req.url);
  const pageToken = url.searchParams.get("pageToken")?.trim() ?? "";
  if (!pageToken) {
    return NextResponse.json({ error: "pageToken obrigatório." }, { status: 400 });
  }

  try {
    const account = session.user?.email ?? "";
    const [mail, tz] = await Promise.all([
      syncEmails(token, pageToken),
      primaryTz(token).catch(() => "UTC"),
    ]);
    const now = new Date();
    const taskOf = await tasksByEmail(mail.emails.map((m) => m.id)).catch(() => ({}) as Record<string, string>);
    const items: TriItem[] = mail.emails.map((m) => ({
      id: m.id,
      threadId: m.threadId,
      sender: m.sender,
      subject: m.subject,
      snippet: m.snippet,
      receivedAt: m.receivedAt.toISOString(),
      unread: m.unread,
      inInbox: m.inInbox ?? true,
      category: m.category,
      when: shortDate(m.receivedAt, now, tz),
      url: gmailThreadUrl(account, m.threadId),
      clickupTaskId: taskOf[m.id],
      attachments: m.attachments,
    }));
    return NextResponse.json({ items, nextPageToken: mail.nextPageToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar mais e-mails.";
    if (/quota|rateLimitExceeded|userRateLimitExceeded|Total Query Cost|429/i.test(msg)) {
      return NextResponse.json(
        { error: "Cota temporária do Gmail atingida. Aguarde cerca de 1 minuto e tente novamente." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
