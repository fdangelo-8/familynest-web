import { NextResponse, type NextRequest } from "next/server";
import {
  redirectToDestination,
  redirectToProvider,
} from "@/lib/calendar-sync/link-response";
import { isLinkDestination, startOAuth } from "@/lib/calendar-sync/oauth";
import {
  isProviderConfigured,
  providerForNewLink,
} from "@/lib/calendar-sync/providers";
import { isProviderId } from "@/lib/calendar-sync/types";
import { createClient } from "@/lib/supabase/server";

/*
 * «Collega Google» / «Collega Outlook» (#34 §10): POST only. The server draws
 * `state` and PKCE, keeps them in an HttpOnly cookie bound to the session, and
 * answers 303 to the page of the provider, in the same window (no popup).
 *
 * The form says only where the user comes from (`destination`: `page` or
 * `onboarding`, a closed list); anything else counts as `page`. A POST from
 * another site is refused. Nothing personal goes to the logs.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403, headers: NO_STORE });
  }
  const { provider: providerId } = await params;
  if (!isProviderId(providerId)) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }

  let destination: "page" | "onboarding" = "page";
  try {
    const form = await request.formData();
    const wanted = form.get("destination");
    if (isLinkDestination(wanted)) destination = wanted;
  } catch {
    // No form: the page.
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/accesso", request.nextUrl.origin), {
      status: 303,
      headers: NO_STORE,
    });
  }

  // No keys for this provider here: do not send the user anywhere.
  if (!isProviderConfigured(providerId)) {
    return redirectToDestination(
      request.nextUrl.origin,
      destination,
      providerId,
      "not_configured",
    );
  }

  try {
    const { provider } = providerForNewLink(providerId);
    const start = startOAuth({
      userId: data.user.id,
      provider: providerId,
      destination,
    });
    const url = provider.authorizationUrl({
      state: start.state,
      codeChallenge: start.codeChallenge,
      redirectUri: new URL(
        `/calendari-collegati/ritorno/${providerId}`,
        request.nextUrl.origin,
      ).toString(),
    });
    return redirectToProvider(request.nextUrl.origin, url, start.cookieValue);
  } catch {
    // Provider not configured here, or no key: back to the page with an error.
    return redirectToDestination(
      request.nextUrl.origin,
      destination,
      providerId,
      "failed",
    );
  }
}
