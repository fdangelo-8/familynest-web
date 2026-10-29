import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MembersDemo } from "./MembersDemo";

export const metadata: Metadata = {
  title: "Design system · Membri · FamilyNest",
  robots: "noindex",
};

/**
 * Verification page of the shared member components (ColorChoice and
 * MemberSheet). Same rules as the gallery: not found in production, reads no data.
 */
export default function MembersDemoPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <MembersDemo />;
}
