import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

// Sign out. POST only: a GET answers 405, so no external link can sign
// anyone out.
const SESSION_COOKIE =
  /^sb-.+-auth-token(\.\d+)?$|^sb-.+-auth-token-code-verifier$/;

// `maxAge: 0` is dropped when the cookie is serialised, so a cookie is deleted
// with an `expires` in the past (same path as the session cookies).
const DELETE_OPTIONS = { path: "/", maxAge: 0, expires: new Date(0) } as const;

export async function POST(request: NextRequest) {
  // A form posted from another site is refused.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const response = NextResponse.redirect(
    new URL("/accesso", request.nextUrl.origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");

  try {
    const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            if (value) {
              response.cookies.set(name, value, options);
            } else {
              response.cookies.set(name, "", { ...options, ...DELETE_OPTIONS });
            }
          }
        },
      },
    });
    // Closes the session of this device only.
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Even if Supabase does not answer, the cookies below are deleted anyway.
  }

  for (const cookie of request.cookies.getAll()) {
    if (SESSION_COOKIE.test(cookie.name)) {
      response.cookies.set(cookie.name, "", DELETE_OPTIONS);
    }
  }
  return response;
}
