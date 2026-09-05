import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Card({
  children,
  className,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface rounded-2xl",
        padding && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  badge,
}: {
  title: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {badge}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
