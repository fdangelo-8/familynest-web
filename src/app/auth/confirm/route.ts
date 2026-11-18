import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import {
  RECOVERY_COOKIE_NAME,
  clearRecoveryCookieOptions,
} from "@/lib/auth/recovery-cookie";
import { isSameOriginPost } from "@/lib/auth/same-origin-post";
import { createClient } from "@/lib/supabase/server";

// Return from the link sent by mail (#327, #419, #461).
//  - GET with `type=email|signup|recovery` and a token is answered by a page
//    with a button (a rewrite in next.config.ts keeps this address): it never
//    uses the token, so mail programs that check links do not consume it.
//  - POST (the button of the confirmation page) confirms the address. The
//    button of the new-password page posts to /auth/recupero instead.
// The link carries `token_hash`, not a PKCE code, so it also works when it is
// opened in another browser. Never log `token_hash` or any token.
const CONFIRM_TYPES: ReadonlyArray<EmailOtpType> = ["email", "signup"];
const CONFIRMED_PATH = "/accesso/mail-confermata";

function isConfirmType(value: unknown): value is EmailOtpType {
  return (
    typeof value === "string" &&
    (CONFIRM_TYPES as ReadonlyArray<string>).includes(value)
  );
}

function expiredResponse(origin: string, kind: "conferma" | "password") {
  const url = new URL("/accesso/link-scaduto", origin);
  url.searchParams.set("tipo", kind);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// A GET that reaches the handler is a link without a token, or with a type
// the pages do not answer: no link is ever used by a GET.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  return expiredResponse(
    origin,
    searchParams.get("type") === "recovery" ? "password" : "conferma",
  );
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
  let next: FormDataEntryValue | null = null;
  try {
    const form = await request.formData();
    type = form.get("type");
    tokenHash = form.get("token_hash");
    next = form.get("next");
  } catch {
    return expiredResponse(origin, "conferma");
  }
  // `recovery` and every other type end here: no session, no cookie.
  if (typeof tokenHash !== "string" || !tokenHash || !isConfirmType(type)) {
    return expiredResponse(origin, "conferma");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    // Whoever was signed in stays signed in.
    if (error) return expiredResponse(origin, "conferma");

    const target = new URL(CONFIRMED_PATH, origin);
    const safeNext = safeNextPath(typeof next === "string" ? next : null);
    if (safeNext) target.searchParams.set("next", safeNext);
    // The final address no longer contains `token_hash`.
    const response = NextResponse.redirect(target, 303);
    response.headers.set("Cache-Control", "no-store");
    // A confirmation must not leave an open recovery behind.
    if (request.cookies.has(RECOVERY_COOKIE_NAME)) {
      response.cookies.set(
        RECOVERY_COOKIE_NAME,
        "",
        clearRecoveryCookieOptions(origin),
      );
    }
    return response;
  } catch {
    return expiredResponse(origin, "conferma");
  }
}
