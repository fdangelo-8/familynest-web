import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sign out. POST only: a GET answers 405, so no external link can sign
// anyone out.
const SESSION_COOKIE =
  /^sb-.+-auth-token(\.\d+)?$|^sb-.+-auth-token-code-verifier$/;

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
    const supabase = await createClient();
    // Closes the session of this device only.
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Even if Supabase does not answer, the cookies below are deleted anyway.
  }

  for (const cookie of request.cookies.getAll()) {
    if (SESSION_COOKIE.test(cookie.name)) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}
