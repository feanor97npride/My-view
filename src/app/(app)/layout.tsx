import { auth, signOut } from "@/auth";
import { primaryTz, upcomingTimed } from "@/lib/calendar";
import { urgentTasksCount } from "@/lib/clickup";
import { unreadActionCount } from "@/lib/gmail";
import { getMeetingWindow, getSelectedCalendars } from "@/lib/prefs";
import CommandPalette, { CommandTrigger } from "@/components/command-palette";
import MeetingBanner from "@/components/meeting-banner";
import NavLinks from "@/components/nav-links";
import SidebarShell, { type SidebarMeeting } from "@/components/sidebar-shell";
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
      <button type="submit" className="btn spring-btn min-h-10 px-3 text-[13px]">Sair</button>
    </form>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const name = session?.user?.name ?? "Usuário";
  // badge is optional: a database failure just hides it
  const [mailCount, taskCount] = await Promise.all([unreadActionCount().catch(() => 0), urgentTasksCount().catch(() => 0)]);
  const windowMin = await getMeetingWindow().catch(() => 30);
  const selected = await getSelectedCalendars().catch(() => null);
  const [meetings, tz] = await Promise.all([
    session?.accessToken ? upcomingTimed(session.accessToken, selected).catch(() => []) : Promise.resolve([]),
    session?.accessToken ? primaryTz(session.accessToken).catch(() => "UTC") : Promise.resolve("UTC"),
  ]);
  const badges: Record<string, number> = { "/": taskCount, "/emails": mailCount };

  const nowMs = Date.now();
  const nextRaw = meetings[0];
  const nextMeeting: SidebarMeeting | null = nextRaw
    ? {
        title: nextRaw.title,
        isNow: new Date(nextRaw.start).getTime() <= nowMs,
        timeLabel: new Date(nextRaw.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:font-semibold"
      >
        Pular para o conteúdo
      </a>
      <SidebarShell
        badges={badges}
        nextMeeting={nextMeeting}
        userName={name}
        themeToggle={<ThemeToggle />}
        signOut={<SignOut />}
      />

      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3 md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <CommandTrigger compact />
          <ThemeToggle />
          <SignOut />
        </div>
      </header>

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <MeetingBanner events={meetings} serverNow={new Date().toISOString()} windowMin={windowMin} />
        <div id="conteudo" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </div>
      <NavLinks variant="bottom" badges={badges} />
      <CommandPalette />
    </div>
  );
}
