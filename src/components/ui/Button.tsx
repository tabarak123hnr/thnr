import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--text)] text-[var(--bg-elevated)] border border-transparent hover:opacity-90 hover:shadow-md hover:brightness-110",
  secondary:
    "bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent)] hover:shadow-sm",
  ghost:
    "bg-transparent text-[var(--text-muted)] border border-transparent hover:text-[var(--text)] hover:bg-[var(--accent-soft)] hover:shadow-sm",
  danger:
    "bg-[var(--danger)] text-white border border-transparent hover:opacity-90 hover:brightness-110 hover:shadow-md",
  gold:
    "bg-accent text-[var(--accent-text)] border border-transparent font-semibold hover:opacity-95 hover:brightness-105 hover:shadow-md",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-11 px-5 text-sm rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 font-semibold",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:scale-[1.02]",
        "active:translate-y-0 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        "disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
