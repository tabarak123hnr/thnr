import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function FancySelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  required,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = Math.min(280, options.length * 44 + 16);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
    const pad = 8;
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - pad * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - pad) left = window.innerWidth - pad - width;
    if (left < pad) left = pad;
    let top = openUp ? rect.top - menuHeight - 6 : rect.bottom + 6;
    if (top < pad) top = pad;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - menuHeight);
    }
    setCoords({ top, left, width });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className={cn("relative w-full", className)}>
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-elevated px-3.5 text-start text-sm font-medium transition-all",
          open
            ? "border-[var(--accent)] ring-2 ring-[color-mix(in_oklab,var(--accent)_35%,transparent)] shadow-sm"
            : "border-app hover:border-[color-mix(in_oklab,var(--accent)_45%,var(--border))]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted")}>
          {selected?.label ?? placeholder}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-app text-muted transition-transform",
            open && "rotate-180 bg-accent-soft text-[var(--accent)]",
          )}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: coords.width,
                maxWidth: "calc(100vw - 16px)",
                zIndex: 80,
              }}
              className="animate-[toast-in_0.18s_ease-out] overflow-hidden rounded-2xl border border-app bg-elevated p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
            >
              <div className="max-h-64 overflow-y-auto">
                {options.map((opt) => {
                  const isActive = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-start transition",
                        isActive
                          ? "bg-accent-soft text-app"
                          : "hover:bg-app text-app",
                        opt.disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug">
                          {opt.label}
                        </span>
                        {opt.description ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            {opt.description}
                          </span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Label + FancySelect wrapper that doesn't break with nested buttons */
export function SelectField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}
