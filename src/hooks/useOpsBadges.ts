import { useEffect, useState } from "react";
import { subscribeHousekeepingTasks } from "../services/housekeeping";
import { subscribeRooms } from "../services/rooms";

export function useOpsBadges() {
  const [roomsBadge, setRoomsBadge] = useState<string | null>(null);
  const [housekeepingBadge, setHousekeepingBadge] = useState<number | null>(null);

  useEffect(() => {
    const unsubRooms = subscribeRooms((rooms) => {
      const total = rooms.length;
      if (!total) {
        setRoomsBadge(null);
        return;
      }
      const occupied = rooms.filter(
        (r) => r.status === "occupied" || r.status === "reserved",
      ).length;
      setRoomsBadge(`${occupied}/${total}`);
    });
    const unsubTasks = subscribeHousekeepingTasks((tasks) => {
      const open = tasks.filter((t) => t.status !== "done").length;
      setHousekeepingBadge(open > 0 ? open : null);
    });
    return () => {
      unsubRooms();
      unsubTasks();
    };
  }, []);

  return { roomsBadge, housekeepingBadge };
}
