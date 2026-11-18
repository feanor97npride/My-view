import Link from "next/link";
import { auth } from "@/auth";
import Reconnect from "@/components/reconnect";
import TriageBoard from "@/components/triage-board";
import { primaryTz } from "@/lib/calendar";
import { gmailThreadUrl, shortDate } from "@/lib/email-view";
import { awaitingReply, syncEmails } from "@/lib/gmail";
import { getAwaitingDays } from "@/lib/prefs";
import { FILAS, type Fila, type TriItem } from "@/lib/triage";

export const metadata = { title: "E-mails" };

type Params = { categoria?: string };

export default async function Emails({ searchParams }: { searchParams: Promise<Params> }) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const token = session?.accessToken;
  if (!token) {
    return (
      <main className="p-6">
        <Reconnect what="Gmail" />
      </main>
    );
  }

  const account = session.user?.email ?? "";
  const initialFila = (FILAS as readonly string[]).includes(params.categoria ?? "") ? (params.categoria as Fila) : null;
  const awaitingDays = await getAwaitingDays().catch(() => 2);

  // shortcut: a Gmail failure shows a banner instead of an error page
  const [mail, tz, waiting] = await Promise.all([
    syncEmails(token).catch((e: Error) => e),
    primaryTz(token).catch(() => "UTC"),
    awaitingReply(token, account, awaitingDays).catch((e: Error) => e),
  ]);
  const now = new Date();

  if (mail instanceof Error) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-10">
        <h1 className="font-display text-3xl font-bold">E-mails</h1>
        <div role="alert" className="card flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-mute">Gmail indisponível: {mail.message}</p>
          <Link href="/emails" className="btn">Tentar de novo</Link>
        </div>
      </main>
    );
  }

  // Dates and times are formatted here so the browser shows the same time zone as the rest of the portal.
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
  }));
  const waitingItems = Array.isArray(waiting)
    ? waiting.map((w) => ({ threadId: w.threadId, to: w.to, subject: w.subject, dias: w.dias, url: gmailThreadUrl(account, w.threadId) }))
    : null;
  const dateLine = `${now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: tz }).replace(".", "")} · Gmail, últimos 7 dias`;

  return (
    <main>
      <TriageBoard
        items={items}
        waiting={waitingItems}
        waitingError={waiting instanceof Error ? waiting.message : null}
        dateLine={dateLine}
        awaitingDays={awaitingDays}
        initialFila={initialFila}
      />
    </main>
  );
}
