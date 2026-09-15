import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Table({
  headers,
  children,
  colWidths,
  scrollX = true,
  /** Word-style grid with borders on every row and column */
  bordered = false,
}: {
  headers: string[];
  children: ReactNode;
  /** Optional widths like ["18%", "8%", ...] matching headers length */
  colWidths?: string[];
  /** When false, the table fills its container and never shows a horizontal scrollbar. */
  scrollX?: boolean;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-1 px-1",
        scrollX
          ? "overflow-x-auto overscroll-x-contain touch-pan-x"
          : "overflow-x-hidden",
      )}
    >
      <table
        className={cn(
          "w-full table-fixed border-collapse text-sm",
          scrollX && "min-w-[520px] sm:min-w-[600px] lg:min-w-[680px]",
          bordered && "border border-app",
        )}
      >
        {colWidths?.length ? (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr
            className={cn(
              "text-xs font-semibold uppercase tracking-wide text-muted",
              bordered
                ? "bg-[color-mix(in_oklab,var(--accent)_8%,var(--surface))]"
                : "border-b border-app",
            )}
          >
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                scope="col"
                className={cn(
                  "px-2 py-3 text-left font-semibold align-middle sm:px-3",
                  scrollX ? "whitespace-nowrap" : "break-words",
                  bordered && "border border-app",
                )}
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
  bordered = false,
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <tr
      className={cn(
        !bordered &&
          "border-b border-app last:border-0 hover:bg-[color-mix(in_oklab,var(--accent-soft)_50%,transparent)] transition-colors",
        bordered && "hover:bg-[color-mix(in_oklab,var(--accent-soft)_40%,transparent)]",
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
  bordered = false,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
  bordered?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-2 py-3 text-left align-middle sm:px-3 sm:py-3.5",
        bordered && "border border-app",
        className,
      )}
    >
      {children}
    </td>
  );
}
