import { auth, signOut } from "@/auth";
import { upcomingTimed } from "@/lib/calendar";
import { urgentTasksCount } from "@/lib/clickup";
import { unreadActionCount } from "@/lib/gmail";
import { getSelectedCalendars } from "@/lib/prefs";
import MeetingBanner from "@/components/meeting-banner";
import NavLinks from "@/components/nav-links";
import ThemeToggle from "@/components/theme-toggle";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primary" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold">My View</span>
    </div>
  );
}

function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="btn min-h-10 px-3 text-[13px]">Sair</button>
    </form>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const name = session?.user?.name ?? "Usuário";
  // badge is optional: a database failure just hides it
  const [mailCount, taskCount] = await Promise.all([unreadActionCount().catch(() => 0), urgentTasksCount().catch(() => 0)]);
  const selected = await getSelectedCalendars().catch(() => null);
  const meetings = session?.accessToken ? await upcomingTimed(session.accessToken, selected).catch(() => []) : [];
  const badges: Record<string, number> = { "/": taskCount, "/emails": mailCount };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:font-semibold"
      >
        Pular para o conteúdo
      </a>
      <aside className="hidden w-[248px] shrink-0 flex-col gap-7 border-r border-line bg-card p-5 md:flex">
        <Brand />
        <NavLinks variant="side" badges={badges} />
        <div className="mt-auto flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-ink" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 truncate font-semibold">{name.split(" ")[0]}</span>
          <ThemeToggle />
          <SignOut />
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3 md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOut />
        </div>
      </header>

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <MeetingBanner events={meetings} serverNow={new Date().toISOString()} />
        <div id="conteudo" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </div>
      <NavLinks variant="bottom" badges={badges} />
    </div>
  );
}
