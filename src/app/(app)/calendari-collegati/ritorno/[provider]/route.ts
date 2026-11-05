import { after, NextResponse, type NextRequest } from "next/server";
import { encryptCredentials } from "@/lib/calendar-sync/crypto";
import { redirectToDestination } from "@/lib/calendar-sync/link-response";
import {
  ADMIN_APPROVAL_ERROR,
  OAUTH_COOKIE,
  checkOAuth,
  type LinkDestination,
  type LinkResult,
} from "@/lib/calendar-sync/oauth";
import { providerForNewLink } from "@/lib/calendar-sync/providers";
import { refreshCalendarList, syncAccount } from "@/lib/calendar-sync/sync";
import { isProviderId, type CalendarProvider } from "@/lib/calendar-sync/types";
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
 * - an administrator must approve the app first: nothing saved, result
 *   `admin_approval`;
 * - the calendar permission was left off: nothing saved, the access just given
 *   is revoked, result `no_calendar_permission`;
 * - 5 accounts already: nothing saved, result `limit`;
 * - the same account again: its row is updated; result `relinked` when it had
 *   a problem before (the adult came to link it again), `already_linked`
 *   otherwise;
 * - otherwise the account is saved,
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

  // Whatever happens below, the answer is a 303 to a clean address (no `code`,
  // no `state`), the access just given is revoked if it was not kept, and the
  // cookie of `state` is deleted.
  let destination: LinkDestination = "page";
  const finish = (result: LinkResult) =>
    redirectToDestination(origin, destination, providerId, result);
  let issued: { provider: CalendarProvider; refreshToken: string } | null =
    null;
  const revokeIssued = async () => {
    if (!issued) return;
    const { provider, refreshToken } = issued;
    issued = null;
    // Without a revocation service (Outlook, #35) the user removes it from the account.
    if (!provider.canRevoke) return;
    try {
      await provider.revoke(refreshToken);
    } catch {
      // Best effort: the user can also remove it from the account settings.
    }
  };

  try {
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
    destination = check.destination;
    if (!check.ok) return finish("failed");

    // The user refused, or cancelled, on the page of the provider.
    if (searchParams.get("error") === "access_denied") return finish("denied");
    if (searchParams.get("error") === ADMIN_APPROVAL_ERROR)
      return finish("admin_approval");
    const code = searchParams.get("code");
    if (searchParams.has("error") || !code) return finish("failed");

    const linked = await exchange(origin, providerId, code, check.codeVerifier);
    issued = { provider: linked.provider, refreshToken: linked.refreshToken };

    if (!linked.calendarGranted) {
      // Nothing is kept: the access just given is returned to the provider.
      await revokeIssued();
      return finish("no_calendar_permission");
    }

    const admin = createAdminClient();
    const hadProblem = await accountHadProblem(
      admin,
      userId,
      providerId,
      linked.account.id,
    );
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
      await revokeIssued();
      // FN008: the adult has 5 accounts already.
      return finish(saveError?.code === "FN008" ? "limit" : "failed");
    }
    const accountId = saved[0].account_id;
    // is_new is false when this adult had the same provider account already.
    const result: LinkResult = saved[0].is_new
      ? "linked"
      : hadProblem
        ? "relinked"
        : "already_linked";
    // From here the account is kept: the token must not be revoked.
    const keptToken = linked.refreshToken;
    issued = null;

    // The calendars are there when the page opens; the events come right after.
    try {
      const session = await linked.provider.openSession(keptToken);
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

    return finish(result);
  } catch {
    await revokeIssued();
    return finish("failed");
  }
}

/**
 * Whether the account was in trouble before this link (the save puts it back
 * to «active», so it must be read first). Any doubt counts as «no problem».
 */
async function accountHadProblem(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  providerId: "google" | "outlook",
  providerAccountId: string,
): Promise<boolean> {
  try {
    const { data: member } = await admin
      .from("household_members")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "adult")
      .maybeSingle();
    if (!member) return false;
    const { data: account } = await admin
      .from("calendar_accounts")
      .select("status")
      .eq("member_id", member.id)
      .eq("provider", providerId)
      .eq("provider_account_id", providerAccountId)
      .maybeSingle();
    return !!account && account.status !== "active";
  } catch {
    return false;
  }
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
