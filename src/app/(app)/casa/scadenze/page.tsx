import type { Metadata } from "next";
import { CasaPage } from "@/components/casa/CasaPage";
import { requireNest } from "@/lib/nest-frame";

export const metadata: Metadata = {
  title: "FamilyNest · Casa · Scadenze",
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed || frame.nestName === null) return null;

  // The lists are read in the browser, so the page can show its own loading
  // and error states.
  return <CasaPage nestName={frame.nestName} current="scadenze" />;
}
