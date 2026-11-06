import { NextResponse, type NextRequest } from "next/server";

// Target of the native submit of the «Nuova password» form (see
// /accesso/mail/invio): reads nothing, so the password never reaches the URL
// or the server. POST only.
export function POST(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/accesso/nuova-password", request.nextUrl.origin),
    303,
  );
}
