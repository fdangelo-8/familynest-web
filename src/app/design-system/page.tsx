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
export default function DesignSystemPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <Gallery />;
}
