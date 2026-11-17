"use client";

import { useEffect, useState } from "react";
import { meetingStatus, type MeetingEvent } from "@/lib/day-summary";

// Re-evaluates in the browser every 30 s, so the countdown keeps moving without asking the server again.
export default function LiveMeeting({ events, serverNow }: { events: MeetingEvent[]; serverNow: string }) {
  // First render uses the server's clock, so server and browser HTML match.
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const s = meetingStatus(events, now);
  const min = (n: number) => `${n} min`;

  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {s && (
        <p className="m-0 flex flex-wrap items-center gap-2.5 rounded-xl px-3 py-2">
          <span className={`chip ${s.kind === "now" ? "chip-primary" : "chip-blue"}`}>{s.kind === "now" ? "Em andamento" : "Reunião"}</span>
          <span className="font-semibold">{s.event.title}</span>
          <span className="text-sm text-mute">
            {s.kind === "now" ? `termina em ${min(s.minutes)}` : `começa em ${min(s.minutes)}`}
          </span>
        </p>
      )}
    </div>
  );
}
