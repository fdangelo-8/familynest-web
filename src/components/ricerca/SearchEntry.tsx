"use client";

import { useEffect, type ReactNode } from "react";
import { useIsDesktop } from "@/components/ui/overlay";
import { markSearchFromApp } from "./from-app";
import { SearchPage } from "./SearchPage";
import { SearchPalette } from "./SearchPalette";

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * The page at `/ricerca` (typed address, reload, link): under 1024 px it is
 * the search page; from 1024 px the page below is Today and the palette
 * (from the `@modal` slot) is over it. `today` comes from the server.
 */
export function SearchPageSwitch({ today }: { today: ReactNode }) {
  const desktop = useIsDesktop();
  return desktop ? today : <SearchPage />;
}

/**
 * The palette in the `@modal` slot, from 1024 px. `direct`: the address was
 * opened directly, there is no page of the app behind it.
 *
 * Opened from a page of the app under 1024 px, the search is not a layer: the
 * page is loaded as a normal page (the intercepted route would leave the page
 * below, its bars and its title under the search). The flag tells the new
 * page that «Annulla» can go back.
 */
export function SearchOverlay({ direct }: { direct: boolean }) {
  const desktop = useIsDesktop();

  // The router keeps the routes it leaves hidden, with their state: a search
  // opened a second time would come back with the text and the results of the
  // first. `src/app/(app)/template.tsx` starts every page over when it is
  // shown again, so the palette needs nothing of its own.
  useEffect(() => {
    // The real width, not the first render's: the hook says «mobile» until
    // the page is hydrated.
    if (direct || window.matchMedia(DESKTOP_QUERY).matches) return;
    markSearchFromApp();
    window.location.replace("/ricerca");
  }, [direct, desktop]);

  return desktop ? <SearchPalette direct={direct} /> : null;
}
