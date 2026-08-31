import { useEffect, useState } from "react";
import { buildOpsNotifications } from "../lib/buildNotifications";
import { subscribeBookingRequests } from "../services/bookingRequests";
import { subscribeCheckIns } from "../services/checkIns";
import { subscribeHousekeepingTasks } from "../services/housekeeping";
import { subscribeOrders } from "../services/orders";
import { subscribeRooms } from "../services/rooms";
import type { BookingRequest } from "../types/bookingRequest";
import type { CheckInRecord } from "../types/checkIn";
import type { HousekeepingTask } from "../types/housekeeping";
import type { FoodOrder } from "../types/order";
import type { HotelRoom } from "../types/room";

export function useOpsBadges() {
  const [roomsBadge, setRoomsBadge] = useState<string | null>(null);
  const [housekeepingBadge, setHousekeepingBadge] = useState<number | null>(null);
  const [ordersBadge, setOrdersBadge] = useState<number | null>(null);
  const [notificationsBadge, setNotificationsBadge] = useState<number | null>(null);

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);

  useEffect(() => {
    const unsubRooms = subscribeRooms((next) => {
      setRooms(next);
      const total = next.length;
      if (!total) {
        setRoomsBadge(null);
        return;
      }
      const occupied = next.filter(
        (r) => r.status === "occupied" || r.status === "reserved",
      ).length;
      setRoomsBadge(`${occupied}/${total}`);
    });
    const unsubTasks = subscribeHousekeepingTasks((next) => {
      setTasks(next);
      const open = next.filter((t) => t.status !== "done").length;
      setHousekeepingBadge(open > 0 ? open : null);
    });
    const unsubOrders = subscribeOrders((next) => {
      setOrders(next);
      const pending = next.filter((o) => o.status === "pending").length;
      setOrdersBadge(pending > 0 ? pending : null);
    });
    const unsubCheckIns = subscribeCheckIns(setCheckIns);
    const unsubBookings = subscribeBookingRequests(setBookings);
    return () => {
      unsubRooms();
      unsubTasks();
      unsubOrders();
      unsubCheckIns();
      unsubBookings();
    };
  }, []);

  useEffect(() => {
    const alerts = buildOpsNotifications({
      checkIns,
      orders,
      tasks,
      bookings,
      rooms,
    });
    const actionable = alerts.filter(
      (n) => n.severity === "critical" || n.severity === "warning",
    ).length;
    setNotificationsBadge(actionable > 0 ? actionable : null);
  }, [checkIns, orders, tasks, bookings, rooms]);

  return { roomsBadge, housekeepingBadge, ordersBadge, notificationsBadge };
}
