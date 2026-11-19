"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ActionToast, type ToastAction } from "@/components/ui";

type TabId = "agenda" | "emails" | "clickup";

const TABS: { id: TabId; label: string }[] = [
  { id: "agenda", label: "Agenda & Foco" },
  { id: "emails", label: "E-mails & IA" },
  { id: "clickup", label: "ClickUp & Atalhos" },
];

export default function ConfigTabs({
  initialTab,
  toastMessage,
  agenda,
  emails,
  clickup,
}: {
  initialTab: TabId;
  toastMessage: string | null;
  agenda: ReactNode;
  emails: ReactNode;
  clickup: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [toast, setToast] = useState<ToastAction | null>(() =>
    toastMessage ? { label: toastMessage, undo: () => {}, undoLabel: "Fechar" } : null,
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!toastMessage) return;
    setToast({ label: toastMessage, undo: () => {}, undoLabel: "Fechar" });
    router.replace("/configuracoes", { scroll: false });
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toastMessage, router]);

  return (
    <>
      <div
        role="tablist"
        aria-label="Seções de configurações"
        className="inline-flex w-fit flex-wrap rounded-2xl border border-line bg-card p-1 text-xs font-medium"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`spring-btn cursor-pointer rounded-xl px-3.5 py-2 transition-colors ${
                active ? "bg-primary font-semibold text-[var(--on-primary)]" : "text-mute hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="spring-card flex flex-col gap-5">
        {tab === "agenda" && agenda}
        {tab === "emails" && emails}
        {tab === "clickup" && clickup}
      </div>

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
