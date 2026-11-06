"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Content of an intercepted route (a sheet over the current page), drawn only
 * while the address is the route's own.
 *
 * With `cacheComponents` Next keeps the page it leaves hidden, with its state.
 * An overlay left behind that way came back with the state of its previous
 * life (closed, saved), so the address changed and no sheet appeared. Drawing
 * nothing when the address is another one unmounts the overlay on leaving, and
 * every opening starts from a fresh one.
 */
export function OverlayRoute({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return pathname === path ? children : null;
}
