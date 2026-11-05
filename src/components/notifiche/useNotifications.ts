"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useNotificationCount } from "@/components/ui/AppFrame/NotificationCount";
import {
  listNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import {
  markAllRead,
  readContext,
  readDigest,
  type DigestState,
  type PageContext,
} from "./data";
import { MARK_ALL_DONE_ANNOUNCEMENT, type Failure } from "./texts";

type Client = SupabaseClient<Database>;

export type PageStatus = "loading" | "ready" | "error";

/** What one successful reading of the page gives. */
export type Loaded = {
  notifications: NotificationItem[];
  context: PageContext;
  digest: DigestState;
  /** The moment of the reading: «oggi», «domani» and the hour of «offline» follow it */
  now: Date;
};

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** False while the browser says there is no connection. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Reads the page in the browser (so it owns its loading and error states),
 * keeps which notifications were new when it opened, and runs «Segna tutte
 * come lette».
 *
 * Opening the page marks the shown notifications read, but the dots stay for
 * the whole visit: the bell number is set (`setCount`) BEFORE the marking, so
 * a count read that was already on its way cannot take the dot away.
 */
export function useNotifications() {
  const { setCount } = useNotificationCount();
  const clientRef = useRef<Client | null>(null);
  const sequence = useRef(0);
  const newIdsRef = useRef<ReadonlySet<string>>(new Set());

  const [status, setStatus] = useState<PageStatus>("loading");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [digestRetrying, setDigestRetrying] = useState(false);
  const [marking, setMarking] = useState(false);
  const [allMarked, setAllMarked] = useState(false);
  const [markFailure, setMarkFailure] = useState<Failure | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const online = useOnline();

  const getClient = useCallback((): Client => {
    clientRef.current ??= createClient();
    return clientRef.current;
  }, []);

  /** Reads everything. "failed": nothing new to show; "stale": a newer read took over. */
  const load = useCallback(async (): Promise<"ok" | "failed" | "stale"> => {
    const mine = ++sequence.current;
    const now = new Date();
    const client = getClient();
    const contextRead = readContext(client);
    const [list, context, digest] = await Promise.all([
      listNotifications(client, now),
      contextRead,
      contextRead.then((found): Promise<DigestState> | DigestState =>
        found ? readDigest(client, found, now) : { kind: "none" },
      ),
    ]);
    if (mine !== sequence.current) return "stale";
    if (!list.ok || !context) return "failed";

    const unread = list.notifications
      .filter((item) => item.readAt === null)
      .map((item) => item.id);
    const nextNew = new Set([...newIdsRef.current, ...unread]);
    newIdsRef.current = nextNew;
    setNewIds(nextNew);
    setLoaded({ notifications: list.notifications, context, digest, now });
    setStatus("ready");
    setAllMarked(false);
    // The bell keeps the number of the opening; then the shown ones are read.
    setCount(list.notifications.filter((item) => nextNew.has(item.id)).length);
    void markNotificationsRead(unread, client);
    return "ok";
  }, [getClient, setCount]);

  useEffect(() => {
    let alive = true;
    void load().then((result) => {
      if (alive && result === "failed") setStatus("error");
    });
    return () => {
      alive = false;
    };
  }, [load]);

  /** «Riprova» of the page error and of the offline notice. */
  const retry = useCallback(() => {
    setRetrying(true);
    void load().finally(() => setRetrying(false));
  }, [load]);

  /** «Riprova» of the summary alone. */
  const retryDigest = useCallback(() => {
    if (!loaded) return;
    setDigestRetrying(true);
    const now = new Date();
    void readDigest(getClient(), loaded.context, now)
      .then((digest) => {
        setLoaded((current) => (current ? { ...current, digest } : current));
      })
      .finally(() => setDigestRetrying(false));
  }, [getClient, loaded]);

  /** «Segna tutte come lette» (desktop). */
  const markAll = useCallback(async () => {
    if (marking || !online || allMarked || newIdsRef.current.size === 0) return;
    setMarking(true);
    setMarkFailure(null);
    const failure = await markAllRead(getClient(), [...newIdsRef.current]);
    setMarking(false);
    if (failure) {
      setMarkFailure(failure);
      return;
    }
    newIdsRef.current = new Set();
    setNewIds(newIdsRef.current);
    setCount(0);
    setAllMarked(true);
    setAnnouncement(MARK_ALL_DONE_ANNOUNCEMENT);
  }, [allMarked, getClient, marking, online, setCount]);

  return {
    status,
    loaded,
    newIds,
    online,
    retry,
    retrying,
    retryDigest,
    digestRetrying,
    markAll,
    marking,
    allMarked,
    markFailure,
    announcement,
    getClient,
  };
}
