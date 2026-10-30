"use client";

import { useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * True from 1024 px. For parts that exist in one layout only (the quick field
 * of Da fare is not in the page at all on mobile). The pages that use it draw
 * after their data has loaded, so there is no server render to match.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
