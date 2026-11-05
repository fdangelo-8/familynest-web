/**
 * On mobile the search is a page of its own, not a layer over the page it was
 * opened from (issue #40): from inside the app it is loaded as a normal page,
 * and this flag, kept for the tab only, tells the new page that there is an
 * app page behind it, so that «Annulla» goes back to it. Holds no text and no
 * id, only «1».
 */

const KEY = "familynest:search-from-app";

export function markSearchFromApp(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // Without storage «Annulla» leads to Oggi: nothing else is lost.
  }
}

/** Reads the flag once. */
export function takeSearchFromApp(): boolean {
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (value !== null) window.sessionStorage.removeItem(KEY);
    return value !== null;
  } catch {
    return false;
  }
}
