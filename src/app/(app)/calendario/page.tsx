import type { Metadata } from "next";
import { WeekPage } from "@/components/calendario-settimana/WeekPage";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["calendario"].browserTitle,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Proven (#330): without this line /oggi sent endless prefetches to
  // `/calendario?settimana=…` (about 270 requests a second); with it they
  // stop. Not explained: why the sibling pages Giorno and Mese, which have the
  // same structure, did not loop. A guess, not measured, is that the page
  // whose answer never depends on the query is refetched on every render.
  // Giorno and Mese read the query too, so a change of Next or of the links
  // cannot reopen the loop there. The week itself is read by the browser.
  await searchParams;
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // The week, the clock and the events are the browser's: the page owns its
  // loading and error states, and the HTML carries no event data.
  return <WeekPage />;
}
