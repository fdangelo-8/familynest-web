/**
 * The thresholds of the app frame, in one place (F5 #506, D8).
 *
 * 900 and 1280 px of width, 600 px of height. The same values are written in
 * `components.css` (media queries cannot read variables): a test keeps the two
 * in step. The inner rules of the pages (768, 1024) are not part of this.
 */

import { useSyncExternalStore } from "react";

/** The phone shape: narrower than 900 px, or lower than 600 px. */
export const PHONE_QUERY = "(max-width: 899px), (max-height: 599px)";
/** The computer shape with the icon bar. */
export const ICONS_QUERY =
  "(min-width: 900px) and (max-width: 1279px) and (min-height: 600px)";
/** The computer shape with the full bar. */
export const FULL_QUERY = "(min-width: 1280px) and (min-height: 600px)";

export type ShellLayout = "telefono" | "icone" | "intera";

/** The layout of the frame for the current window. */
export function getShellLayout(): ShellLayout {
  if (window.matchMedia(FULL_QUERY).matches) return "intera";
  if (window.matchMedia(ICONS_QUERY).matches) return "icone";
  return "telefono";
}

function subscribe(notify: () => void): () => void {
  const lists = [PHONE_QUERY, ICONS_QUERY, FULL_QUERY].map((query) =>
    window.matchMedia(query),
  );
  for (const list of lists) list.addEventListener("change", notify);
  return () => {
    for (const list of lists) list.removeEventListener("change", notify);
  };
}

/** The server cannot know the window: the first render is the phone. */
export function useShellLayout(): ShellLayout {
  return useSyncExternalStore(
    subscribe,
    getShellLayout,
    (): ShellLayout => "telefono",
  );
}
