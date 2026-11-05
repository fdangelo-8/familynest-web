import type { SupabaseClient } from "@supabase/supabase-js";
import { toDayKey, toTimeFieldValue } from "@/lib/datetime";
import { listHouseholdEvents } from "@/lib/household-events";
import type { Database } from "@/types/database";
import { buildDigest, digestPeriod, type DigestView } from "./digest";
import type { Member } from "./model";
import type { Failure } from "./texts";

type Client = SupabaseClient<Database>;

/** Who is reading and who is in the Nest. */
export type PageContext = {
  userId: string;
  /** null if the signed-in user has no member row (should not happen) */
  meId: string | null;
  members: Member[];
};

/** Morning summary: not there, there, or its own reading failed. */
export type DigestState =
  { kind: "none" } | { kind: "ready"; view: DigestView } | { kind: "error" };

const DEFAULT_MORNING_TIME = "07:30";

/**
 * Why a write failed. A request that got no answer (offline, cut) has status
 * 0 in the answer of the client; every answer of the server has its own.
 */
export function failureOf(status: number | undefined): Failure {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "network";
  }
  return status === undefined || status === 0 ? "network" : "server";
}

/** The Nest members and the one of the reader. Null when it cannot be read. */
export async function readContext(client: Client): Promise<PageContext | null> {
  try {
    const { data: session } = await client.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return null;
    const { data, error } = await client
      .from("household_members")
      .select("id, name, color, kind, user_id")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error || !data) return null;
    return {
      userId,
      meId: data.find((member) => member.user_id === userId)?.id ?? null,
      members: data.map((member) => ({
        id: member.id,
        name: member.name,
        color: member.color,
        kind: member.kind,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * The morning summary of today (#39 §3): there from the time chosen in the
 * profile until midnight, only when the switch «Sintesi del mattino» is on.
 * Reads the events and the things to do only when the summary is due.
 */
export async function readDigest(
  client: Client,
  context: PageContext,
  now: Date,
): Promise<DigestState> {
  try {
    const [profile, preferences] = await Promise.all([
      client
        .from("profiles")
        .select("morning_digest_time, start_lens")
        .eq("id", context.userId)
        .maybeSingle(),
      client.rpc("get_notification_preferences"),
    ]);
    if (profile.error || preferences.error) return { kind: "error" };

    const morningTime = (
      profile.data?.morning_digest_time ?? DEFAULT_MORNING_TIME
    ).slice(0, 5);
    const lens = profile.data?.start_lens ?? "io";
    const switchedOn = preferences.data?.[0]?.morning_digest ?? true;
    if (
      !switchedOn ||
      context.meId === null ||
      toTimeFieldValue(now) < morningTime
    ) {
      return { kind: "none" };
    }

    const period = digestPeriod(toDayKey(now));
    const [events, todos] = await Promise.all([
      listHouseholdEvents(period.from, period.to, client),
      client
        .from("todos")
        .select("title")
        .eq("assignee_member_id", context.meId)
        .is("done_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);
    if (!events.ok || todos.error || !todos.data) return { kind: "error" };

    return {
      kind: "ready",
      view: buildDigest({
        now,
        morningTime,
        lens,
        meId: context.meId,
        members: context.members,
        events: events.events,
        todos: todos.data,
      }),
    };
  } catch {
    return { kind: "error" };
  }
}

export type CompleteResult =
  | "done"
  /** Somebody else did it after the page opened: nothing was written */
  | "already"
  /** Deleted after the page opened */
  | "gone"
  | Failure;

/**
 * «Fatto»: marks a thing to do as done with the time of the tap, only if it
 * is still to do (the database keeps the first time and author anyway). No
 * `.select()` after the write: when nothing changed, it reads the thing
 * apart to tell «already done» from «gone».
 */
export async function completeTodo(
  client: Client,
  todoId: string,
): Promise<CompleteResult> {
  try {
    const { error, count, status } = await client
      .from("todos")
      .update({ done_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", todoId)
      .is("done_at", null);
    if (error) return failureOf(status);
    if ((count ?? 0) > 0) return "done";
    const {
      data,
      error: readError,
      status: readStatus,
    } = await client
      .from("todos")
      .select("done_at")
      .eq("id", todoId)
      .maybeSingle();
    if (readError) return failureOf(readStatus);
    if (!data) return "gone";
    return data.done_at ? "already" : "server";
  } catch {
    return "network";
  }
}

/** «Annulla»: puts the thing back to do. Null = done, else why it failed. */
export async function reopenTodo(
  client: Client,
  todoId: string,
): Promise<Failure | null> {
  try {
    const { error, status } = await client
      .from("todos")
      .update({ done_at: null })
      .eq("id", todoId);
    return error ? failureOf(status) : null;
  } catch {
    return "network";
  }
}

/** The database accepts at most this many ids in one call. */
const MARK_READ_MAX = 200;

/**
 * «Segna tutte come lette»: marks these notifications read (only ids travel;
 * the database marks only the reader's own). Null = done, else why it failed.
 * The same call as `markNotificationsRead` in `src/lib/notifications.ts`, but
 * it tells network from server by the status of the answer.
 */
export async function markAllRead(
  client: Client,
  ids: readonly string[],
): Promise<Failure | null> {
  try {
    for (let start = 0; start < ids.length; start += MARK_READ_MAX) {
      const { error, status } = await client.rpc("mark_notifications_read", {
        p_ids: ids.slice(start, start + MARK_READ_MAX),
      });
      if (error) return failureOf(status);
    }
    return null;
  } catch {
    return "network";
  }
}
