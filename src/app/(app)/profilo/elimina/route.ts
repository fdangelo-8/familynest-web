import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookies } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import { readOutlook } from "../outlook";

/*
 * «Elimina l'account» (#38). POST only: any other method answers 405 without
 * doing anything, and a POST from another site is refused (403), like
 * `/auth/signout`.
 *
 * The account deleted is always the one of the verified session; the body only
 * says what the dialog announced («the Nest goes away too», true or false), and
 * the database checks it: if the situation changed it answers FN003, nothing is
 * deleted and the page gets the new outlook (409) to show the new dialog.
 *
 * After the deletion the session cookies are deleted. `auth.signOut()` is not
 * called: the account no longer exists. Nothing personal goes to the logs.
 */
const NO_STORE = { "Cache-Control": "no-store" };

type Refreshed = Array<{
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
}>;

/** `refreshed`: cookies the session client renewed, kept when nothing was deleted. */
function json(
  body: unknown,
  status: number,
  refreshed: Refreshed = [],
): NextResponse {
  const response = NextResponse.json(body, { status, headers: NO_STORE });
  for (const { name, value, options } of refreshed) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403, headers: NO_STORE });
  }

  let expectHouseholdDeletion: unknown;
  try {
    const body: unknown = await request.json();
    expectHouseholdDeletion =
      typeof body === "object" && body !== null
        ? (body as { expectHouseholdDeletion?: unknown })
            .expectHouseholdDeletion
        : undefined;
  } catch {
    expectHouseholdDeletion = undefined;
  }
  if (typeof expectHouseholdDeletion !== "boolean") {
    return json({ ok: false }, 400);
  }

  // A token renewed by `getUser()` must not be lost when nothing is deleted
  // (409, 500): the browser would keep a refresh token already used. After a
  // deletion the cookies are removed instead.
  const refreshed: Refreshed = [];
  try {
    const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
    // The client reads the session from the request. Renewed cookies are only
    // kept in `refreshed`: the answer decides whether to send them.
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabasePublishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            refreshed.push(...cookiesToSet);
          },
        },
      },
    );

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return json({ ok: false }, 401, refreshed);

    const { error } = await supabase.rpc("delete_own_account", {
      p_expect_household_deletion: expectHouseholdDeletion,
    });

    if (error) {
      if (error.code === "FN003") {
        const outlook = await readOutlook(supabase, data.user.id);
        return outlook
          ? json({ ok: false, changed: true, outlook }, 409, refreshed)
          : json({ ok: false }, 500, refreshed);
      }
      return json({ ok: false }, 500, refreshed);
    }

    const response = json({ ok: true }, 200);
    clearSessionCookies(request, response);
    return response;
  } catch {
    return json({ ok: false }, 500, refreshed);
  }
}
