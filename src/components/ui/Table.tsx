import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Table({
  headers,
  children,
  colWidths,
}: {
  headers: string[];
  children: ReactNode;
  /** Optional widths like ["18%", "8%", ...] matching headers length */
  colWidths?: string[];
}) {
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 touch-pan-x">
      <table className="w-full min-w-[520px] table-fixed border-collapse text-sm sm:min-w-[600px] lg:min-w-[680px]">
        {colWidths?.length ? (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b border-app text-xs font-semibold uppercase tracking-wide text-muted">
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                scope="col"
                className="whitespace-nowrap px-2 py-3 text-left font-semibold align-middle sm:px-3"
              >
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
    <tr
      className={cn(
        "border-b border-app last:border-0 hover:bg-[color-mix(in_oklab,var(--accent-soft)_50%,transparent)] transition-colors",
        className,
      )}
    >
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
    <td
      colSpan={colSpan}
      className={cn("px-2 py-3 text-left align-middle sm:px-3 sm:py-3.5", className)}
    >
      {children}
    </td>
  );
}
