import { useSyncExternalStore } from "react";

/**
 * The current minute, read in the browser (Rome time is applied when it is
 * shown). It is 0 on the server and before the browser has taken over, and it
 * changes once a minute: the «adesso» line, the «passato» rows and «oggi» all
 * follow it with the data already read.
 */

const MINUTE_MS = 60_000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule() {
  timer = setTimeout(
    () => {
      timer = null;
      listeners.forEach((listener) => listener());
      if (listeners.size > 0) schedule();
    },
    MINUTE_MS - (Date.now() % MINUTE_MS),
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

function getServerSnapshot(): number {
  return 0;
}

/** Start of the current minute (epoch ms), or 0 until the browser is ready. */
export function useNowMinute(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
