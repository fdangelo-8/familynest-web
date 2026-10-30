import { NextResponse, type NextRequest } from "next/server";
import { getInvitationPreview } from "@/lib/invitation-preview";
import {
  INVITE_COOKIE_NAME,
  INVITE_WELCOME_PATH,
  clearInviteCookieOptions,
  inviteCookieOptions,
  isValidInviteToken,
} from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";

// The invitation link: `/invito/<token>`. A technical route, no interface.
// The token is a credential: it goes into an HttpOnly cookie and leaves the
// address with a 303 to `/invito`. Never log it, never put it in `next`.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { origin } = request.nextUrl;
  const { token } = await params;

  const response = NextResponse.redirect(
    new URL(INVITE_WELCOME_PATH, origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  const clear = () =>
    response.cookies.set(
      INVITE_COOKIE_NAME,
      "",
      clearInviteCookieOptions(origin),
    );

  // A token that is not 32-128 hex characters never reaches the database.
  if (!isValidInviteToken(token)) {
    clear();
    return response;
  }

  // The cookie lasts 24 hours, or less if the invitation expires sooner.
  let expiresAt: string | null = null;
  try {
    const preview = await getInvitationPreview(
      await createClient(),
      token,
      false,
    );
    if (preview.status === "invalid") {
      clear();
      return response;
    }
    if (preview.status === "valid") expiresAt = preview.expiresAt;
    // On a technical error the cookie is kept: /invito shows the error page
    // with «Riprova» and the link still works afterwards.
  } catch {
    // Same as a technical error.
  }

  const options = inviteCookieOptions(origin, expiresAt);
  if (!options) {
    clear();
    return response;
  }
  response.cookies.set(INVITE_COOKIE_NAME, token, options);
  return response;
}
