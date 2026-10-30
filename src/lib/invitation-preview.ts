import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isValidInviteToken } from "./invitations";

type MemberColor = Database["public"]["Enums"]["member_color"];

/** Another member of the Nest as the invitation shows it: initial and colour, plus the name only after sign-in without a Nest. */
export type InvitationMember = {
  initial: string;
  color: MemberColor;
  /** Present only for someone signed in who has no Nest yet (colour page). */
  name?: string;
};

export type InvitationPreview =
  | {
      status: "valid";
      householdName: string;
      /** `null` when whoever invited has left the Nest. */
      inviterName: string | null;
      /** `null` when there is no message. */
      message: string | null;
      inviteeName: string;
      inviteeColor: MemberColor;
      expiresAt: string;
      members: InvitationMember[];
    }
  | { status: "invalid" }
  // Database or network failure: never say «scaduto» for it.
  | { status: "error" };

type PreviewRow = {
  status: string;
  household_name: string | null;
  inviter_name: string | null;
  message: string | null;
  invitee_name: string | null;
  invitee_color: MemberColor | null;
  expires_at: string | null;
  members: Array<{
    initial: string | null;
    color: MemberColor | null;
    name: string | null;
  }> | null;
};

/**
 * The one place that calls `invitation_preview` (LEZIONI: pages never call
 * the RPC directly). The generated type says every field is a string, but
 * they are `null` for an invalid invitation, and `inviter_name`, `message` and
 * the member names can be `null` too, so each value is checked here.
 * Never log the token or the result.
 */
export async function getInvitationPreview(
  supabase: SupabaseClient<Database>,
  token: string | null,
): Promise<InvitationPreview> {
  if (!isValidInviteToken(token)) return { status: "invalid" };
  const { data, error } = await supabase.rpc("invitation_preview", {
    p_token: token,
  });
  if (error) return { status: "error" };
  const row = data?.[0] as PreviewRow | undefined;
  if (!row) return { status: "error" };
  if (row.status !== "valid") return { status: "invalid" };
  if (
    !row.household_name ||
    !row.invitee_name ||
    !row.invitee_color ||
    !row.expires_at
  ) {
    return { status: "error" };
  }
  const members: InvitationMember[] = [];
  for (const member of row.members ?? []) {
    if (!member.initial || !member.color) continue;
    members.push(
      member.name
        ? { initial: member.initial, color: member.color, name: member.name }
        : { initial: member.initial, color: member.color },
    );
  }
  return {
    status: "valid",
    householdName: row.household_name,
    inviterName: row.inviter_name || null,
    message: row.message?.trim() ? row.message : null,
    inviteeName: row.invitee_name,
    inviteeColor: row.invitee_color,
    expiresAt: row.expires_at,
    members,
  };
}
