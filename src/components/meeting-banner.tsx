"use client";

import { usePathname } from "next/navigation";
import LiveMeeting from "@/components/live-meeting";
import type { MeetingEvent } from "@/lib/day-summary";

// Meeting alert for every page except Hoje, which already shows it inside the day summary.
export default function MeetingBanner({ events, serverNow }: { events: MeetingEvent[]; serverNow: string }) {
  if (usePathname() === "/") return null;
  return (
    <div className="border-b border-line bg-card px-4 py-1 md:px-10">
      <LiveMeeting events={events} serverNow={serverNow} />
    </div>
  );
}
