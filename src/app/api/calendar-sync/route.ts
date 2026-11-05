import { after, NextResponse, type NextRequest } from "next/server";
import { secretsMatch } from "@/lib/calendar-sync/crypto";
import { runScheduledJob } from "@/lib/calendar-sync/sync";
import { getCalendarSyncSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * The synchronisation service (#34 §7, decision F1 = B). The scheduled job of
 * the database (pg_cron every 15 minutes, with pg_net) calls it with
 * `POST { "job": "scheduled" }` and the secret of the Vault as bearer token.
 *
 * - Nobody else may call it: the secret is compared in constant time, and a
 *   wrong, missing or malformed secret gets the same 401 with an empty body.
 * - Without the secret in the environment the service answers 503 and does
 *   nothing: it never runs open.
 * - Only POST exists (any other method answers 405).
 * - The answer is 202 at once and the work goes on after it (`after`): the call
 *   of pg_net closes after 10 seconds, the work takes up to 50. The answer says
 *   nothing of the work; no token, mail, name or title is ever written, and the
 *   errors are not described.
 */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
// Leaves room to answer before the function is stopped.
const BUDGET_MS = 50_000;

export async function POST(request: NextRequest) {
  const expected = getCalendarSyncSecret();
  if (!expected) {
    return new NextResponse(null, { status: 503, headers: NO_STORE });
  }
  const given = /^Bearer (.+)$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!given || !secretsMatch(given, expected)) {
    return new NextResponse(null, { status: 401, headers: NO_STORE });
  }

  let job: unknown;
  try {
    const body: unknown = await request.json();
    job =
      typeof body === "object" && body !== null
        ? (body as { job?: unknown }).job
        : undefined;
  } catch {
    job = undefined;
  }
  if (job !== "scheduled") {
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }

  const deadline = Date.now() + BUDGET_MS;
  after(async () => {
    try {
      await runScheduledJob(createAdminClient(), { deadline });
    } catch {
      // The next run (15 minutes later) tries again; nothing is described.
    }
  });
  return NextResponse.json(
    { ok: true, accepted: true },
    { status: 202, headers: NO_STORE },
  );
}
