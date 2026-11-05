import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChildError } from "@/components/figli/ChildError";
import { ChildPage } from "@/components/figli/ChildPage";
import { requireNest, type NestFrameData } from "@/lib/nest-frame";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  // The name of the child is not in the title: the title ends up in the history.
  title: "FamilyNest · Profilo di un figlio",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Checked =
  { status: "error" } | { status: "missing" } | { status: "ok"; name: string };

/**
 * Only checks that `id` is a child of the reader's Nest (RLS: another Nest
 * and a member that does not exist give the same answer). Everything else is
 * read in the browser, so the HTML carries no data of the child but the name
 * the pencil of the bar needs.
 */
async function check(frame: NestFrameData, id: string): Promise<Checked> {
  if (frame.failed) return { status: "error" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("name, kind")
    .eq("id", id)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!data || data.kind !== "child") return { status: "missing" };
  return { status: "ok", name: data.name };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Session and Nest check before anything else (the layout is not a guard).
  const frame = await requireNest();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const checked = await check(frame, id).catch((): Checked => ({
    status: "error",
  }));
  if (checked.status === "error") return <ChildError />;
  if (checked.status === "missing") notFound();

  return <ChildPage childId={id} childName={checked.name} />;
}
