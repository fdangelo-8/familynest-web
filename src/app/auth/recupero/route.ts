import { NextResponse, type NextRequest } from "next/server";
import {
  RECOVERY_COOKIE_NAME,
  RECOVERY_PATH,
  newRecoveryCookieValue,
  recoveryCookieOptions,
} from "@/lib/auth/recovery-cookie";
import { isSameOriginPost } from "@/lib/auth/same-origin-post";
import { createClient } from "@/lib/supabase/server";

// The button of the page that answers the link of «Password dimenticata»
// (#461): GET /auth/confirm?type=recovery never uses the token, this POST does.
// A separate route from /auth/confirm, which refuses `recovery`. Never log
// `token_hash` or any token.

function expiredResponse(origin: string) {
  const url = new URL("/accesso/link-scaduto", origin);
  url.searchParams.set("tipo", "password");
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  if (!isSameOriginPost(request)) {
    const refused = new NextResponse(null, { status: 403 });
    refused.headers.set("Cache-Control", "no-store");
    return refused;
  }

  let type: FormDataEntryValue | null = null;
  let tokenHash: FormDataEntryValue | null = null;
  try {
    const form = await request.formData();
    type = form.get("type");
    tokenHash = form.get("token_hash");
  } catch {
    return expiredResponse(origin);
  }
  // Only a recovery token is used here; `next` is never read. Any other type
  // ends here: no session, no cookie.
  if (typeof tokenHash !== "string" || !tokenHash || type !== "recovery") {
    return expiredResponse(origin);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    // Whoever was signed in stays signed in.
    if (error) return expiredResponse(origin);

    // Always the new-password page. The cookie tells the page that this
    // session comes from a recovery link.
    const response = NextResponse.redirect(new URL(RECOVERY_PATH, origin), 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(
      RECOVERY_COOKIE_NAME,
      newRecoveryCookieValue(),
      recoveryCookieOptions(origin),
    );
    return response;
  } catch {
    return expiredResponse(origin);
  }
}
