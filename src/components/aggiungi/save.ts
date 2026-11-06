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
  /** Who takes care of it, in order; empty = nobody */
  assigneeIds: string[];
  forId: string | null;
  isPrivate: boolean;
};

export type DeadlineValues = {
  title: string;
  dueDate: string;
  assigneeIds: string[];
  forId: string | null;
  isPrivate: boolean;
  /** Days before: 30, 7, 1 and 0 (the day itself) */
  reminders: number[];
  /**
   * The note of the row. The sheet neither shows nor changes it: it is read
   * and sent back so that a save does not erase it (`update_deadline` writes
   * every column).
   */
  note: string | null;
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
 * All the things of the phrase in one call (`add_shopping_items`), in the
 * order of the phrase, with the same people for every one. A thing that
 * someone else added in the meantime is skipped by the database; the ids of
 * the things saved come back, for «Annulla».
 */
export async function saveShopping(
  supabase: Client,
  entries: readonly ShoppingEntry[],
  assigneeIds: readonly string[],
): Promise<ShoppingSave> {
  try {
    const { data, error } = await supabase.rpc("add_shopping_items", {
      p_items: entries.map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
      })),
      p_assignee_member_ids: [...assigneeIds],
    });
    if (error || !Array.isArray(data)) return { status: "failed" };
    return { status: "ok", saved: data.length, ids: data };
  } catch {
    return { status: "failed" };
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
  "id, title, for_member_id, due_date, is_private, created_by_member_id";
const DEADLINE_COLUMNS = `${TODO_COLUMNS}, reminder_days, note`;

export type Created = { status: "ok"; id: string } | { status: "failed" };

/**
 * A new thing to do with its people, in one call (`create_todo`): the id, the
 * author and the Nest are the database's. The id comes back for «Annulla».
 */
export async function createTodo(
  supabase: Client,
  values: TodoValues,
): Promise<Created> {
  try {
    const { data, error } = await supabase.rpc("create_todo", {
      p_title: values.title,
      p_assignee_member_ids: values.assigneeIds,
      ...(values.forId ? { p_for_member_id: values.forId } : {}),
      ...(values.dueDate ? { p_due_date: values.dueDate } : {}),
      p_is_private: values.isPrivate,
    });
    if (error || typeof data !== "string") return { status: "failed" };
    return { status: "ok", id: data };
  } catch {
    return { status: "failed" };
  }
}

export async function createDeadline(
  supabase: Client,
  values: DeadlineValues,
): Promise<Created> {
  try {
    const { data, error } = await supabase.rpc("create_deadline", {
      p_title: values.title,
      p_due_date: values.dueDate,
      p_assignee_member_ids: values.assigneeIds,
      ...(values.forId ? { p_for_member_id: values.forId } : {}),
      p_is_private: values.isPrivate,
      p_reminder_days: values.reminders,
    });
    if (error || typeof data !== "string") return { status: "failed" };
    return { status: "ok", id: data };
  } catch {
    return { status: "failed" };
  }
}

/** The people of a thing, in the order they were added. */
async function readAssignees(
  supabase: Client,
  table: "todo_assignees" | "deadline_assignees",
  id: string,
): Promise<string[] | null> {
  const { data, error } =
    table === "todo_assignees"
      ? await supabase
          .from("todo_assignees")
          .select("member_id, created_at")
          .eq("todo_id", id)
          .order("created_at", { ascending: true })
      : await supabase
          .from("deadline_assignees")
          .select("member_id, created_at")
          .eq("deadline_id", id)
          .order("created_at", { ascending: true });
  if (error || !data) return null;
  return data.map((row) => row.member_id);
}

export async function readTodo(
  supabase: Client,
  id: string,
): Promise<ReadResult<TodoRecord>> {
  try {
    const [thing, assignees] = await Promise.all([
      supabase.from("todos").select(TODO_COLUMNS).eq("id", id).maybeSingle(),
      readAssignees(supabase, "todo_assignees", id),
    ]);
    if (thing.error || assignees === null) return { status: "failed" };
    const data = thing.data;
    if (!data) return { status: "gone" };
    return {
      status: "found",
      record: {
        id: data.id,
        title: data.title,
        dueDate: data.due_date,
        assigneeIds: assignees,
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
    const [thing, assignees] = await Promise.all([
      supabase
        .from("deadlines")
        .select(DEADLINE_COLUMNS)
        .eq("id", id)
        .maybeSingle(),
      readAssignees(supabase, "deadline_assignees", id),
    ]);
    if (thing.error || assignees === null) return { status: "failed" };
    const data = thing.data;
    if (!data) return { status: "gone" };
    return {
      status: "found",
      record: {
        id: data.id,
        title: data.title,
        dueDate: data.due_date,
        assigneeIds: assignees,
        forId: data.for_member_id,
        isPrivate: data.is_private,
        createdById: data.created_by_member_id,
        reminders: data.reminder_days,
        note: data.note,
      },
    };
  } catch {
    return { status: "failed" };
  }
}

/**
 * The write goes through `update_todo` / `update_deadline` (thing and people in
 * one transaction). `P0002` is a thing that is not there (any more) for this user.
 */
export async function updateTodo(
  supabase: Client,
  id: string,
  values: TodoValues,
): Promise<WriteResult> {
  try {
    const { error } = await supabase.rpc("update_todo", {
      p_todo_id: id,
      p_title: values.title,
      p_assignee_member_ids: values.assigneeIds,
      // The functions take null as «none»; the generated types do not know it.
      p_for_member_id: values.forId as string,
      p_due_date: values.dueDate as string,
      p_is_private: values.isPrivate,
    });
    if (!error) return "ok";
    return error.code === "P0002" ? "gone" : "failed";
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
    const { error } = await supabase.rpc("update_deadline", {
      p_deadline_id: id,
      p_title: values.title,
      p_due_date: values.dueDate,
      p_assignee_member_ids: values.assigneeIds,
      p_note: values.note as string,
      p_for_member_id: values.forId as string,
      p_is_private: values.isPrivate,
      p_reminder_days: values.reminders,
    });
    if (!error) return "ok";
    return error.code === "P0002" ? "gone" : "failed";
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
