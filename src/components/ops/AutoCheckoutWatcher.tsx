import { useEffect, useRef } from "react";
import {
  processDueCheckouts,
  subscribeCheckIns,
  type CheckInRecord,
} from "../../services/checkIns";

/** Runs scheduled check-outs when the planned check-out date/time has passed. */
export function AutoCheckoutWatcher() {
  const running = useRef(false);

  useEffect(() => {
    async function tick(rows?: CheckInRecord[]) {
      if (running.current) return;
      running.current = true;
      try {
        await processDueCheckouts(rows);
      } catch {
        // ignore — will retry on next tick / snapshot
      } finally {
        running.current = false;
      }
    }

    const unsub = subscribeCheckIns((rows) => {
      void tick(rows);
    });

    const interval = window.setInterval(() => {
      void tick();
    }, 60_000);

    void tick();

    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
