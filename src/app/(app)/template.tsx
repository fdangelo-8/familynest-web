"use client";

import type { ReactNode } from "react";
import { ResetOnReveal } from "@/components/ui/AppFrame/ResetOnReveal";

/**
 * One place for every page of the app (and the slots of `@modal`): whatever
 * is temporary in the interface (dialogs, sheets, edits in progress, panels
 * opened by hand) starts over when the page is shown again. Saved data is
 * always read again by the page itself. See `ResetOnReveal`.
 *
 * It must be a template: a layout is outside the hidden boundary Next draws
 * around each page it keeps, a template is inside it.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <ResetOnReveal>{children}</ResetOnReveal>;
}
