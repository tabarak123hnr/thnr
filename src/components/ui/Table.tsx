import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-app text-start text-xs font-semibold uppercase tracking-wide text-muted">
            {headers.map((h) => (
              <th key={h} className="px-3 py-3 font-semibold first:ps-0 last:pe-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-app last:border-0 hover:bg-[var(--accent-soft)]/50 transition-colors", className)}>
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-3.5 align-middle first:ps-0 last:pe-0", className)}>
      {children}
    </td>
  );
}
