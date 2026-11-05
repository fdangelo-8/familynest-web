import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifiche/NotificationsPage";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["notifiche"].browserTitle,
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // The notifications are read in the browser, so the page can show its own
  // loading, error and offline states.
  return <NotificationsPage />;
}
