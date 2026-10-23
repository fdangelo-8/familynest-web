import { NextResponse, type NextRequest } from "next/server";

// Target of the native submit of the mail form. The scripts normally
// intercept the submit; this answers when a person taps before they have
// loaded. It reads nothing and sends nothing: the address never reaches the
// URL or the server. POST only.
export function POST(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/accesso/mail", request.nextUrl.origin),
    303,
  );
}
