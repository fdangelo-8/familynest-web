import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { resolveDestination } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

// Return from the link sent by mail. Server only, no interface.
// The link carries `token_hash`, not a PKCE code, so it also works when it is
// opened in another browser or in the mail app of the phone.
// Never log `token_hash` or any token.
const ALLOWED_TYPES: ReadonlyArray<EmailOtpType> = [
  "email",
  "magiclink",
  "signup",
];

function isAllowedType(value: string | null): value is EmailOtpType {
  return (
    value !== null && (ALLOWED_TYPES as ReadonlyArray<string>).includes(value)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const expired = () =>
    NextResponse.redirect(new URL("/accesso/link-scaduto", origin), 303);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!tokenHash || !isAllowedType(type)) return expired();

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) return expired();
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
