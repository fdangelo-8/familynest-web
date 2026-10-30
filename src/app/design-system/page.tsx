import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "./Gallery";

export const metadata: Metadata = {
  title: "Design system · FamilyNest",
  robots: "noindex",
};

/**
 * Verification gallery of the design system: every component in every
 * variant and state. Available locally, in CI and in Vercel previews; in
 * production it answers "not found" (decision D-3). It reads no data.
 */
export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();
  // #133: the clickable-row cards for the hover tests are shown only on
  // request, so the reference of the whole gallery does not change.
  const { "righe-scheda": rowCards } = await searchParams;
  return <Gallery rowCards={rowCards === "1"} />;
}
