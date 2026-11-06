import type { SupabaseClient } from "@supabase/supabase-js";
import {
  keyEvents,
  type KeyedEvent,
  type Member,
} from "@/components/calendario/model";
import type { Todo } from "@/components/casa-da-fare/model";
import { addDaysToDayKey, startOfDay } from "@/lib/datetime";
import { listHouseholdEvents } from "@/lib/household-events";
import { getPinnedSpaces } from "@/lib/pinned-spaces";
import type { SpaceKey } from "@/lib/spaces";
import { readMemberWelcome, type MemberWelcome } from "@/lib/welcome";
import type { Database } from "@/types/database";

/**
 * Everything Oggi (#30) reads in the browser, with the signed-in session (RLS
 * applies: the «Solo io» of the others never arrive). Every read is a part
 * that can fail on its own: a failed part is `null`, nothing throws, and no
 * error text or detail is ever kept (it could carry titles or names).
 */

export type Client = SupabaseClient<Database>;

/** Days read at once: today plus 7 (tomorrow, the week, the summary). */
export const READ_DAYS = 8;

export type People = {
  /** In the order of the Nest */
  members: Member[];
  meId: string;
  isAdmin: boolean;
  householdId: string;
};

/** A thing to do, plus who wrote it (the «Solo io» of mine). */
export type OpenTodo = Todo & { createdById: string | null };

export type ShoppingEntry = { id: string; name: string };

export type DeadlineEntry = {
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  dueDate: string;
  isPrivate: boolean;
  createdAt: string;
};

export type House = {
  /** Things still to buy, in the order they were added */
  shopping: ShoppingEntry[];
  /** From today on (the gone ones stay in Casa · Scadenze) */
  deadlines: DeadlineEntry[];
};

export type Household = {
  firstShoppingAt: string | null;
  starterCompletedAt: string | null;
  /** The person has linked at least one calendar account (#34) */
  hasLinkedCalendar: boolean;
};

export type InviteEntry = {
  memberId: string;
  status: "pending" | "accepted";
  expiresAt: string;
};

export type OggiRead = {
  people: People | null;
  events: KeyedEvent[] | null;
  todos: OpenTodo[] | null;
  house: House | null;
  household: Household | null;
  invites: InviteEntry[] | null;
  pinned: SpaceKey[] | null;
  /** Only on the first reading */
  welcome: MemberWelcome | null;
};

async function readPeople(client: Client): Promise<People | null> {
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  const [members, me, household] = await Promise.all([
    client
      .from("household_members")
      .select("id, name, color, kind")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    client
      .from("household_members")
      .select("id, is_admin")
      .eq("user_id", userId)
      .maybeSingle(),
    client.rpc("current_household_id"),
  ]);
  if (
    members.error ||
    me.error ||
    household.error ||
    !members.data ||
    !me.data ||
    !household.data
  ) {
    return null;
  }
  return {
    members: members.data,
    meId: me.data.id,
    isAdmin: me.data.is_admin,
    householdId: household.data,
  };
}

async function readEvents(
  client: Client,
  todayKey: string,
): Promise<KeyedEvent[] | null> {
  const result = await listHouseholdEvents(
    startOfDay(todayKey),
    startOfDay(addDaysToDayKey(todayKey, READ_DAYS)),
    client,
  );
  return result.ok ? keyEvents(result.events) : null;
}

async function readTodos(client: Client): Promise<OpenTodo[] | null> {
  const { data, error } = await client
    .from("todos")
    .select(
      "id, title, assignee_member_id, for_member_id, due_date, is_private, done_at, done_by_member_id, created_by_member_id, created_at",
    )
    .is("done_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error || !data) return null;
  return data.map((row) => ({
    key: row.id,
    id: row.id,
    title: row.title,
    assigneeId: row.assignee_member_id,
    forId: row.for_member_id,
    dueDate: row.due_date,
    isPrivate: row.is_private,
    doneAt: row.done_at,
    doneSortAt: row.done_at,
    doneById: row.done_by_member_id,
    createdAt: row.created_at,
    createdById: row.created_by_member_id,
  }));
}

export async function readHouse(
  client: Client,
  todayKey: string,
): Promise<House | null> {
  const [shopping, deadlines] = await Promise.all([
    client
      .from("shopping_items")
      .select("id, name")
      .is("checked_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    client
      .from("deadlines")
      .select("id, title, due_date, is_private, created_at")
      .gte("due_date", todayKey)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (shopping.error || deadlines.error || !shopping.data || !deadlines.data) {
    return null;
  }
  return {
    shopping: shopping.data,
    deadlines: deadlines.data.map((row) => ({
      id: row.id,
      title: row.title,
      dueDate: row.due_date,
      isPrivate: row.is_private,
      createdAt: row.created_at,
    })),
  };
}

async function readHousehold(client: Client): Promise<Household | null> {
  const [household, accounts] = await Promise.all([
    client
      .from("households")
      .select("first_shopping_item_at, starter_list_completed_at")
      .maybeSingle(),
    // The policies give back only the person's own accounts; nothing but
    // whether there is one leaves this function.
    client.from("calendar_accounts").select("id").limit(1),
  ]);
  if (household.error || !household.data || accounts.error) return null;
  return {
    firstShoppingAt: household.data.first_shopping_item_at,
    starterCompletedAt: household.data.starter_list_completed_at,
    hasLinkedCalendar: accounts.data.length > 0,
  };
}

async function readInvites(client: Client): Promise<InviteEntry[] | null> {
  // Only the administrators can read invitations: for the others it is empty.
  const { data, error } = await client
    .from("invitations")
    .select("member_id, status, expires_at")
    .in("status", ["pending", "accepted"]);
  if (error || !data) return null;
  return data.flatMap((row) =>
    row.status === "pending" || row.status === "accepted"
      ? [
          {
            memberId: row.member_id,
            status: row.status,
            expiresAt: row.expires_at,
          },
        ]
      : [],
  );
}

async function readPinned(client: Client): Promise<SpaceKey[] | null> {
  const result = await getPinnedSpaces(client);
  return result.error ? null : result.spaces;
}

async function safely<T>(read: () => Promise<T | null>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** Reads all the parts at once. `first` also reads the welcome. */
export async function readOggi(
  client: Client,
  todayKey: string,
  first: boolean,
): Promise<OggiRead> {
  const [people, events, todos, house, household, invites, pinned, welcome] =
    await Promise.all([
      safely(() => readPeople(client)),
      safely(() => readEvents(client, todayKey)),
      safely(() => readTodos(client)),
      safely(() => readHouse(client, todayKey)),
      safely(() => readHousehold(client)),
      safely(() => readInvites(client)),
      safely(() => readPinned(client)),
      first ? readMemberWelcome(client) : Promise.resolve(null),
    ]);
  return { people, events, todos, house, household, invites, pinned, welcome };
}
