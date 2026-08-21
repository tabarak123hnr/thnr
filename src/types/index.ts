export type ThemeMode = "light" | "dark";
export type Language = "en" | "ur";

export type UserRole =
  | "owner"
  | "admin"
  | "reception"
  | "housekeeping"
  | "restaurant"
  | "accountant";

export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance" | "reserved";
export type OrderStatus = "received" | "preparing" | "on_the_way" | "served" | "cancelled";
export type OrderSource = "room" | "table" | "takeaway" | "counter";
export type InvoiceStatus = "paid" | "unpaid" | "partial" | "void";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "checked_in";

export interface NavItem {
  id: string;
  path: string;
  icon: string;
  labelKey: string;
  permission: string;
  badge?: number | string;
  badgeTone?: "gold" | "info" | "danger";
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
}

export interface Guest {
  id: string;
  name: string;
  nameUr?: string;
  phone: string;
  cnic: string;
  nationality: string;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
  notes?: string;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: string;
  typeUr: string;
  rate: number;
  status: RoomStatus;
  guest?: Guest;
  dirty: boolean;
  lastCleaned?: string;
  openOrders: number;
}

export interface MenuItem {
  id: string;
  name: string;
  nameUr: string;
  category: string;
  categoryUr: string;
  price: number;
  available: boolean;
  prepMinutes: number;
}

export interface OrderLine {
  qty: number;
  name: string;
  nameUr: string;
}

export interface Order {
  id: string;
  token: string;
  source: OrderSource;
  sourceLabel: string;
  items: OrderLine[];
  status: OrderStatus;
  ageMinutes: number;
  amount: number;
  placedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  guest: string;
  type: "room" | "restaurant" | "combined";
  amount: number;
  paid: number;
  status: InvoiceStatus;
  date: string;
}

export interface Employee {
  id: string;
  name: string;
  nameUr: string;
  role: UserRole;
  department: string;
  phone: string;
  shift: string;
  status: "active" | "on_leave" | "inactive";
  joined: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "invited" | "disabled";
  lastActive: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  titleUr: string;
  detail: string;
  detailUr: string;
  age: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  titleUr: string;
  body: string;
  bodyUr: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "success";
}

export interface BookingRequest {
  id: string;
  guest: string;
  phone: string;
  roomType: string;
  nights: number;
  checkIn: string;
  status: BookingStatus;
  channel: string;
}

export interface HousekeepingTask {
  id: string;
  room: string;
  type: "checkout_clean" | "stayover" | "deep_clean" | "turndown";
  priority: "high" | "normal" | "low";
  assignee: string;
  status: "pending" | "in_progress" | "done";
  due: string;
}
