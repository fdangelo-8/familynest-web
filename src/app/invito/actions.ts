"use server";

import { cookies } from "next/headers";
import { clearInviteCookie } from "@/components/invito/server";
import type {
  ChoosableColor,
  TakenColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import { MEMBER_COLORS } from "@/components/ui/Avatar/Avatar";
import { isHouseholdFullError } from "@/lib/household-limits";
import { getInvitationPreview } from "@/lib/invitation-preview";
import {
  AFTER_INVITE_PATH,
  INVITE_WELCOME_PATH,
  readInviteToken,
} from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";

export type AcceptResult =
  // The client navigates (a redirect() would reject the promise in the client).
  | { status: "go"; destination: string }
  // The colour went to someone else meanwhile: the colours in use, read again.
  | { status: "taken"; taken: TakenColor[] }
  | { status: "full" }
  | { status: "error"; kind: "network" | "server" };

function isChoosable(value: string): value is ChoosableColor {
  return (
    value !== "insieme" &&
    (MEMBER_COLORS as ReadonlyArray<string>).includes(value)
  );
}

/**
 * «Continua» of the colour page: joins the Nest with the invitation and the
 * chosen colour, all in one database call. The browser sends only the colour:
 * the token comes from the HttpOnly cookie, and the Nest, the member and the
 * user are decided by the database. Never logs the token or the colour.
 */
export async function acceptInvitation(color: string): Promise<AcceptResult> {
  if (!isChoosable(color)) return { status: "error", kind: "server" };

  try {
    const token = readInviteToken(await cookies());
    // Cookie gone (expired, other tab): back to the welcome page.
    if (!token) return { status: "go", destination: INVITE_WELCOME_PATH };

    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_invitation_with_color", {
      p_token: token,
      p_color: color,
    });

    if (!error) {
      await clearInviteCookie();
      return { status: "go", destination: AFTER_INVITE_PATH };
    }
    if (error.code === "42501") {
      // Session lost: the welcome page asks to sign in again.
      return { status: "go", destination: INVITE_WELCOME_PATH };
    }
    if (
      error.code === "P0001" &&
      error.message.includes("invalid invitation")
    ) {
      await clearInviteCookie();
      return { status: "go", destination: INVITE_WELCOME_PATH };
    }
    if (
      error.code === "P0001" &&
      error.message.includes("already belongs to a household")
    ) {
      await clearInviteCookie();
      return { status: "go", destination: "/oggi" };
    }
    if (isHouseholdFullError(error)) return { status: "full" };
    if (error.code === "23505") {
      const preview = await getInvitationPreview(supabase, token, true);
      if (preview.status === "valid") {
        return {
          status: "taken",
          taken: preview.members.map((member) => ({
            color: member.color,
            by: member.name,
          })),
        };
      }
      if (preview.status === "invalid") {
        await clearInviteCookie();
        return { status: "go", destination: INVITE_WELCOME_PATH };
      }
      return { status: "error", kind: "server" };
    }
    return { status: "error", kind: error.code ? "server" : "network" };
  } catch {
    return { status: "error", kind: "network" };
  }
}
