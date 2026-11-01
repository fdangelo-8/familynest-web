import { nameKey } from "../casa-spesa/model";
import type { createClient } from "../../lib/supabase/client";
import type { ShoppingEntry } from "./parse-list";

/**
 * What the Add sheet writes and reads for Spesa, Da fare and Scadenza (issue
 * #22), with the session of the signed-in user: the database decides who may do
 * what. Only the fact of a failure is kept: the error object can carry the
 * whole row (the free title), so it is never read, shown or logged.
 */

type Client = ReturnType<typeof createClient>;

export type TodoValues = {
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  forId: string | null;
  isPrivate: boolean;
};

export type DeadlineValues = {
  title: string;
  dueDate: string;
  assigneeId: string | null;
  forId: string | null;
  isPrivate: boolean;
  /** Days before: 30, 7, 1 and 0 (the day itself) */
  reminders: number[];
};

export type TodoRecord = TodoValues & {
  id: string;
  createdById: string | null;
};
export type DeadlineRecord = DeadlineValues & {
  id: string;
  createdById: string | null;
};

export type ReadResult<T> =
  { status: "found"; record: T } | { status: "gone" } | { status: "failed" };

export type WriteResult = "ok" | "gone" | "failed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only an id that looks like one is asked to the database. */
export function looksLikeId(value: string): boolean {
  return UUID.test(value);
}

/* ---------- Spesa ---------- */

export type ToTake = { ids: Set<string>; keys: Set<string> };

/** The things still to take, to tell which ones are already in the list. */
export async function readToTake(supabase: Client): Promise<ToTake | null> {
  try {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("id, name")
      .is("checked_at", null);
    if (error || !data) return null;
    return {
      ids: new Set(data.map((row) => row.id)),
      keys: new Set(data.map((row) => nameKey(row.name))),
    };
  } catch {
    return null;
  }
}

export type ShoppingSave =
  { status: "ok"; saved: number; ids: string[] } | { status: "failed" };

/**
 * One insert per thing, in the order of the phrase (they all get their own
 * time, so the list keeps that order). A thing that someone else added in the
 * meantime (`23505`) is skipped. The ids of the new rows are read back with a
 * separate query (no `select` after a write): the only thing still to take with
 * a name just saved is the new row, because two of them cannot coexist.
 */
export async function saveShopping(
  supabase: Client,
  entries: readonly ShoppingEntry[],
): Promise<ShoppingSave> {
  const savedKeys = new Set<string>();
  try {
    for (const entry of entries) {
      const { error } = await supabase.from("shopping_items").insert({
        name: entry.name,
        ...(entry.quantity ? { quantity: entry.quantity } : {}),
      });
      if (!error) {
        savedKeys.add(nameKey(entry.name));
      } else if (error.code !== "23505") {
        return { status: "failed" };
      }
    }
  } catch {
    return { status: "failed" };
  }
  let ids: string[] = [];
  if (savedKeys.size > 0) {
    const after = await readNewItems(supabase, savedKeys);
    ids = after ?? [];
  }
  return { status: "ok", saved: savedKeys.size, ids };
}

async function readNewItems(
  supabase: Client,
  savedKeys: ReadonlySet<string>,
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("id, name")
      .is("checked_at", null);
    if (error || !data) return null;
    return data
      .filter((row) => savedKeys.has(nameKey(row.name)))
      .map((row) => row.id);
  } catch {
    return null;
  }
}

/** Takes away the things just added, if they are still to take. */
export async function undoShopping(
  supabase: Client,
  ids: readonly string[],
): Promise<boolean> {
  if (ids.length === 0) return false;
  try {
    const { error } = await supabase.rpc("undo_added_shopping_items", {
      item_ids: [...ids],
    });
    return !error;
  } catch {
    return false;
  }
}

/* ---------- Da fare ---------- */

const TODO_COLUMNS =
  "id, title, assignee_member_id, for_member_id, due_date, is_private, created_by_member_id";
const DEADLINE_COLUMNS = `${TODO_COLUMNS}, reminder_days`;

export type Created =
  { status: "ok"; findId: () => Promise<string | null> } | { status: "failed" };

export async function createTodo(
  supabase: Client,
  values: TodoValues,
  meId: string | null,
): Promise<Created> {
  try {
    const { error } = await supabase.from("todos").insert({
      title: values.title,
      assignee_member_id: values.assigneeId,
      for_member_id: values.forId,
      due_date: values.dueDate,
      is_private: values.isPrivate,
    });
    if (error) return { status: "failed" };
  } catch {
    return { status: "failed" };
  }
  // The id is the database's: read it back (no select after a write).
  const lookup = findNewestId(supabase, "todos", values.title, meId);
  return { status: "ok", findId: () => lookup };
}

export async function createDeadline(
  supabase: Client,
  values: DeadlineValues,
  meId: string | null,
): Promise<Created> {
  try {
    const { error } = await supabase.from("deadlines").insert({
      title: values.title,
      due_date: values.dueDate,
      assignee_member_id: values.assigneeId,
      for_member_id: values.forId,
      is_private: values.isPrivate,
      reminder_days: values.reminders,
    });
    if (error) return { status: "failed" };
  } catch {
    return { status: "failed" };
  }
  const lookup = findNewestId(supabase, "deadlines", values.title, meId);
  return { status: "ok", findId: () => lookup };
}

/**
 * The newest row of the author with this title: the one just created. The
 * query never carries the title (it would end up in addresses and logs): it
 * asks for the author's latest rows and compares the title here. Without the
 * author there is no «Annulla», so it can never touch someone else's thing.
 */
async function findNewestId(
  supabase: Client,
  table: "todos" | "deadlines",
  title: string,
  meId: string | null,
): Promise<string | null> {
  if (!meId) return null;
  try {
    const { data, error } = await supabase
      .from(table)
      .select("id, title")
      .eq("created_by_member_id", meId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data) return null;
    return data.find((row) => row.title === title)?.id ?? null;
  } catch {
    return null;
  }
}

export async function readTodo(
  supabase: Client,
  id: string,
): Promise<ReadResult<TodoRecord>> {
  try {
    const { data, error } = await supabase
      .from("todos")
      .select(TODO_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) return { status: "failed" };
    if (!data) return { status: "gone" };
    return {
      status: "found",
      record: {
        id: data.id,
        title: data.title,
        dueDate: data.due_date,
        assigneeId: data.assignee_member_id,
        forId: data.for_member_id,
        isPrivate: data.is_private,
        createdById: data.created_by_member_id,
      },
    };
  } catch {
    return { status: "failed" };
  }
}

export async function readDeadline(
  supabase: Client,
  id: string,
): Promise<ReadResult<DeadlineRecord>> {
  try {
    const { data, error } = await supabase
      .from("deadlines")
      .select(DEADLINE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) return { status: "failed" };
    if (!data) return { status: "gone" };
    return {
      status: "found",
      record: {
        id: data.id,
        title: data.title,
        dueDate: data.due_date,
        assigneeId: data.assignee_member_id,
        forId: data.for_member_id,
        isPrivate: data.is_private,
        createdById: data.created_by_member_id,
        reminders: data.reminder_days,
      },
    };
  } catch {
    return { status: "failed" };
  }
}

/** Is the row still there for this user? A separate read, never `select` after the write. */
async function stillThere(
  supabase: Client,
  table: "todos" | "deadlines",
  id: string,
): Promise<WriteResult> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) return "failed";
  return data ? "ok" : "gone";
}

export async function updateTodo(
  supabase: Client,
  id: string,
  values: TodoValues,
): Promise<WriteResult> {
  try {
    const { error } = await supabase
      .from("todos")
      .update({
        title: values.title,
        assignee_member_id: values.assigneeId,
        for_member_id: values.forId,
        due_date: values.dueDate,
        is_private: values.isPrivate,
      })
      .eq("id", id);
    if (error) return "failed";
    return await stillThere(supabase, "todos", id);
  } catch {
    return "failed";
  }
}

export async function updateDeadline(
  supabase: Client,
  id: string,
  values: DeadlineValues,
): Promise<WriteResult> {
  try {
    const { error } = await supabase
      .from("deadlines")
      .update({
        title: values.title,
        due_date: values.dueDate,
        assignee_member_id: values.assigneeId,
        for_member_id: values.forId,
        is_private: values.isPrivate,
        reminder_days: values.reminders,
      })
      .eq("id", id);
    if (error) return "failed";
    return await stillThere(supabase, "deadlines", id);
  } catch {
    return "failed";
  }
}

/** A thing already gone counts as removed. */
export async function deleteTodo(
  supabase: Client,
  id: string,
): Promise<"ok" | "failed"> {
  try {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    return error ? "failed" : "ok";
  } catch {
    return "failed";
  }
}

export async function deleteDeadline(
  supabase: Client,
  id: string,
): Promise<"ok" | "failed"> {
  try {
    const { error } = await supabase.from("deadlines").delete().eq("id", id);
    return error ? "failed" : "ok";
  } catch {
    return "failed";
  }
}
