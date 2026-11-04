import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  clearSessionCookies,
  DELETE_COOKIE_OPTIONS,
} from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

// Sign out. POST only: a GET answers 405, so no external link can sign
// anyone out.
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
              response.cookies.set(name, "", {
                ...options,
                ...DELETE_COOKIE_OPTIONS,
              });
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

  clearSessionCookies(request, response);
  return response;
}
