import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import {
  ToastContext,
  type ToastItem,
  type ToastTone,
} from "./toast-context";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const TONE_STYLES: Record<ToastTone, string> = {
  success:
    "border-[color-mix(in_oklab,var(--accent)_55%,var(--border))] bg-elevated shadow-[0_12px_40px_rgba(0,0,0,0.12)]",
  error:
    "border-red-200 bg-elevated shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:border-red-900",
  info: "border-app bg-elevated shadow-[0_12px_40px_rgba(0,0,0,0.12)]",
};

const ICON_STYLES: Record<ToastTone, string> = {
  success: "text-[var(--accent)]",
  error: "text-[var(--danger)]",
  info: "text-[var(--info)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      message,
      tone = "info",
    }: {
      title: string;
      message?: string;
      tone?: ToastTone;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { id, title, message, tone }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast,
      success: (title: string, message?: string) =>
        toast({ title, message, tone: "success" }),
      error: (title: string, message?: string) =>
        toast({ title, message, tone: "error" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-end gap-3 p-4 sm:p-6"
        aria-live="polite"
      >
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm animate-[toast-in_0.35s_ease-out] items-start gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-md",
                TONE_STYLES[item.tone],
              )}
              role="status"
            >
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft",
                  item.tone === "error" && "bg-red-50 dark:bg-red-950/40",
                  item.tone === "info" && "bg-app",
                )}
              >
                <Icon className={cn("h-5 w-5", ICON_STYLES[item.tone])} strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold tracking-tight text-app">{item.title}</p>
                {item.message ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.message}</p>
                ) : null}
                {item.tone === "success" ? (
                  <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-app">
                    <div className="h-full w-full origin-left animate-[toast-bar_4.2s_linear] bg-accent" />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-lg p-1 text-muted hover:bg-app hover:text-app"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
