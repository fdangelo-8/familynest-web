"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useIsDesktop } from "../ui/overlay";
import { Sheet } from "../ui/Sheet/Sheet";

/**
 * Placeholder body of the Add sheet. Issue #20 fills it in; the slot, the
 * route and the close behaviour are final.
 * - Opened from inside the app (intercepted route): closing goes back to the
 *   page below.
 * - Opened directly (typed address, reload, link): nothing to go back to, so
 *   closing loads `/oggi` as a normal page.
 */
export function AddSheet({ direct = false }: { direct?: boolean }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      title="Aggiungi"
      info={
        <>
          scrivi come parli
          {desktop ? (
            <>
              {" "}
              <kbd className="kbd" aria-hidden="true">
                esc
              </kbd>
            </>
          ) : null}
        </>
      }
      onClose={() => {
        setOpen(false);
        if (direct) {
          // a normal page load: a fresh Today, the focus starts at the top
          window.location.assign(new URL("/oggi", window.location.href).href);
        } else {
          router.back();
        }
      }}
    >
      <p className="t-corpo t-secondario">In arrivo.</p>
    </Sheet>
  );
}
