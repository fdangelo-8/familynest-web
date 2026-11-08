import { NextResponse, type NextRequest } from "next/server";
import { resolveDestination } from "@/lib/auth/destination";
import {
  RECOVERY_COOKIE_NAME,
  RECOVERY_PATH,
  clearRecoveryCookieOptions,
  newRecoveryCookieValue,
  recoveryCookieOptions,
} from "@/lib/auth/recovery-cookie";
import { INVITE_WELCOME_PATH, readInviteToken } from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";

// Return from Apple and Google, and from the mail links of Supabase's default
// templates (#327, PKCE: the link comes back with `?code=`). Server only, no
// interface. Never log `code` or any token.
const CANCELLED_ERRORS = ["access_denied", "user_cancelled_authorize"];

/** `?tipo=` of the mail links: confirmation of the address or recovery. */
type MailKind = "conferma" | "password";

function mailKindOf(value: string | null): MailKind | null {
  return value === "conferma" || value === "password" ? value : null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const mailKind = mailKindOf(searchParams.get("tipo"));
  const providerParam = searchParams.get("provider");
  const provider =
    providerParam === "google" || providerParam === "apple"
      ? providerParam
      : null;

  // No session: back to /accesso with a generic error (never technical details).
  // With the invitation cookie the person is on the invitation: back to /invito,
  // which shows the same notice (the token never goes in the address).
  // A mail link that does not work (invalid, expired, opened in another
  // browser: the PKCE code belongs to the browser that asked) goes to «link
  // scaduto», where «Rimanda» is.
  const failure = (cancelled: boolean) => {
    if (mailKind) {
      const expired = new URL("/accesso/link-scaduto", origin);
      expired.searchParams.set("tipo", mailKind);
      return NextResponse.redirect(expired, 303);
    }
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure(false);

    if (mailKind === "password") {
      // `tipo` is chosen by whoever opens the link: the recovery is decided by
      // the exchange itself (the verifier saved by resetPasswordForEmail).
      // (The SDK returns it at runtime but its types do not declare it.)
      const { redirectType } = data as { redirectType?: string | null };
      if (redirectType !== "recovery") return failure(false);
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
    const response = NextResponse.redirect(new URL(destination, origin), 303);
    // A confirmation must not leave an open recovery behind.
    if (mailKind === "conferma" && request.cookies.has(RECOVERY_COOKIE_NAME)) {
      response.cookies.set(
        RECOVERY_COOKIE_NAME,
        "",
        clearRecoveryCookieOptions(origin),
      );
    }
    return response;
  } catch {
    return failure(false);
  }
}
