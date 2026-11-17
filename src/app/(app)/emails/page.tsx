import Link from "next/link";
import { auth } from "@/auth";
import { primaryTz } from "@/lib/calendar";
import { CATEGORY_CHIP, CATEGORY_LABEL, decodeEntities, filterEmails, parseSender, shortDate } from "@/lib/email-view";
import { syncEmails } from "@/lib/gmail";

type Params = { categoria?: string; naolidos?: string; q?: string };

export default async function Emails({ searchParams }: { searchParams: Promise<Params> }) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const token = session?.accessToken;
  if (!token) {
    return <main className="p-6">Gmail indisponível. Entre de novo para reconectar a sua conta.</main>;
  }

  // shortcut: a Gmail failure shows a note instead of an error page
  const [mail, tz] = await Promise.all([syncEmails(token).catch((e: Error) => e), primaryTz(token).catch(() => "UTC")]);
  const account = session.user?.email ?? "";
  const now = new Date();

  const categoria = params.categoria && params.categoria in CATEGORY_LABEL ? params.categoria : undefined;
  const naolidos = params.naolidos === "1";
  const q = params.q?.slice(0, 100);

  const all = mail instanceof Error ? [] : mail.emails;
  const shown = filterEmails(all, { categoria, naolidos, q });
  const counts = Object.fromEntries(Object.entries(Object.groupBy(all, (e) => e.category)).map(([c, l]) => [c, l?.length ?? 0]));

  const href = (cat?: string) => {
    const p = new URLSearchParams();
    if (cat) p.set("categoria", cat);
    if (naolidos) p.set("naolidos", "1");
    if (q) p.set("q", q);
    return p.size ? `/emails?${p}` : "/emails";
  };
  const pill = (active: boolean) =>
    `inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm no-underline ${
      active ? "border-primary bg-primary-soft font-semibold text-primary-ink" : "border-line-strong bg-card font-medium text-ink hover:bg-primary-soft"
    }`;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 p-4 md:p-10">
      <header>
        <p className="text-sm text-mute">Gmail · não lidos e últimos 7 dias</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">E-mails</h1>
      </header>

      {mail instanceof Error && <p className="text-sm text-mute">Gmail indisponível: {mail.message}</p>}

      {!(mail instanceof Error) && (
        <>
          <nav aria-label="Categorias" className="flex flex-wrap gap-2">
            <Link href={href()} className={pill(!categoria)} aria-current={!categoria ? "true" : undefined}>
              Todos ({all.length})
            </Link>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
              <Link key={key} href={href(key)} className={pill(categoria === key)} aria-current={categoria === key ? "true" : undefined}>
                {label} ({counts[key] ?? 0})
              </Link>
            ))}
          </nav>

          <form method="get" action="/emails" role="search" className="flex flex-wrap items-center gap-3">
            {categoria && <input type="hidden" name="categoria" value={categoria} />}
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-mute">
              Buscar por remetente ou assunto
              <input
                type="search"
                name="q"
                defaultValue={q}
                className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-base text-ink"
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 pt-5 text-sm">
              <input type="checkbox" name="naolidos" value="1" defaultChecked={naolidos} className="h-5 w-5 accent-[var(--primary)]" />
              Só não lidos
            </label>
            <button type="submit" className="btn btn-primary mt-5 min-h-11">Filtrar</button>
          </form>

          <p className="text-sm text-mute" aria-live="polite">
            {shown.length} {shown.length === 1 ? "e-mail" : "e-mails"}
          </p>
          {all.length === 0 && <p className="card text-mute">Nenhum e-mail recente.</p>}
          {all.length > 0 && shown.length === 0 && <p className="card text-mute">Nenhum e-mail com esses filtros.</p>}

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {shown.map((m) => {
              const sender = parseSender(m.sender);
              const snippet = decodeEntities(m.snippet);
              return (
                <li key={m.id}>
                  <a
                    href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${encodeURIComponent(m.threadId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card flex gap-3 px-4 py-3 text-ink no-underline hover:border-primary"
                  >
                    <span className="flex w-3 shrink-0 items-start pt-2" aria-hidden="true">
                      {m.unread && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate ${m.unread ? "font-semibold" : "text-mute"}`}>
                          {m.unread && <span className="sr-only">Não lido: </span>}
                          {sender.name || "(sem remetente)"}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-mute">{shortDate(m.receivedAt, now, tz)}</span>
                      </span>
                      <span className={`truncate ${m.unread ? "font-semibold" : ""}`}>{m.subject}</span>
                      {snippet && <span className="line-clamp-2 text-sm text-mute">{snippet}</span>}
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className={`chip ${CATEGORY_CHIP[m.category] ?? "chip-slate"}`}>{CATEGORY_LABEL[m.category] ?? m.category}</span>
                        <span className="sr-only">Abre no Gmail, em nova aba</span>
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
