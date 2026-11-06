import { NextResponse, type NextRequest } from "next/server";

// Target of the native submit of the «Password dimenticata» form (see
// /accesso/mail/invio): reads nothing, sends nothing. POST only.
export function POST(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/accesso/password-dimenticata", request.nextUrl.origin),
    303,
  );
}
