"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MvaBrand } from "@/components/mva-brand";
import NavLinks from "@/components/nav-links";
import { DictateTrigger } from "@/components/quick-dictate";

export type SidebarMeeting = {
  title: string;
  timeLabel: string;
  isNow: boolean;
};

export default function SidebarShell({
  badges,
  nextMeeting,
  userName,
  themeToggle,
  signOut,
}: {
  badges: Record<string, number>;
  nextMeeting: SidebarMeeting | null;
  userName: string;
  themeToggle: ReactNode;
  signOut: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [shortcut, setShortcut] = useState("⌘K");

  useEffect(() => {
    try {
      if (localStorage.getItem("myview:sidebar-collapsed") === "1") {
        setCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
    if (typeof navigator !== "undefined" && !/mac|iphone|ipad/i.test(navigator.platform)) {
      setShortcut("Ctrl+K");
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("myview:sidebar-collapsed", next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const openPalette = () => {
    window.dispatchEvent(new Event("myview:open-command-palette"));
  };

  return (
    <aside
      className={`hidden shrink-0 flex-col gap-5 border-r border-line bg-card p-4 transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between gap-2"}`}>
        <Link href="/" className="flex items-center text-ink no-underline" title="MY-VIEW · MVA Solutions">
          <MvaBrand compact={collapsed} />
        </Link>

        <button
          type="button"
          onClick={toggleCollapse}
          aria-expanded={!collapsed}
          title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          className="spring-btn flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-bg text-mute hover:bg-primary-soft hover:text-ink"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <DictateTrigger collapsed={collapsed} />

      <NavLinks variant="side" badges={badges} collapsed={collapsed} />

      <button
        type="button"
        onClick={openPalette}
        title={collapsed ? `Busca rápida (${shortcut})` : undefined}
        aria-label={`Abrir busca rápida (${shortcut})`}
        className={`spring-btn flex cursor-pointer items-center rounded-xl border border-line bg-bg py-2 text-xs text-mute transition-colors hover:border-line-strong hover:bg-primary-soft hover:text-ink ${
          collapsed ? "justify-center px-2" : "justify-between px-3"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          {!collapsed && <span>Busca rápida</span>}
        </span>
        {!collapsed && (
          <kbd className="rounded border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-semibold text-ink">
            {shortcut}
          </kbd>
        )}
      </button>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("myview:open-assistant"))}
        title={collapsed ? `Assistente (${shortcut.replace("K", "J")})` : undefined}
        aria-label="Abrir Assistente Pessoal"
        className={`spring-btn flex cursor-pointer items-center rounded-xl border border-primary/30 bg-primary-soft/70 py-2 text-xs font-semibold text-primary-ink transition-colors hover:border-primary hover:bg-primary-soft ${
          collapsed ? "justify-center px-2" : "justify-between px-3"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">✨</span>
          {!collapsed && <span>Assistente</span>}
        </span>
        {!collapsed && (
          <kbd className="rounded border border-primary/30 bg-card px-1.5 py-0.5 text-[10px] font-semibold text-primary-ink">
            {shortcut.replace("K", "J")}
          </kbd>
        )}
      </button>

      {!collapsed && (
        <div className="rounded-2xl border border-line p-3 text-xs" style={{ background: "var(--surface-3)" }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-semibold uppercase tracking-wider text-mute text-[10px]">
              {nextMeeting ? (nextMeeting.isNow ? "Agora na agenda" : "Próxima reunião") : "Agenda"}
            </span>
            {nextMeeting && (
              <span className={`chip px-2 py-0 text-[10px] ${nextMeeting.isNow ? "chip-primary" : "chip-blue"}`}>
                {nextMeeting.timeLabel}
              </span>
            )}
          </div>
          <p className="m-0 truncate font-medium text-ink">
            {nextMeeting ? nextMeeting.title : "Sem reuniões próximas hoje"}
          </p>
        </div>
      )}

      <div className={`mt-auto flex items-center border-t border-line pt-3 ${collapsed ? "flex-col gap-2" : "gap-2"}`}>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-ink"
          title={userName}
          aria-hidden="true"
        >
          {userName.charAt(0).toUpperCase()}
        </span>
        {!collapsed && <span className="min-w-0 flex-1 truncate font-semibold">{userName.split(" ")[0]}</span>}
        <div className={`flex items-center ${collapsed ? "flex-col gap-1.5" : "gap-1.5"}`}>
          {themeToggle}
          {!collapsed && signOut}
        </div>
      </div>
    </aside>
  );
}
