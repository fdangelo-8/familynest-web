import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Session refresh ONLY (issue #11, decision 5). Server Components cannot write
// cookies, so a refreshed token would be lost and the session with it (Supabase
// rotates refresh tokens). This file runs on Node.js, not on the Edge, and it
// does NOT check access and does NOT redirect: the checks stay on the server in
// the layouts and pages (`requireNest()`, `requireUser()`), see LEZIONI.md.
// Whatever happens here, the request always goes on.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return response;

  try {
    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // The refreshed cookies go to the page being rendered and to the browser.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    });
    // Reads the session and, if the access token is expired, refreshes it.
    await supabase.auth.getClaims();
  } catch {
    // A technical error must never block a page.
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
