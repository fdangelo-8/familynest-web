import { nameKey } from "../casa-spesa/model";
import type { EventVisibility } from "../../lib/calendar";
import type { createClient } from "../../lib/supabase/client";
import { failureReason, type FailureReason } from "../evento-modulo/failure";
import type { NewEventRepetition } from "../evento-modulo/model";
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

/* ---------- Impegno ---------- */

export type NewEventInput = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  visibility: EventVisibility;
  memberIds: string[];
  /** Left out when empty */
  place?: string;
  escortId?: string | null;
  repetition?: NewEventRepetition;
  /** Left out when empty */
  notes?: string;
};

export type CreateEventResult =
  { status: "ok"; id: string } | { status: "failed"; reason: FailureReason };

/**
 * The one call that saves a new event: from the phrase and from the full form
 * «Nuovo impegno». The app never sends the id, the author or the Nest.
 */
export async function createEvent(
  supabase: Client,
  input: NewEventInput,
): Promise<CreateEventResult> {
  try {
    const { data, error } = await supabase.rpc("create_event", {
      p_title: input.title,
      p_starts_at: input.startsAt.toISOString(),
      p_ends_at: input.endsAt.toISOString(),
      p_visibility: input.visibility,
      p_member_ids: input.memberIds,
      ...(input.place ? { p_location: input.place } : {}),
      ...(input.escortId ? { p_escort_member_id: input.escortId } : {}),
      ...(input.repetition ?? {}),
      ...(input.notes ? { p_notes: input.notes } : {}),
    });
    if (error) return { status: "failed", reason: failureReason(error) };
    if (typeof data !== "string") return { status: "failed", reason: "failed" };
    return { status: "ok", id: data };
  } catch {
    return { status: "failed", reason: "failed" };
  }
}

/** «Annulla» of a new event: deletes the whole event, with all its times and people. */
export async function deleteNewEvent(
  supabase: Client,
  id: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    return error === null;
  } catch {
    return false;
  }
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

/* ---------- Spesa: edit ---------- */

export type ShoppingValues = {
  name: string;
  /** Null when there is none */
  quantity: string | null;
  /** Who takes care of it, in order */
  assigneeIds: string[];
};

export type ShoppingRecord = ShoppingValues & { id: string };

/**
 * A thing still to buy, by its id (RLS limits the read to the Nest). One taken
 * (or none) is «gone»: the sheet does not edit the taken things.
 */
export async function readShoppingItem(
  supabase: Client,
  id: string,
): Promise<ReadResult<ShoppingRecord>> {
  try {
    const [item, links] = await Promise.all([
      supabase
        .from("shopping_items")
        .select("id, name, quantity, checked_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("shopping_item_assignees")
        .select("member_id, created_at")
        .eq("shopping_item_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (item.error || links.error) return { status: "failed" };
    if (!item.data || item.data.checked_at !== null) return { status: "gone" };
    return {
      status: "found",
      record: {
        id: item.data.id,
        name: item.data.name,
        quantity: item.data.quantity,
        assigneeIds: (links.data ?? []).map((link) => link.member_id),
      },
    };
  } catch {
    return { status: "failed" };
  }
}

export type ShoppingWriteResult =
  "ok" | "gone" | "failed" | { duplicate: string };

/**
 * The name of ANOTHER thing still to buy with the same name (ignoring case),
 * or null. `undefined` when the list could not be read.
 */
export async function findShoppingDuplicate(
  supabase: Client,
  id: string,
  name: string,
): Promise<string | null | undefined> {
  try {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("id, name")
      .is("checked_at", null);
    if (error || !data) return undefined;
    const key = nameKey(name);
    return (
      data.find((row) => row.id !== id && nameKey(row.name) === key)?.name ??
      null
    );
  } catch {
    return undefined;
  }
}

/** Name, quantity and people in one call (all or nothing). */
export async function updateShoppingItem(
  supabase: Client,
  id: string,
  values: ShoppingValues,
): Promise<ShoppingWriteResult> {
  try {
    const { error } = await supabase.rpc("update_shopping_item", {
      p_item_id: id,
      p_name: values.name,
      p_quantity: values.quantity ?? "",
      p_assignee_member_ids: values.assigneeIds,
    });
    if (!error) return "ok";
    if (error.code === "P0002") return "gone";
    if (error.code === "23505") {
      const other = await findShoppingDuplicate(supabase, id, values.name);
      return { duplicate: other ?? values.name };
    }
    return "failed";
  } catch {
    return "failed";
  }
}

/** A thing already gone counts as removed. */
export async function deleteShoppingItem(
  supabase: Client,
  id: string,
): Promise<"ok" | "failed"> {
  try {
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", id);
    return error ? "failed" : "ok";
  } catch {
    return "failed";
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
