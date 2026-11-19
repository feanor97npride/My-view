"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleRefresh = () => {
    start(async () => {
      await fetch("/api/refresh", { method: "POST" }).catch(() => {});
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={pending}
      className="spring-btn inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 font-medium text-link hover:underline disabled:opacity-60"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={pending ? "animate-spin motion-reduce:animate-none" : ""}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {pending ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
