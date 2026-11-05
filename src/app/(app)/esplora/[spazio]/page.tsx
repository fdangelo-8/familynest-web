import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaceComingPage } from "@/components/esplora/SpaceComingPage";
import { requireNest } from "@/lib/nest-frame";
import {
  getSpaceByHref,
  isSpaceAvailable,
  type MemberCounts,
} from "@/lib/spaces";
import { createClient } from "@/lib/supabase/server";

function findSpace(slug: string) {
  return getSpaceByHref(`/esplora/${slug}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ spazio: string }>;
}): Promise<Metadata> {
  const space = findSpace((await params).spazio);
  return { title: space ? `FamilyNest · ${space.name}` : "FamilyNest" };
}

/** Counts of the Nest members by kind; null if they cannot be read. */
async function readCounts(): Promise<MemberCounts | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("kind");
  if (error) return null;
  return {
    adults: data.filter((m) => m.kind === "adult").length,
    children: data.filter((m) => m.kind === "child").length,
    pets: data.filter((m) => m.kind === "pet").length,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ spazio: string }>;
}) {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  const space = findSpace((await params).spazio);
  if (!space) notFound();
  // The frame already shows its own error: nothing to read here.
  if (frame.failed) return null;

  // The server decides if the space exists for this Nest (RLS: own members
  // only). A space that is not available is a missing page.
  const counts = await readCounts();
  if (!counts) throw new Error("Could not read the members of the Nest");
  if (!isSpaceAvailable(space.key, counts)) notFound();

  // Pin, «Avvisami» and the names of children and pets are read in the
  // browser: the page has its own loading and error states and nothing
  // personal is in the HTML.
  return <SpaceComingPage spaceKey={space.key} />;
}
