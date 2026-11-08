"use client";

import { useCallback, useEffect, useState } from "react";

/** How long before a new mail can be asked (decided by the interface). */
const WAIT_MS = 60_000;

/**
 * Countdown of the wait before a new mail. There is no live region on
 * purpose: one update per second would be read aloud.
 */
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (until === 0) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setUntil(t + WAIT_MS);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  return { secondsLeft, waiting: secondsLeft > 0, start };
}
