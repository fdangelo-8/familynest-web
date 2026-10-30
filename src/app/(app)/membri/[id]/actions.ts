"use server";

import {
  inviteExpiryText,
  inviteSentText,
  inviteSubtitle,
} from "@/components/membri/texts";
import { createClient } from "@/lib/supabase/server";

export type Failure = "network" | "server";

export type SendInvitationResult =
  | {
      ok: true;
      token: string;
      expiresText: string;
      subtitle: string;
    }
  | { ok: false; reason: Failure };

export type ActionResult = { ok: true } | { ok: false; reason: Failure };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** supabase-js reports an unreachable server as an error without a code. */
function failureOf(error: { code?: string | null }): Failure {
  return error.code ? "server" : "network";
}

/*
 * All three actions receive only the id of the member (and, for the role, the
 * new value). The Nest is decided by the database from the user's own session
 * (RLS), never by the browser, and the administrative client is never used.
 */

/** Makes sure the adult has one valid invitation and returns the token. */
export async function sendInvitation(
  memberId: string,
): Promise<SendInvitationResult> {
  if (typeof memberId !== "string" || !UUID.test(memberId)) {
    return { ok: false, reason: "server" };
  }
  try {
    const supabase = await createClient();
    const { data: householdId, error: householdError } = await supabase.rpc(
      "current_household_id",
    );
    if (householdError) return { ok: false, reason: failureOf(householdError) };
    if (!householdId) return { ok: false, reason: "server" };

    const member = await supabase
      .from("household_members")
      .select("kind, user_id")
      .eq("id", memberId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (member.error) return { ok: false, reason: failureOf(member.error) };
    if (!member.data || member.data.kind !== "adult" || member.data.user_id) {
      return { ok: false, reason: "server" };
    }

    // The short code is never read: only id, token and the dates.
    const readPending = (validAt?: string) => {
      const pending = supabase
        .from("invitations")
        .select("id, token, created_at, expires_at")
        .eq("member_id", memberId)
        .eq("status", "pending");
      return (validAt ? pending.gt("expires_at", validAt) : pending)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    };

    const found = await readPending();
    if (found.error) return { ok: false, reason: failureOf(found.error) };
    if (found.data && Date.parse(found.data.expires_at) > Date.now()) {
      return done(found.data);
    }
    // Only one pending invitation per person: the expired one goes first.
    if (found.data) {
      const revoked = await supabase
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", found.data.id);
      if (revoked.error) {
        return { ok: false, reason: failureOf(revoked.error) };
      }
    }
    const insert = await supabase
      .from("invitations")
      .insert({ household_id: householdId, member_id: memberId });
    // 23505: another tab created it first. Not an error: read that one.
    if (insert.error && insert.error.code !== "23505") {
      return { ok: false, reason: failureOf(insert.error) };
    }

    // The new invitation is read with a separate query (never `.select()` after a write).
    const reread = await readPending(new Date().toISOString());
    if (reread.error) return { ok: false, reason: failureOf(reread.error) };
    if (!reread.data) return { ok: false, reason: "server" };
    return done(reread.data);
  } catch {
    return { ok: false, reason: "network" };
  }
}

function done(invitation: {
  token: string;
  created_at: string;
  expires_at: string;
}): SendInvitationResult {
  return {
    ok: true,
    token: invitation.token,
    expiresText: inviteExpiryText(invitation.expires_at),
    subtitle: inviteSubtitle(inviteSentText(invitation.created_at)),
  };
}

/** Gives or takes away the administrator role. */
export async function setAdmin(
  memberId: string,
  isAdmin: boolean,
): Promise<ActionResult> {
  if (
    typeof memberId !== "string" ||
    !UUID.test(memberId) ||
    typeof isAdmin !== "boolean"
  ) {
    return { ok: false, reason: "server" };
  }
  try {
    const supabase = await createClient();
    const update = await supabase
      .from("household_members")
      .update({ is_admin: isAdmin })
      .eq("id", memberId);
    if (update.error) return { ok: false, reason: failureOf(update.error) };

    // A refused update (not an administrator) touches no row and gives no
    // error: the value is read again to be sure.
    const reread = await supabase
      .from("household_members")
      .select("is_admin")
      .eq("id", memberId)
      .maybeSingle();
    if (reread.error) return { ok: false, reason: failureOf(reread.error) };
    if (!reread.data || reread.data.is_admin !== isAdmin) {
      return { ok: false, reason: "server" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Takes the member out of the Nest. Already gone counts as done. */
export async function removeMember(memberId: string): Promise<ActionResult> {
  if (typeof memberId !== "string" || !UUID.test(memberId)) {
    return { ok: false, reason: "server" };
  }
  try {
    const supabase = await createClient();
    const removed = await supabase
      .from("household_members")
      .delete()
      .eq("id", memberId);
    if (removed.error) return { ok: false, reason: failureOf(removed.error) };

    // A refused delete (not an administrator) touches no row and gives no error.
    const reread = await supabase
      .from("household_members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();
    if (reread.error) return { ok: false, reason: failureOf(reread.error) };
    return reread.data ? { ok: false, reason: "server" } : { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
