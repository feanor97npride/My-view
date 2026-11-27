import { cache, Suspense } from "react";
import { auth, signOut } from "@/auth";
import { primaryTz, upcomingTimed } from "@/lib/calendar";
import { urgentTasksCount } from "@/lib/clickup";
import { unreadActionCount } from "@/lib/gmail";
import { getMeetingWindow, getSelectedCalendars } from "@/lib/prefs";
import AlertsPopup from "@/components/alerts-popup";
import AssistantDrawer, { AssistantTrigger } from "@/components/assistant-drawer";
import CommandPalette, { CommandTrigger } from "@/components/command-palette";
import MeetingBanner from "@/components/meeting-banner";
import { MvaBrand } from "@/components/mva-brand";
import NavLinks from "@/components/nav-links";
import QuickDictate from "@/components/quick-dictate";
import SidebarShell, { type SidebarMeeting } from "@/components/sidebar-shell";
import ThemeToggle from "@/components/theme-toggle";
import VoiceAssistantMode, { VoiceModeTrigger } from "@/components/voice-assistant-mode";

function Brand() {
  return <MvaBrand showSub={false} />;
}

function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="btn spring-btn min-h-9 px-2.5 text-xs md:min-h-10 md:px-3 md:text-[13px]">Sair</button>
    </form>
  );
}

const getLayoutChromeData = cache(async () => {
  const session = await auth();
  const [mailCount, taskCount, windowMin, selected, tz] = await Promise.all([
    unreadActionCount().catch(() => 0),
    urgentTasksCount().catch(() => 0),
    getMeetingWindow().catch(() => 30),
    getSelectedCalendars().catch(() => null),
    session?.accessToken ? primaryTz(session.accessToken).catch(() => "UTC") : Promise.resolve("UTC"),
  ]);
  const meetings = session?.accessToken ? await upcomingTimed(session.accessToken, selected).catch(() => []) : [];
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

  return { badges, meetings, windowMin, nextMeeting, taskCount, mailCount };
});

async function SidebarWithData({ userName }: { userName: string }) {
  const { badges, nextMeeting } = await getLayoutChromeData();
  return (
    <SidebarShell
      badges={badges}
      nextMeeting={nextMeeting}
      userName={userName}
      themeToggle={<ThemeToggle />}
      signOut={<SignOut />}
    />
  );
}

async function BottomNavWithData() {
  const { badges } = await getLayoutChromeData();
  return <NavLinks variant="bottom" badges={badges} />;
}

async function LiveMeetingBanner() {
  const { meetings, windowMin } = await getLayoutChromeData();
  return <MeetingBanner events={meetings} serverNow={new Date().toISOString()} windowMin={windowMin} />;
}

async function LiveAlertsPopup() {
  const { meetings, windowMin, taskCount, mailCount } = await getLayoutChromeData();
  return (
    <AlertsPopup
      events={meetings}
      serverNow={new Date().toISOString()}
      windowMin={windowMin}
      taskCount={taskCount}
      mailCount={mailCount}
    />
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.accessToken || session?.error === "RefreshAccessTokenError") {
    return <>{children}</>;
  }
  const name = session.user?.name ?? "Usuário";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:font-semibold"
      >
        Pular para o conteúdo
      </a>
      <Suspense
        fallback={
          <SidebarShell
            badges={{}}
            nextMeeting={null}
            userName={name}
            themeToggle={<ThemeToggle />}
            signOut={<SignOut />}
          />
        }
      >
        <SidebarWithData userName={name} />
      </Suspense>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-card/90 px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur-md md:hidden">
        <Brand />
        <div className="flex items-center gap-1.5">
          <VoiceModeTrigger compact />
          <AssistantTrigger compact />
          <CommandTrigger compact />
          <ThemeToggle />
          <SignOut />
        </div>
      </header>

      <div className="min-w-0 flex-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <Suspense fallback={null}>
          <LiveMeetingBanner />
        </Suspense>
        <div id="conteudo" tabIndex={-1} className="page-enter outline-none">
          {children}
        </div>
      </div>

      <Suspense fallback={<NavLinks variant="bottom" badges={{}} />}>
        <BottomNavWithData />
      </Suspense>
      <Suspense fallback={null}>
        <LiveAlertsPopup />
      </Suspense>
      <CommandPalette />
      <AssistantDrawer />
      <VoiceAssistantMode />
      <QuickDictate />
    </div>
  );
}
