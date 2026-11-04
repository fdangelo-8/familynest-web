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

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
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

  try {
    const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
    // The client reads the session from the request. It never writes cookies:
    // the response below deletes them, and nothing may put one back.
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabasePublishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      },
    );

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return json({ ok: false }, 401);

    const { error } = await supabase.rpc("delete_own_account", {
      p_expect_household_deletion: expectHouseholdDeletion,
    });

    if (error) {
      if (error.code === "FN003") {
        const outlook = await readOutlook(supabase, data.user.id);
        return outlook
          ? json({ ok: false, changed: true, outlook }, 409)
          : json({ ok: false }, 500);
      }
      return json({ ok: false }, 500);
    }

    const response = json({ ok: true }, 200);
    clearSessionCookies(request, response);
    return response;
  } catch {
    return json({ ok: false }, 500);
  }
}
