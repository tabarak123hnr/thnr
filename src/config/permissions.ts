export const PERMISSIONS = [
  { id: "dashboard", label: "Dashboard", labelUr: "ڈیش بورڈ" },
  { id: "notifications", label: "Notifications", labelUr: "اطلاعات" },
  { id: "rooms", label: "Rooms", labelUr: "کمرے" },
  { id: "check_in", label: "Check-in", labelUr: "چیک ان" },
  { id: "bookings", label: "Booking requests", labelUr: "بکنگ درخواستیں" },
  { id: "housekeeping", label: "Housekeeping", labelUr: "ہاؤس کیپنگ" },
  { id: "compliance", label: "Compliance", labelUr: "کمپلائنس" },
  { id: "qr_cards", label: "QR cards", labelUr: "کیو آر کارڈز" },
  { id: "counter", label: "Counter", labelUr: "کاؤنٹر" },
  { id: "orders", label: "Orders", labelUr: "آرڈرز" },
  { id: "menu", label: "Menu", labelUr: "مینو" },
  { id: "accounts", label: "Accounts", labelUr: "اکاؤنٹس" },
  { id: "invoices", label: "Invoices / Bills", labelUr: "انوائس / بلز" },
  { id: "employees", label: "Employees", labelUr: "ملازمین" },
  { id: "guest_app", label: "Guest app", labelUr: "مہمان ایپ" },
  { id: "user_management", label: "User management", labelUr: "یوزر مینجمنٹ" },
  { id: "settings", label: "Settings", labelUr: "ترتیبات" },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionId[]> = {
  owner: PERMISSIONS.map((p) => p.id),
  admin: PERMISSIONS.filter((p) => p.id !== "settings").map((p) => p.id),
  reception: ["dashboard", "notifications", "rooms", "check_in", "bookings", "invoices", "compliance"],
  housekeeping: ["dashboard", "notifications", "rooms", "housekeeping"],
  restaurant: ["dashboard", "notifications", "counter", "orders", "menu"],
  accountant: ["dashboard", "notifications", "accounts", "invoices"],
};
