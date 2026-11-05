import "server-only";
import type { DeletionOutlook } from "@/components/profilo/model";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type OutlookMember = {
  id: string;
  name: string;
  kind: "adult" | "child" | "pet";
  user_id: string | null;
  created_at: string;
};

/**
 * What `get_account_deletion_outcome()` answers. The generated type says
 * `string` for the administrator-to-be, but the database sends null when the
 * Nest stays with someone else in charge (lesson #96): read it as nullable.
 */
export type OutcomeRow = {
  deletes_household: boolean;
  next_admin_member_id: string | null;
};

/**
 * Words the dialog «Elimina l'account» needs. The rule («last adult with an
 * account») is the database's; the names are those of the members the Nest
 * keeps, in order of insertion, without pets.
 */
export function buildOutlook(
  members: ReadonlyArray<OutlookMember>,
  myUserId: string,
  outcome: OutcomeRow,
): DeletionOutlook {
  const others = members
    .filter((m) => m.user_id !== myUserId)
    .toSorted(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const heir = outcome.next_admin_member_id
    ? others.find((m) => m.id === outcome.next_admin_member_id)
    : undefined;
  return {
    isLastAdultWithAccount: outcome.deletes_household,
    remainingNames: outcome.deletes_household
      ? []
      : others.filter((m) => m.kind !== "pet").map((m) => m.name),
    newAdministratorName: outcome.deletes_household
      ? null
      : (heir?.name ?? null),
  };
}

/** Reads the outlook with the user's own session. `null` on any error. */
export async function readOutlook(
  supabase: Supabase,
  myUserId: string,
): Promise<DeletionOutlook | null> {
  const { data: householdId, error: householdError } = await supabase.rpc(
    "current_household_id",
  );
  if (householdError || !householdId) return null;

  const [members, outcome] = await Promise.all([
    supabase
      .from("household_members")
      .select("id, name, kind, user_id, created_at")
      .eq("household_id", householdId),
    supabase.rpc("get_account_deletion_outcome"),
  ]);
  const row = outcome.data?.[0];
  if (members.error || outcome.error || !row) return null;

  return buildOutlook(members.data, myUserId, {
    deletes_household: row.deletes_household,
    next_admin_member_id: row.next_admin_member_id as string | null,
  });
}
