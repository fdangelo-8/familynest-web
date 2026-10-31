"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useIsDesktop } from "../ui/overlay";
import { Sheet } from "../ui/Sheet/Sheet";

/**
 * After a direct opening, moves the focus to the `main` of the new Today page.
 * The old page's `main` (the one under the sheet) and, while streaming, the
 * loading one coexist with the new one for a moment, and are then replaced:
 * so it waits for the address to be `/oggi` and for a single `main`, and
 * focuses again whenever the `main` element changes, until it has been stable.
 *
 * It stops as soon as the user acts after the close (a key other than Escape,
 * or a pointer press): from then on the focus is theirs. It does not look at
 * `document.activeElement`: after the navigation the router itself may have
 * focused something, and that is not a choice of the user.
 */
function focusMainWhenReady() {
  let tries = 0;
  let stable = 0;
  let userActed = false;
  let focused: HTMLElement | null = null;
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") userActed = true;
  };
  const onPointer = () => {
    userActed = true;
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onPointer, true);
  const stop = (id: number) => {
    window.clearInterval(id);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onPointer, true);
  };
  const id = window.setInterval(() => {
    tries += 1;
    if (userActed) return stop(id);
    const mains = document.querySelectorAll<HTMLElement>("main#contenuto");
    if (window.location.pathname === "/oggi" && mains.length === 1) {
      const main = mains[0]!;
      if (main !== focused || document.activeElement !== main) {
        if (main !== focused) stable = 0;
        main.focus();
        focused = main;
      } else {
        stable += 1;
      }
    }
    if (stable >= 5 || tries > 100) stop(id);
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
