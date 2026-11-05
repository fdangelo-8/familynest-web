"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { countUnreadNotifications } from "@/lib/notifications";

type NotificationCountValue = {
  /** Unread notifications the bell shows. 0 = no number, no dot. */
  count: number;
  /** Reads the number again (after «Segna tutte come lette», or on demand) */
  refresh: () => Promise<void>;
  /** Sets the number without asking (after «Segna tutte come lette»: 0) */
  setCount: (count: number) => void;
};

const NotificationCountContext = createContext<NotificationCountValue | null>(
  null,
);

/**
 * The number of unread notifications for the bell (#39). The first value
 * comes from the server with the frame; the layout does not render again when
 * the page changes, so the number is read again in the browser at every
 * change of page. A failed read means a bell without number and no error.
 */
export function NotificationCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [count, setCountState] = useState(initialCount);
  // A newer read wins; an answer that comes late is thrown away.
  const latest = useRef(0);
  const first = useRef(true);

  const refresh = useCallback(async () => {
    latest.current += 1;
    const mine = latest.current;
    const result = await countUnreadNotifications();
    if (mine !== latest.current) return;
    setCountState(result.ok ? result.count : 0);
  }, []);

  const setCount = useCallback((next: number) => {
    latest.current += 1;
    setCountState(Math.max(0, Math.floor(next)));
  }, []);

  useEffect(() => {
    // The server has just read it for this page.
    if (first.current) {
      first.current = false;
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const value = useMemo(
    () => ({ count, refresh, setCount }),
    [count, refresh, setCount],
  );
  return (
    <NotificationCountContext.Provider value={value}>
      {children}
    </NotificationCountContext.Provider>
  );
}

/** The number for the bell, and how to change it. Inside the app frame only. */
export function useNotificationCount(): NotificationCountValue {
  const value = useContext(NotificationCountContext);
  if (!value) {
    throw new Error(
      "useNotificationCount must be used inside <NotificationCountProvider>",
    );
  }
  return value;
}
