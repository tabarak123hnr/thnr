import type { NavSection } from "../types";

export const navigation: NavSection[] = [
  {
    id: "overview",
    labelKey: "overview",
    items: [
      {
        id: "dashboard",
        path: "/",
        icon: "LayoutDashboard",
        labelKey: "dashboard",
        permission: "dashboard",
      },
      {
        id: "notifications",
        path: "/notifications",
        icon: "Bell",
        labelKey: "notifications",
        permission: "notifications",
        badge: 2,
        badgeTone: "danger",
      },
    ],
  },
  {
    id: "hotel",
    labelKey: "hotel",
    items: [
      {
        id: "rooms",
        path: "/rooms",
        icon: "BedDouble",
        labelKey: "rooms",
        permission: "rooms",
        badgeTone: "gold",
      },
      {
        id: "check-in",
        path: "/check-in",
        icon: "UserPlus",
        labelKey: "checkIn",
        permission: "check_in",
      },
      {
        id: "guests",
        path: "/guests",
        icon: "ContactRound",
        labelKey: "guests",
        permission: "guests",
      },
      {
        id: "bookings",
        path: "/booking-requests",
        icon: "CalendarClock",
        labelKey: "bookingRequests",
        permission: "bookings",
      },
      {
        id: "housekeeping",
        path: "/housekeeping",
        icon: "Sparkles",
        labelKey: "housekeeping",
        permission: "housekeeping",
        badgeTone: "gold",
      },
      {
        id: "qr",
        path: "/qr-cards",
        icon: "QrCode",
        labelKey: "qrCards",
        permission: "qr_cards",
      },
    ],
  },
  {
    id: "restaurant",
    labelKey: "restaurant",
    items: [
      {
        id: "counter",
        path: "/counter",
        icon: "UtensilsCrossed",
        labelKey: "counter",
        permission: "counter",
      },
      {
        id: "orders",
        path: "/orders",
        icon: "ClipboardList",
        labelKey: "orders",
        permission: "orders",
        badge: 9,
        badgeTone: "info",
      },
      {
        id: "menu",
        path: "/menu",
        icon: "BookOpen",
        labelKey: "menu",
        permission: "menu",
      },
    ],
  },
  {
    id: "money",
    labelKey: "money",
    items: [
      {
        id: "accounts",
        path: "/accounts",
        icon: "Landmark",
        labelKey: "accounts",
        permission: "accounts",
      },
      {
        id: "invoices",
        path: "/invoices",
        icon: "Receipt",
        labelKey: "invoices",
        permission: "invoices",
      },
      {
        id: "employees",
        path: "/employees",
        icon: "Users",
        labelKey: "employees",
        permission: "employees",
      },
      {
        id: "guest-app",
        path: "/guest-app",
        icon: "Smartphone",
        labelKey: "guestApp",
        permission: "guest_app",
      },
    ],
  },
  {
    id: "management",
    labelKey: "management",
    items: [
      {
        id: "users",
        path: "/user-management",
        icon: "UserCog",
        labelKey: "userManagement",
        permission: "user_management",
      },
    ],
  },
  {
    id: "settings",
    labelKey: "settings",
    items: [
      {
        id: "settings",
        path: "/settings",
        icon: "SlidersHorizontal",
        labelKey: "settings",
        permission: "settings",
      },
    ],
  },
];

/** Map route path → permission id for route guards */
export const pathPermission: Record<string, string> = Object.fromEntries(
  navigation.flatMap((s) => s.items.map((i) => [i.path, i.permission])),
);
