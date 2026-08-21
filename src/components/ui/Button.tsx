import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--text)] text-[var(--bg-elevated)] hover:opacity-90 border border-transparent",
  secondary:
    "bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--accent-soft)]",
  ghost: "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-soft)] border border-transparent",
  danger: "bg-[var(--danger)] text-white border border-transparent hover:opacity-90",
  gold: "bg-accent text-[var(--accent-text)] border border-transparent hover:opacity-90 font-semibold",
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
        "inline-flex cursor-pointer items-center justify-center gap-2 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
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
