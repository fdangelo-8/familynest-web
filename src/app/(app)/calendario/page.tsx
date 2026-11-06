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
  // The week is read by the browser, but the address of this page is linked
  // with `?settimana=…` from Oggi, Mese, Giorno and the event. If the server
  // never reads the query, its answer does not say it depends on it, and Next
  // prefetches every visible link to `/calendario?settimana=…` again, without
  // end (#330). Reading it makes the answer vary with the query.
  await searchParams;
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // The week, the clock and the events are the browser's: the page owns its
  // loading and error states, and the HTML carries no event data.
  return <WeekPage />;
}
