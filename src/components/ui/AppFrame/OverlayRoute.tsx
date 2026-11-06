"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";

/**
 * Content of an intercepted route (a sheet over the current page), drawn only
 * while the address is the route's own and the route is shown.
 *
 * With `cacheComponents` Next keeps the page it leaves hidden, with its state.
 * An overlay left behind that way came back with the state of its previous
 * life (closed, saved), so the address changed and no sheet appeared. Drawing
 * nothing when the address is another one unmounts the overlay on leaving, and
 * every opening starts from a fresh one.
 *
 * The same address can be served by two routes (`@modal/aggiungi` when typed,
 * `@modal/(.)aggiungi` from inside the app); the one that is not in use stays
 * hidden, but the address is still its own, so it would stay in the document
 * with its sheet. Hiding cleans up the layout effect: the overlay draws
 * nothing while hidden and starts fresh when shown again.
 */
export function OverlayRoute({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [shown, setShown] = useState(true);
  useLayoutEffect(() => {
    setShown(true);
    return () => setShown(false);
  }, []);
  return pathname === path && shown ? children : null;
}
