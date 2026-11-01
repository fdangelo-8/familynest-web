import type { Metadata } from "next";
import { EsploraPage } from "@/components/esplora/EsploraPage";
import { requireNest } from "@/lib/nest-frame";

export const metadata: Metadata = {
  title: "FamilyNest · Esplora",
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // Members and pinned spaces are read in the browser, so the page can show
  // its own loading and error states and nothing personal is in the HTML.
  return <EsploraPage />;
}
