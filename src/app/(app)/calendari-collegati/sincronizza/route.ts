import { NextResponse, type NextRequest } from "next/server";
import { syncAccount, syncAccountsOfUser } from "@/lib/calendar-sync/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { STALE_AFTER_MS } from "../load";

/*
 * «Sincronizza ora» of the page (#34 §7): POST only, for the signed-in adult.
 *
 * - `{ accountId }`: that account (after a calendar is switched on, or a
 *   «Riprova»). The account is looked for with the adult's own session first,
 *   so an id of someone else, of another Nest or unknown gets the same 404;
 * - `{}`: the accounts of the adult whose last synchronisation is older than
 *   five minutes (when the page opens).
 *
 * The answer comes when the work is done and says nothing of it: no token,
 * mail, name or title is written to a log or to the answer. The administrative
 * client is used only inside the service, with the id of the verified session.
 */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function answer(status: number) {
  return new NextResponse(null, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return answer(403);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return answer(401);

  let accountId: string | null = null;
  try {
    const body: unknown = await request.json();
    const wanted =
      typeof body === "object" && body !== null
        ? (body as { accountId?: unknown }).accountId
        : undefined;
    if (wanted !== undefined) {
      if (typeof wanted !== "string" || !UUID.test(wanted)) return answer(400);
      accountId = wanted;
    }
  } catch {
    // No body: the accounts that are out of date.
  }

  try {
    if (accountId) {
      const { data: own, error: readError } = await supabase
        .from("calendar_accounts")
        .select("id")
        .eq("id", accountId)
        .maybeSingle();
      if (readError) return answer(500);
      if (!own) return answer(404);
      await syncAccount(createAdminClient(), own.id);
    } else {
      await syncAccountsOfUser(createAdminClient(), data.user.id, {
        olderThanMs: STALE_AFTER_MS,
      });
    }
    return answer(204);
  } catch {
    return answer(500);
  }
}
