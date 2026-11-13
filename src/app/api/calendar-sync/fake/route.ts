import { NextResponse, type NextRequest } from "next/server";
import { secretsMatch } from "@/lib/calendar-sync/crypto";
import { applyFakeControl } from "@/lib/calendar-sync/fake-provider";
import {
  processOutbox,
  processRevocations,
  syncAccountsOfUser,
} from "@/lib/calendar-sync/sync";
import {
  getCalendarSyncSecret,
  isFakeCalendarProviderEnabled,
} from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * The remote control of the fake provider, for tests (#34 §11). Not found
 * (404) unless the fake provider is switched on, which it never is in
 * production; then the same secret as the synchronisation service is needed.
 *
 * `{ action: "setup" | "set-events" | "fail" | "log" | "reset", ... }` prepare
 * the fake and read its register (see `applyFakeControl`);
 * `{ action: "sync", userId }` synchronises the accounts of that user now;
 * `{ action: "revocations" }` and `{ action: "outbox" }` run those queues now.
 */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!isFakeCalendarProviderEnabled()) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }
  const expected = getCalendarSyncSecret();
  const given = /^Bearer (.+)$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!expected || !given || !secretsMatch(given, expected)) {
    return new NextResponse(null, { status: 401, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const action =
    typeof body === "object" && body !== null
      ? (body as { action?: unknown }).action
      : undefined;

  try {
    if (action === "sync") {
      const userId = (body as { userId?: unknown }).userId;
      if (typeof userId !== "string") {
        return NextResponse.json(
          { ok: false },
          { status: 400, headers: NO_STORE },
        );
      }
      const results = await syncAccountsOfUser(createAdminClient(), userId);
      return NextResponse.json({ ok: true, results }, { headers: NO_STORE });
    }
    if (action === "revocations") {
      const result = await processRevocations(createAdminClient(), {
        deadline: Date.now() + 50_000,
      });
      return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
    }
    if (action === "outbox") {
      // With a user, only the queue of its accounts (tests side by side).
      const userId = (body as { userId?: unknown }).userId;
      const result = await processOutbox(createAdminClient(), {
        deadline: Date.now() + 50_000,
        ...(typeof userId === "string" ? { userId } : {}),
      });
      return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
    }
    const result = applyFakeControl(body);
    return NextResponse.json(result, {
      status: result.ok ? 200 : 400,
      headers: NO_STORE,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}
