"use client";

import { BarAction } from "@/components/ui/AppFrame/BarAction";
import { WishlistSkeleton } from "./WishlistSkeleton";

/**
 * Shown inside the frame while the page opens. The «+» of the bar is there
 * but does nothing yet.
 */
export function WishlistLoading() {
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="pagina pagina-desktop pagina-desktop--centrata"
    >
      <BarAction
        icon="plus"
        label="Aggiungi un'idea"
        aria-haspopup="dialog"
        inactive
        onClick={() => undefined}
      />
      <WishlistSkeleton />
    </main>
  );
}
