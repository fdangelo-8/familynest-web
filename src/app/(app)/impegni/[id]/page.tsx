import type { Metadata } from "next";
import { EventDetailPage } from "@/components/impegni/EventDetailPage";
import { isValidDayKey } from "@/lib/datetime";
import { requireNest } from "@/lib/nest-frame";

export const metadata: Metadata = {
  // The title of the event is not here: the title ends up in the history.
  title: "FamilyNest · Impegno",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ giorno?: string | string[] }>;
}) {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed || frame.nestName === null) return null;

  const { id } = await params;
  const { giorno } = await searchParams;
  const raw = Array.isArray(giorno) ? giorno[0] : giorno;
  const day = typeof raw === "string" && isValidDayKey(raw) ? raw : null;

  // The event is read in the browser: the HTML of the server has no data of
  // the event, only its address.
  return <EventDetailPage eventId={id} day={day} />;
}
