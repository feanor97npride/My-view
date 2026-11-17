"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hoje", icon: "M3 4h18v17H3zM8 2v4M16 2v4M3 10h18" },
  { href: "/semana", label: "Semana", icon: "M3 4h18v17H3zM8 2v4M16 2v4M3 10h18M8 14h2M14 14h2M8 18h2" },
  { href: "/indicadores", label: "Indicadores", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];

export default function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname();
  const side = variant === "side";
  return (
    <nav
      aria-label="Principal"
      className={side ? "flex flex-col gap-1.5" : "fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-line bg-card px-2 pb-3 pt-2 md:hidden"}
    >
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        const base = side
          ? "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] no-underline"
          : "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs no-underline";
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`${base} ${active ? "bg-primary-soft font-semibold text-primary-ink" : "font-medium text-mute hover:bg-primary-soft"}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={l.icon} />
            </svg>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
