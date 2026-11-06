import type { Metadata } from "next";
import { WeekPage } from "@/components/calendario-settimana/WeekPage";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["calendario"].browserTitle,
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // The week, the clock and the events are the browser's: the page owns its
  // loading and error states, and the HTML carries no event data.
  return <WeekPage />;
}
