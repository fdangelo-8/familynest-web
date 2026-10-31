/**
 * Tiny in-page signal: "the events of the Nest changed". Whoever saves an
 * event calls `notifyEventsChanged()`; pages showing events subscribe and
 * read again. Carries no data (nothing personal travels in the event).
 */
const EVENT_NAME = "familynest:events-changed";

export function notifyEventsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

/** Returns the function that unsubscribes. */
export function subscribeEventsChanged(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
