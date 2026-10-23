"use server";

import { redirect } from "next/navigation";
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

export type CreateNestResult = { status: "error" };

/**
 * Creates the person's Nest. The browser sends only the answer: Nest name,
 * member name, colour and user are decided here. On success, or when the
 * person already has a Nest, it redirects (so it only returns on error).
 */
export async function createNest(answer: string): Promise<CreateNestResult> {
  if (!isLiving(answer)) return { status: "error" };

  let destination: string;
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
        destination = "/oggi";
      } else if (
        error.code === "P0001" &&
        error.message.includes("already belongs to a household")
      ) {
        destination = "/oggi";
      } else {
        return { status: "error" };
      }
    }
  } catch {
    return { status: "error" };
  }
  // redirect() throws: it must stay outside the try block.
  redirect(destination);
}
