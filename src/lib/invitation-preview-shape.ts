import type { Database } from "@/types/database";

type MemberColor = Database["public"]["Enums"]["member_color"];

/** Another member of the Nest as the welcome page (07) shows it: initial and colour only. */
export type InvitationMember = {
  initial: string;
  color: MemberColor;
};

/** Same, for the colour page of someone signed in without a Nest: the name too, when there is one. */
export type NamedInvitationMember = InvitationMember & { name?: string };

export type InvitationPreview<M extends InvitationMember = InvitationMember> =
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
      members: M[];
    }
  | { status: "invalid" }
  // Database or network failure: never say «scaduto» for it.
  | { status: "error" };

export type PreviewRow = {
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
 * Turns the row of `invitation_preview` into the page type. The generated type
 * says every field is a string, but they are `null` for an invalid invitation
 * (and `inviter_name`, `message` and the member names can be `null` too), so
 * each value is checked here. With `withNames` false the member names are
 * dropped: the welcome page is public and must not receive them.
 */
export function shapePreview(
  row: PreviewRow | undefined,
  withNames: boolean,
): InvitationPreview<NamedInvitationMember> {
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
  const members: NamedInvitationMember[] = [];
  for (const member of row.members ?? []) {
    if (!member.initial || !member.color) continue;
    members.push(
      withNames && member.name
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
