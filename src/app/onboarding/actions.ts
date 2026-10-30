"use server";

import { isLiving, type Living } from "@/components/onboarding/choices";
import { memberNameFor, nestNameFor } from "@/components/onboarding/names";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type HouseholdType = Database["public"]["Enums"]["household_type"];

const TYPE: Record<Living, HouseholdType> = {
  solo: "single",
  coppia: "couple",
  famiglia: "family_with_children",
  coinquilini: "roommates",
};

export type CreateNestResult =
  | { status: "error" }
  | {
      status: "ok";
      destination: "/onboarding/persone" | "/oggi" | "/accesso";
    };

/**
 * Creates the person's Nest. The browser sends only the answer: Nest name,
 * member name, colour and user are decided here. On success, or when the
 * person already has a Nest, it returns the destination (the client navigates:
 * a redirect() would reject the action promise in the client).
 */
export async function createNest(answer: string): Promise<CreateNestResult> {
  if (!isLiving(answer)) return { status: "error" };

  let destination: "/onboarding/persone" | "/oggi" | "/accesso";
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError?.name === "AuthRetryableFetchError") {
      return { status: "error" };
    }
    if (userError || !userData.user) {
      destination = "/accesso";
    } else {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profileError) return { status: "error" };
      const displayName = profile?.display_name ?? null;

      const { error } = await supabase.rpc("create_household", {
        name: nestNameFor(displayName),
        household_type: TYPE[answer],
        member_name: memberNameFor(displayName),
        color: "pomodoro",
      });
      if (!error) {
        destination = "/onboarding/persone";
      } else if (
        (error.code === "P0001" &&
          error.message.includes("already belongs to a household")) ||
        // Two simultaneous requests: the second hits the unique user_id.
        error.code === "23505"
      ) {
        destination = "/oggi";
      } else {
        return { status: "error" };
      }
    }
  } catch {
    return { status: "error" };
  }
  return { status: "ok", destination };
}

/**
 * "Indietro" from step 2: the administrator changes the answer of step 1.
 * Only the Nest type is updated (no second Nest, members untouched). The Nest
 * is decided here, and the database lets only an administrator update it.
 */
export async function changeAnswer(answer: string): Promise<CreateNestResult> {
  if (!isLiving(answer)) return { status: "error" };

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError?.name === "AuthRetryableFetchError") {
      return { status: "error" };
    }
    if (userError || !userData.user) {
      return { status: "ok", destination: "/accesso" };
    }

    const { data: householdId, error: householdError } = await supabase.rpc(
      "current_household_id",
    );
    if (householdError || !householdId) return { status: "error" };

    const { error, count } = await supabase
      .from("households")
      .update({ household_type: TYPE[answer] }, { count: "exact" })
      .eq("id", householdId);
    // Zero rows: not an administrator (row-level security hides the Nest).
    if (error || !count) return { status: "error" };
  } catch {
    return { status: "error" };
  }
  return { status: "ok", destination: "/onboarding/persone" };
}
