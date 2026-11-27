/**
 * Whether the single-letter shortcuts are on (F5 #506 §8, WCAG 2.1.4). Kept
 * in the browser's `localStorage`: a preference of the device, no personal
 * data. On at the start; read again after a reload.
 */

export const SHORTCUTS_STORAGE_KEY = "single-letter-shortcuts";

const listeners = new Set<() => void>();
/** Choice kept while the page is open, when the storage is blocked. */
let inMemory: boolean | null = null;

export function getShortcutsEnabled(): boolean {
  try {
    return window.localStorage.getItem(SHORTCUTS_STORAGE_KEY) !== "off";
  } catch {
    return inMemory ?? true;
  }
}

/** The server cannot read the browser: on. */
export function getServerShortcutsEnabled(): boolean {
  return true;
}

export function setShortcutsEnabled(enabled: boolean): void {
  inMemory = enabled;
  try {
    if (enabled) window.localStorage.removeItem(SHORTCUTS_STORAGE_KEY);
    else window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, "off");
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
  for (const listener of listeners) listener();
}

export function subscribeShortcutsEnabled(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
