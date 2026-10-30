"use server";

import { MEMBER_COLORS, type MemberColor } from "@/components/ui/Avatar/Avatar";
import type { MemberSaveResult } from "@/components/ui/MemberSheet/MemberSheet";
import { isHouseholdFullError } from "@/lib/household-limits";
import { createClient } from "@/lib/supabase/server";

// Same limit as NAME_MAX_LENGTH in MemberSheet. That is a "use client" module:
// a server action gets only a reference from it, not the number.
const NAME_MAX_LENGTH = 40;

/** Like `MemberSaveResult`, with the id of the new member (null if it could not be read). */
export type AddAdultResult =
  | { ok: true; memberId: string | null }
  | Exclude<MemberSaveResult, { ok: true }>;

/**
 * Adds an adult (name and colour only) to the signed-in user's Nest. The
 * browser sends just the name and the colour: the Nest is decided here, with
 * the user's own session, so the database rules (RLS) apply. No invitation is
 * created by this page: it is created from the page of the member (#18).
 */
export async function addAdultToNest(
  name: string,
  color: string,
): Promise<AddAdultResult> {
  const trimmed = typeof name === "string" ? name.trim() : "";
  // `insieme` is not a colour a person can have.
  const chosen = MEMBER_COLORS.find(
    (c): c is Exclude<MemberColor, "insieme"> => c === color && c !== "insieme",
  );
  if (!trimmed || trimmed.length > NAME_MAX_LENGTH || !chosen) {
    return { ok: false, reason: "server" };
  }

  try {
    const supabase = await createClient();
    const { data: householdId, error: householdError } = await supabase.rpc(
      "current_household_id",
    );
    if (householdError) return { ok: false, reason: failureOf(householdError) };
    if (!householdId) return { ok: false, reason: "server" };

    const { error } = await supabase.from("household_members").insert({
      household_id: householdId,
      kind: "adult",
      name: trimmed,
      color: chosen,
    });
    if (!error) {
      // The colour is unique in the Nest: it tells which row is the new one.
      // Separate query, never `.select()` after the insert.
      const created = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .eq("color", chosen)
        .maybeSingle();
      return { ok: true, memberId: created.data?.id ?? null };
    }

    if (error.code === "23505" && error.message.includes("color")) {
      return { ok: false, reason: "color-taken" };
    }
    if (isHouseholdFullError(error)) return { ok: false, reason: "full" };
    return { ok: false, reason: failureOf(error) };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Database unreachable (fetch failed) versus any other failure. */
function failureOf(error: { code?: string; message: string }) {
  return !error.code && /fetch failed|network|timeout/i.test(error.message)
    ? ("network" as const)
    : ("server" as const);
}
