"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "../ui/Sheet/Sheet";

/**
 * Placeholder body of the Add sheet. Issue #20 fills it in; the slot, the
 * route and the close behaviour (back to the page below) are final.
 */
export function AddSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      title="Aggiungi"
      info="scrivi come parli"
      onClose={() => {
        setOpen(false);
        router.back();
      }}
    >
      <p className="t-corpo t-secondario">In arrivo.</p>
    </Sheet>
  );
}
