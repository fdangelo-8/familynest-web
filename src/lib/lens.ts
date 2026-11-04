export type Lens = "io" | "nest";

export const LENS_STORAGE_KEY = "familynest.lens";

const listeners = new Set<() => void>();

/** Lens chosen in the profile (`profiles.start_lens`); "io" if it could not be read. */
export const DEFAULT_START_LENS: Lens = "io";

/**
 * Lens kept for the browser session (sessionStorage) if the person already
 * touched it in this session; otherwise the one chosen in the profile.
 */
export function getLensSnapshot(startLens: Lens = DEFAULT_START_LENS): Lens {
  try {
    const stored = window.sessionStorage.getItem(LENS_STORAGE_KEY);
    return stored === "io" || stored === "nest" ? stored : startLens;
  } catch {
    return startLens;
  }
}

/** The server cannot see the session: the first render starts from the profile. */
export function getServerLensSnapshot(
  startLens: Lens = DEFAULT_START_LENS,
): Lens {
  return startLens;
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
