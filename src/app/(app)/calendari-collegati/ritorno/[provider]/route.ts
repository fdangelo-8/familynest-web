import { after, NextResponse, type NextRequest } from "next/server";
import { encryptCredentials } from "@/lib/calendar-sync/crypto";
import { redirectToDestination } from "@/lib/calendar-sync/link-response";
import {
  OAUTH_COOKIE,
  checkOAuth,
  type LinkResult,
} from "@/lib/calendar-sync/oauth";
import { providerForNewLink } from "@/lib/calendar-sync/providers";
import { refreshCalendarList, syncAccount } from "@/lib/calendar-sync/sync";
import { isProviderId } from "@/lib/calendar-sync/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * The way back from the provider (#34 §9, §10): `/calendari-collegati/ritorno/
 * <provider>`, the address registered at Google and Microsoft.
 *
 * The server checks the cookie of `state` (constant time, 10 minutes, bound to
 * the session), uses the code at once and answers 303 to a CLEAN address: no
 * `code`, no `state`, no other parameter. Where it goes is `page` or
 * `onboarding` (from the cookie, a closed list), never an address from
 * outside. The result reaches the page in a short cookie (see oauth.ts).
 *
 * - the user refused (`error`): nothing saved, result `denied` (a notice);
 * - the calendar permission was left off: nothing saved, the access just given
 *   is revoked, result `no_calendar_permission`;
 * - 5 accounts already: nothing saved, result `limit`;
 * - otherwise the account is saved (the same account again updates its row),
 *   its calendars are read with the starting choices of #34 §6, and the first
 *   synchronisation starts after the answer.
 *
 * Nothing personal — code, token, mail, calendar name — goes to a log or to an
 * error message.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { origin, searchParams } = request.nextUrl;
  const { provider: providerId } = await params;
  if (!isProviderId(providerId)) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/accesso", origin), {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  const userId = data.user.id;

  const check = checkOAuth({
    cookieValue: request.cookies.get(OAUTH_COOKIE)?.value,
    stateFromProvider: searchParams.get("state"),
    userId,
    provider: providerId,
  });
  const finish = (result: LinkResult) =>
    redirectToDestination(origin, check.destination, providerId, result);
  if (!check.ok) return finish("failed");

  // The user refused, or cancelled, on the page of the provider.
  if (searchParams.get("error") === "access_denied") return finish("denied");
  const code = searchParams.get("code");
  if (searchParams.has("error") || !code) return finish("failed");

  let linked: Awaited<ReturnType<typeof exchange>>;
  try {
    linked = await exchange(origin, providerId, code, check.codeVerifier);
  } catch {
    return finish("failed");
  }

  if (!linked.calendarGranted) {
    // Nothing is kept: the access just given is returned to the provider.
    try {
      await linked.provider.revoke(linked.refreshToken);
    } catch {
      // Best effort: the user can also remove it from the account settings.
    }
    return finish("no_calendar_permission");
  }

  const admin = createAdminClient();
  const { data: saved, error: saveError } = await admin.rpc(
    "save_calendar_account",
    {
      p_user_id: userId,
      p_provider: providerId,
      p_provider_account_id: linked.account.id,
      p_email: linked.account.email,
      p_credentials_ciphertext: encryptCredentials(linked.refreshToken),
      p_is_fake: linked.isFake,
    },
  );
  if (saveError || !saved?.[0]) {
    try {
      await linked.provider.revoke(linked.refreshToken);
    } catch {
      // Best effort, as above.
    }
    // FN008: the adult has 5 accounts already.
    return finish(saveError?.code === "FN008" ? "limit" : "failed");
  }
  const accountId = saved[0].account_id;

  // The calendars are there when the page opens; the events come right after.
  try {
    const session = await linked.provider.openSession(linked.refreshToken);
    await refreshCalendarList(admin, accountId, session);
  } catch {
    // The account is saved; the next synchronisation reads the calendars.
  }
  after(async () => {
    try {
      await syncAccount(createAdminClient(), accountId);
    } catch {
      // The scheduled job tries again.
    }
  });

  return finish("linked");
}

async function exchange(
  origin: string,
  providerId: "google" | "outlook",
  code: string,
  codeVerifier: string,
) {
  const { provider, isFake } = providerForNewLink(providerId);
  const result = await provider.exchangeCode({
    code,
    codeVerifier,
    redirectUri: new URL(
      `/calendari-collegati/ritorno/${providerId}`,
      origin,
    ).toString(),
  });
  return { ...result, provider, isFake };
}
