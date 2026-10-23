export type Lens = "io" | "nest";

export const LENS_STORAGE_KEY = "familynest.lens";

const listeners = new Set<() => void>();

/** Lens kept for the browser session (sessionStorage); "io" otherwise. */
export function getLensSnapshot(): Lens {
  try {
    return window.sessionStorage.getItem(LENS_STORAGE_KEY) === "nest"
      ? "nest"
      : "io";
  } catch {
    return "io";
  }
}

export function getServerLensSnapshot(): Lens {
  return "io";
}

export function subscribeLens(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLens(lens: Lens): void {
  try {
    window.sessionStorage.setItem(LENS_STORAGE_KEY, lens);
  } catch {
    // Storage not available: the choice is lost on reload, nothing else.
  }
  listeners.forEach((listener) => listener());
}
