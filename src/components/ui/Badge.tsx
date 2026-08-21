import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type Tone = "default" | "gold" | "info" | "warning" | "danger" | "success" | "muted" | "purple";

const tones: Record<Tone, string> = {
  default: "bg-[var(--bg)] text-[var(--text)] border-[var(--border)]",
  gold: "bg-accent-soft text-[var(--accent)] border-[color-mix(in_oklab,var(--accent)_35%,transparent)]",
  info: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  warning: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
  danger: "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  muted: "bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]",
  purple: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
