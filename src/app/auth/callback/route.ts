import { NextResponse, type NextRequest } from "next/server";
import { resolveDestination } from "@/lib/auth/destination";
import { INVITE_WELCOME_PATH, readInviteToken } from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";

// Return from Apple and Google. Server only, no interface.
// Never log `code` or any token.
const CANCELLED_ERRORS = ["access_denied", "user_cancelled_authorize"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const providerParam = searchParams.get("provider");
  const provider =
    providerParam === "google" || providerParam === "apple"
      ? providerParam
      : null;

  // No session: back to /accesso with a generic error (never technical details).
  // With the invitation cookie the person is on the invitation: back to /invito,
  // which shows the same notice (the token never goes in the address).
  const failure = (cancelled: boolean) => {
    const url = new URL(
      readInviteToken(request.cookies) ? INVITE_WELCOME_PATH : "/accesso",
      origin,
    );
    url.searchParams.set("errore", provider ?? "accesso");
    if (cancelled && provider) url.searchParams.set("annullato", "1");
    return NextResponse.redirect(url, 303);
  };

  const providerError = searchParams.get("error");
  const code = searchParams.get("code");
  if (providerError || !code) {
    return failure(
      providerError !== null && CANCELLED_ERRORS.includes(providerError),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure(false);
    const destination = await resolveDestination(
      supabase,
      searchParams.get("next"),
    );
    return NextResponse.redirect(new URL(destination, origin), 303);
  } catch {
    return failure(false);
  }
}
