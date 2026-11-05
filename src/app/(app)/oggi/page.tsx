import type { Metadata } from "next";
import { OggiPage } from "@/components/oggi/OggiPage";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["oggi"].browserTitle,
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // The clock and all the data are the browser's: the page owns its loading
  // and error states, and the HTML carries no event, name or title.
  return <OggiPage />;
}
