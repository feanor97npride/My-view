import type { ReactNode } from "react";

export function BentoCard({
  as: Tag = "section",
  className = "",
  children,
  ...rest
}: {
  as?: "section" | "div" | "article";
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`card bento-card ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-2 ${className}`.trim()}>
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {subtitle && <p className="m-0 text-[13px] text-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
