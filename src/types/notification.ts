export type OpsNotificationCategory =
  | "orders"
  | "checkout"
  | "arrivals"
  | "housekeeping"
  | "bookings"
  | "payments"
  | "rooms";

export type OpsNotificationSeverity = "critical" | "warning" | "info" | "success";

export interface OpsNotification {
  id: string;
  category: OpsNotificationCategory;
  severity: OpsNotificationSeverity;
  title: string;
  body: string;
  /** In-app route to act on this alert */
  href: string;
  /** Sort / relative time */
  atMs: number;
}

export const NOTIFICATION_CATEGORIES: {
  value: OpsNotificationCategory | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "orders", label: "Orders" },
  { value: "checkout", label: "Check-out" },
  { value: "arrivals", label: "Arrivals" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "bookings", label: "Bookings" },
  { value: "payments", label: "Payments" },
  { value: "rooms", label: "Rooms" },
];
