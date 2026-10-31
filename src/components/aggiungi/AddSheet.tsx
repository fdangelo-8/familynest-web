"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "../ui/Sheet/Sheet";

/** Moves the focus to the page's `main` once the new page has replaced the old one. */
function focusMainWhenReady() {
  let tries = 0;
  const id = window.setInterval(() => {
    tries += 1;
    const main = document.getElementById("contenuto");
    if (window.location.pathname === "/oggi" && main) {
      main.focus();
      window.clearInterval(id);
    } else if (tries > 40) {
      window.clearInterval(id);
    }
  }, 50);
}

/**
 * Placeholder body of the Add sheet. Issue #20 fills it in; the slot, the
 * route and the close behaviour are final.
 * - Opened from inside the app (intercepted route): closing goes back to the
 *   page below.
 * - Opened directly (typed address, reload, link): nothing to go back to, so
 *   closing replaces the address with `/oggi` and focuses `main#contenuto`.
 */
export function AddSheet({ direct = false }: { direct?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      title="Aggiungi"
      info="scrivi come parli"
      onClose={() => {
        setOpen(false);
        if (direct) {
          router.replace("/oggi");
          focusMainWhenReady();
        } else {
          router.back();
        }
      }}
    >
      <p className="t-corpo t-secondario">In arrivo.</p>
    </Sheet>
  );
}
