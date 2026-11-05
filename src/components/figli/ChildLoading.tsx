"use client";

import { BarAction } from "@/components/ui/AppFrame/BarAction";
import { ChildSkeleton } from "./ChildSkeleton";

/**
 * Shown inside the frame while the page opens. The pencil of the bar is there
 * but does nothing yet; there is no name to read before the page is.
 */
export function ChildLoading() {
  return (
    <main id="contenuto" tabIndex={-1} className="pagina pagina-desktop">
      <BarAction
        icon="pencil"
        label="Modifica il profilo"
        inactive
        onClick={() => undefined}
      />
      <ChildSkeleton />
    </main>
  );
}
