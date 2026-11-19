"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function RetryNotice({ message }: { message: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-sm text-mute"
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => router.refresh())}
        className="btn spring-btn min-h-9 px-3 py-1 text-xs disabled:opacity-60"
      >
        {pending ? "Tentando…" : "Tentar novamente"}
      </button>
    </div>
  );
}
