import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Pages that open over another page (a sheet or the search palette): while
 * one is open `usePathname()` says its address, but the page below must not
 * change.
 */
const OVERLAY_PATHS: readonly string[] = ["/aggiungi", "/ricerca"];

/**
 * Pathname the frame (bars, navigation) should follow. While Add or the
 * search is open over a page, `usePathname()` says `/aggiungi` or `/ricerca`,
 * but the page below must not change: the frame keeps the last other address.
 * Opened directly, there is nothing below and the address stays as is
 * (`/aggiungi` counts as Today; `/ricerca` has no bar on mobile).
 */
export function useFramePathname(): string {
  const pathname = usePathname();
  const [below, setBelow] = useState(pathname);
  const isOverlay = OVERLAY_PATHS.includes(pathname);
  if (!isOverlay && pathname !== below) setBelow(pathname);
  return isOverlay ? below : pathname;
}
