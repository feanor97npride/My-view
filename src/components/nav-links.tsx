"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hoje", sideLabel: "Hoje", badgeLabel: "tarefas atrasadas ou para hoje", icon: "M3 4h18v17H3zM8 2v4M16 2v4M3 10h18" },
  { href: "/semana", label: "Semana", sideLabel: "Semana", badgeLabel: "", icon: "M3 4h18v17H3zM8 2v4M16 2v4M3 10h18M8 14h2M14 14h2M8 18h2" },
  { href: "/clickup", label: "ClickUp", sideLabel: "ClickUp", badgeLabel: "", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { href: "/emails", label: "E-mails", sideLabel: "E-mails", badgeLabel: "e-mails de ação não lidos", icon: "M3 6h18v12H3zM3 7l9 6 9-6" },
  { href: "/github", label: "GitHub", sideLabel: "GitHub", badgeLabel: "", icon: "M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" },
  { href: "/indicadores", label: "Indicadores", sideLabel: "Indicadores", badgeLabel: "", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  {
    href: "/configuracoes",
    label: "Config.",
    sideLabel: "Configurações",
    badgeLabel: "",
    icon: "M3 6h9M16 6h5M3 12h5M12 12h9M3 18h11M18 18h3M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M10 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M16 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  },
];

const EMAIL_QUEUES = [
  { href: "/emails?categoria=acao", label: "Ação", color: "var(--cat-acao)" },
  { href: "/emails?categoria=financeiro", label: "Financeiro", color: "var(--cat-financeiro)" },
];

export default function NavLinks({
  variant,
  badges = {},
  collapsed = false,
}: {
  variant: "side" | "bottom";
  badges?: Record<string, number>;
  collapsed?: boolean;
}) {
  const path = usePathname();
  const side = variant === "side";

  return (
    <nav
      aria-label="Principal"
      className={side ? "flex flex-col gap-1" : "fixed inset-x-0 bottom-0 z-10 grid grid-cols-7 border-t border-line bg-card px-1 pb-3 pt-2 md:hidden"}
    >
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        const count = badges[l.href] ?? 0;
        const badgeTitle = count > 0 && l.badgeLabel ? `${count} ${l.badgeLabel}` : undefined;
        const text = side ? l.sideLabel : l.label;
        const base = side
          ? `flex items-center rounded-xl py-2.5 text-[15px] no-underline ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"}`
          : "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] no-underline";

        return (
          <div key={l.href} className="flex flex-col">
            <Link
              href={l.href}
              title={collapsed ? (badgeTitle ? `${text} (${badgeTitle})` : text) : undefined}
              aria-label={collapsed ? text : undefined}
              aria-current={active ? "page" : undefined}
              className={`${base} spring-btn ${active ? "bg-primary-soft font-semibold text-primary-ink" : "font-medium text-mute hover:bg-primary-soft"}`}
            >
              <span className="relative inline-flex shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={l.icon} />
                </svg>
                {(!side || collapsed) && count > 0 && (
                  <span
                    title={badgeTitle}
                    className={`chip ${l.href === "/" ? "chip-red" : "chip-violet"} absolute -right-3 -top-1.5 min-w-4 justify-center px-1 py-0 text-[10px] leading-4`}
                  >
                    {count > 99 ? "99+" : count}
                    <span className="sr-only"> pendentes</span>
                  </span>
                )}
              </span>
              {(!side || !collapsed) && <span>{text}</span>}
              {side && !collapsed && count > 0 && (
                <span
                  title={badgeTitle}
                  className={`chip ${l.href === "/" ? "chip-red" : "chip-violet"} ml-auto min-w-5 justify-center px-1.5 py-0 text-[11px]`}
                >
                  {count > 99 ? "99+" : count}
                  <span className="sr-only"> {l.badgeLabel}</span>
                </span>
              )}
            </Link>

            {side && !collapsed && l.href === "/emails" && (
              <div className="mt-0.5 flex flex-wrap gap-1.5 pl-9 pr-2 pb-1">
                {EMAIL_QUEUES.map((q) => (
                  <Link
                    key={q.href}
                    href={q.href}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium text-mute no-underline transition-colors hover:bg-primary-soft hover:text-ink"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: q.color }} aria-hidden="true" />
                    {q.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
