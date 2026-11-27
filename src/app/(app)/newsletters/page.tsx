import { auth } from "@/auth";
import NewsletterPlayer from "@/components/newsletter-player";
import Reconnect from "@/components/reconnect";
import RefreshButton from "@/components/refresh-button";
import RetryNotice from "@/components/retry-notice";
import { primaryTz } from "@/lib/calendar";
import { gmailThreadUrl, shortDate } from "@/lib/email-view";
import { syncEmails } from "@/lib/gmail";
import { matchesNewsletter, type NewsletterItem } from "@/lib/newsletter";
import { getNewsletterRules } from "@/lib/prefs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletters" };

export default async function NewslettersPage() {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <Reconnect what="Gmail" />
      </main>
    );
  }

  const account = session.user?.email ?? "";
  const [rules, mail, tz] = await Promise.all([
    getNewsletterRules().catch(() => []),
    syncEmails(token).catch((e: Error) => e),
    primaryTz(token).catch(() => "UTC"),
  ]);

  const now = new Date();
  const matched: NewsletterItem[] =
    mail && !(mail instanceof Error)
      ? mail.emails
          .filter((m) => matchesNewsletter(m, rules))
          .map((m) => ({
            id: m.id,
            threadId: m.threadId,
            sender: m.sender,
            subject: m.subject,
            snippet: m.snippet,
            receivedAt: m.receivedAt.toISOString(),
            when: shortDate(m.receivedAt, now, tz),
            unread: m.unread,
            url: gmailThreadUrl(account, m.threadId),
          }))
      : [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-1.5">
        <span className="kicker">Áudio briefing</span>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">Newsletters em Áudio</h1>
          <RefreshButton />
        </div>
        <p className="m-0 text-sm text-mute">
          Ouça na íntegra ou em resumo de 30 segundos seus boletins diários de IA, Geopolítica e outros temas configurados.
        </p>
      </header>

      {mail instanceof Error && <RetryNotice message={`Gmail indisponível: ${mail.message}`} />}

      <NewsletterPlayer items={matched} rules={rules} mode="full" />
    </main>
  );
}
