import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { resolveDestination } from "@/lib/auth/destination";
import {
  RECOVERY_COOKIE_NAME,
  RECOVERY_PATH,
  newRecoveryCookieValue,
  recoveryCookieOptions,
} from "@/lib/auth/recovery-cookie";
import { createClient } from "@/lib/supabase/server";

// Return from the link sent by mail (#327): confirmation of the address
// (`email`, or `signup` of older mails) or password recovery (`recovery`).
// Server only, no interface. The link carries `token_hash`, not a PKCE code,
// so it also works when it is opened in another browser or in the mail app of
// the phone. `magiclink` and every other type are refused: the magic link no
// longer exists. Never log `token_hash` or any token.
const ALLOWED_TYPES: ReadonlyArray<EmailOtpType> = [
  "email",
  "signup",
  "recovery",
];

function isAllowedType(value: string | null): value is EmailOtpType {
  return (
    value !== null && (ALLOWED_TYPES as ReadonlyArray<string>).includes(value)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const type = searchParams.get("type");
  const expired = () => {
    const url = new URL("/accesso/link-scaduto", origin);
    url.searchParams.set("tipo", type === "recovery" ? "password" : "conferma");
    return NextResponse.redirect(url, 303);
  };

  const tokenHash = searchParams.get("token_hash");
  if (!tokenHash || !isAllowedType(type)) return expired();

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) return expired();

    if (type === "recovery") {
      // Always the new-password page: `next` is ignored. The cookie tells the
      // page that this session comes from a recovery link.
      const response = NextResponse.redirect(
        new URL(RECOVERY_PATH, origin),
        303,
      );
      response.cookies.set(
        RECOVERY_COOKIE_NAME,
        newRecoveryCookieValue(),
        recoveryCookieOptions(origin),
      );
      return response;
    }

    const destination = await resolveDestination(
      supabase,
      searchParams.get("next"),
    );
    // The final address no longer contains `token_hash`.
    return NextResponse.redirect(new URL(destination, origin), 303);
  } catch {
    return expired();
  }
}
