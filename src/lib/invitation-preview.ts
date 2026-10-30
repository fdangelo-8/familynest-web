import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isValidInviteToken } from "./invitations";
import {
  shapePreview,
  type InvitationMember,
  type InvitationPreview,
  type NamedInvitationMember,
  type PreviewRow,
} from "./invitation-preview-shape";

export type {
  InvitationMember,
  InvitationPreview,
  NamedInvitationMember,
} from "./invitation-preview-shape";

/**
 * The one place that calls `invitation_preview` (LEZIONI: pages never call
 * the RPC directly). `withNames` is required: `false` for the public welcome
 * page (07), whose members carry no name; `true` only for the colour page of
 * someone signed in without a Nest. Never log the token or the result.
 */
export async function getInvitationPreview(
  supabase: SupabaseClient<Database>,
  token: string | null,
  withNames: false,
): Promise<InvitationPreview<InvitationMember>>;
export async function getInvitationPreview(
  supabase: SupabaseClient<Database>,
  token: string | null,
  withNames: true,
): Promise<InvitationPreview<NamedInvitationMember>>;
export async function getInvitationPreview(
  supabase: SupabaseClient<Database>,
  token: string | null,
  withNames: boolean,
): Promise<InvitationPreview<NamedInvitationMember>> {
  if (!isValidInviteToken(token)) return { status: "invalid" };
  const { data, error } = await supabase.rpc("invitation_preview", {
    p_token: token,
  });
  if (error) return { status: "error" };
  return shapePreview(data?.[0] as PreviewRow | undefined, withNames);
}
