/**
 * What the Add sheet and the pages of Casa tell each other (issue #22), all in
 * the browser, nothing personal travels:
 * - «the list changed»: Aggiungi saved, changed or removed something, the page
 *   below reads its list again;
 * - «the list is fresh»: the page read it again, the focus can land;
 * - the element that opened the sheet, to give the focus back to it.
 */

export type ListKind = "todos" | "deadlines" | "shopping";

const CHANGED = "familynest:lists-changed";
const REFRESHED = "familynest:lists-refreshed";

/** Address of the sheet for editing a thing: only its id, never a title. */
export function editHref(kind: "da-fare" | "scadenza", id: string): string {
  return `/aggiungi?tipo=${kind}&modifica=${encodeURIComponent(id)}`;
}

function emit(name: string, kind: ListKind): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ListKind>(name, { detail: kind }));
}

function listen(
  name: string,
  kind: ListKind,
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    if ((event as CustomEvent<ListKind>).detail === kind) listener();
  };
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}

/** Aggiungi changed a list: the page that shows it reads it again. */
export function notifyListsChanged(kind: ListKind): void {
  emit(CHANGED, kind);
}

/** Returns the function that unsubscribes. */
export function subscribeListsChanged(
  kind: ListKind,
  listener: () => void,
): () => void {
  return listen(CHANGED, kind, listener);
}

/** The page read the list again and shows it. */
export function notifyListsRefreshed(kind: ListKind): void {
  emit(REFRESHED, kind);
}

/** Resolves at the next «refreshed» of this list, or after `timeoutMs`. */
export function waitListsRefreshed(
  kind: ListKind,
  timeoutMs = 3000,
): Promise<void> {
  return new Promise((resolve) => {
    let stop = () => {};
    const timer = window.setTimeout(() => {
      stop();
      resolve();
    }, timeoutMs);
    stop = listen(REFRESHED, kind, () => {
      window.clearTimeout(timer);
      stop();
      resolve();
    });
  });
}

/** The element of a page of Casa that opened the sheet for editing. */
export type Opener = {
  kind: ListKind;
  id: string;
  /** The element itself (its row), where the focus goes back after a change */
  primary: string;
  /** Where it goes when the element is gone, in order */
  fallbacks: string[];
};

let opener: Opener | null = null;

export function rememberOpener(next: Opener): void {
  opener = next;
}

export function readOpener(id: string): Opener | null {
  return opener && opener.id === id ? opener : null;
}

function firstVisible(selector: string): HTMLElement | null {
  const found = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return found.find((element) => element.getClientRects().length > 0) ?? null;
}

function frame(): Promise<void> {
  return new Promise((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
}

async function sheetGone(timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (!window.location.pathname.startsWith("/aggiungi")) return;
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
}

/**
 * Gives the focus to the first of these elements that is on screen, once the
 * list is fresh and the sheet has left (it gives the focus back on its own
 * when it leaves, so this one must come last).
 */
export function focusAfterSheet(
  refreshed: Promise<void>,
  selectors: readonly string[],
): void {
  void (async () => {
    await refreshed;
    await sheetGone(3000);
    await frame();
    await frame();
    for (const selector of selectors) {
      const target = firstVisible(selector);
      if (target) {
        // A heading is not focusable by itself (the visible h1 may be the bar's).
        const isHeading = /^h[1-6]$/i.test(target.tagName);
        if (isHeading && !target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }
        target.focus();
        return;
      }
    }
  })();
}
