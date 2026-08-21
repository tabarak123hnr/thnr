import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  badge,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: ReactNode;
  alert?: number;
}) {
  return (
    <div className="surface relative rounded-2xl p-5">
      {alert ? (
        <span className="absolute end-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--warning)] px-1.5 text-[11px] font-bold text-white">
          {alert}
        </span>
      ) : null}
      {badge ? <div className="absolute end-3 top-3">{badge}</div> : null}
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-app px-4 py-8 text-sm text-muted">
      {message}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-app bg-elevated px-3 text-sm text-app outline-none transition focus:ring-2 ring-accent",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-app bg-elevated px-3 text-sm text-app outline-none transition focus:ring-2 ring-accent",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-xl border border-app bg-elevated px-3 py-2 text-sm text-app outline-none transition focus:ring-2 ring-accent",
        props.className,
      )}
    />
  );
}
