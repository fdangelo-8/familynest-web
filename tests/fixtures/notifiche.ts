import {
  test as base,
  type Browser,
  type Locator,
  type Page,
  type Route,
  type ViewportSize,
} from "@playwright/test";
import {
  addDays,
  buildNest,
  busy,
  CORS,
  D_ANGELO,
  expect,
  isMobileProject,
  lastTuesday,
  pauseClock,
  setClock,
  type CasaNest,
  type Day,
  type MemberSpec,
} from "./casa";
import { createEvent, instant, type EventSpec } from "./impegni";
import { setPreferences, type StartLens } from "./preferenze";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "./throwaway-user";

// Helpers of the tests of Notifiche (#39). Every test builds its own
// throwaway Nests (users created with the administrative key, removed at the
// end of the test), so desktop and mobile never meet on the same rows. The
// notifications are born the way the app makes them: triggers (a thing to do
// assigned, a time changed, with the session of the author) and the test
// function of the database `run_notification_job` (deadlines, «Liberi
// insieme», shopping), with the administrative key. Their `created_at` is then
// moved to the day and hour the criterion talks about (the tests stop the
// clock of the browser on «T», the most recent Tuesday). Credentials and keys
// come only from environment variables.

export { expect, isMobileProject };
export type { CasaNest, Day };

export const PATH = "/notifiche";

/** «Martedì 20 ottobre 2026» of the criteria: the most recent Tuesday. */
export const T: Day = lastTuesday();
/** The day `n` days after T (negative = before). */
export const day = (n: number): Day => addDays(T, n);
/** The instant of a wall-clock time (Rome) on the day `n` days after T. */
export const at = (n: number, time: string): Date => instant(day(n), time);

// ------------------------------------------------------------------- Nests

/** Casa Bianchi of the criteria: Giulia and Paolo (accounts) and the child Leo. */
export const NEST_MEMBERS: MemberSpec[] = [
  { name: "Giulia", kind: "adult", color: "pomodoro", account: true },
  { name: "Paolo", kind: "adult", color: "glicine", account: true },
  { name: "Leo", kind: "child", color: "salvia" },
];

/** A Nest «Solo io»: one adult only. */
export const SOLO_MEMBERS: MemberSpec[] = [
  { name: "Rita", kind: "adult", color: "pomodoro", account: true },
];

type Fixtures = {
  /** N: Casa Bianchi (Giulia, Paolo, Leo) */
  nest: CasaNest;
  /** U: a Nest with one adult, Rita */
  solo: CasaNest;
  /** Casa D'Angelo (Marco with an account, Laura, Sofia, Tommaso, Biscotto) */
  dangelo: CasaNest;
};

async function provideNest(
  name: string,
  specs: MemberSpec[],
  provide: (nest: CasaNest) => Promise<void>,
): Promise<void> {
  base.skip(!throwawayConfigured(), throwawaySkipReason);
  const { nest, cleanup } = await buildNest(name, specs);
  try {
    await provide(nest);
  } finally {
    await cleanup();
  }
}

/** `test` with the throwaway Nests; skipped when the keys are not set. */
export const test = base.extend<Fixtures>({
  nest: async ({}, provide) => {
    await provideNest("Casa Bianchi", NEST_MEMBERS, provide);
  },
  solo: async ({}, provide) => {
    await provideNest("Casa Rossi", SOLO_MEMBERS, provide);
  },
  dangelo: async ({}, provide) => {
    await provideNest("Casa D'Angelo", D_ANGELO, provide);
  },
});

export function memberId(nest: CasaNest, name: string): string {
  const id = nest.members[name];
  if (!id) throw new Error(`Membro di prova sconosciuto: ${name}`);
  return id;
}

export function userOf(nest: CasaNest, name: string): ThrowawayUser {
  const user = nest.users[name];
  if (!user) throw new Error(`${name} non ha un account di prova`);
  return user;
}

/** Administrative client (bypasses RLS): only to prepare and to read back. */
function adminOf(nest: CasaNest) {
  const user = Object.values(nest.users)[0];
  if (!user) throw new Error("Nest di prova senza utenti");
  return user.admin;
}

/** A member leaves the Nest (administrative key); the account stays. */
export async function removeMember(
  nest: CasaNest,
  name: string,
): Promise<void> {
  const { error } = await adminOf(nest)
    .from("household_members")
    .delete()
    .eq("id", memberId(nest, name));
  if (error) throw new Error("Membro di prova non tolto");
}

// ------------------------------------------------- preferences and profile

export type Preference =
  "events" | "assigned_todos" | "shopping" | "free_together" | "morning_digest";

/** `set_notification_preference` with the session of `who`. */
export async function setPreference(
  nest: CasaNest,
  who: string,
  preference: Preference,
  enabled: boolean,
): Promise<void> {
  const { error } = await userOf(nest, who).client.rpc(
    "set_notification_preference",
    { p_preference: preference, p_enabled: enabled },
  );
  if (error) throw new Error("Interruttore di prova non scritto");
}

/** The time of the morning summary in the profile (`06:00` ... `10:00`). */
export async function setMorningTime(
  nest: CasaNest,
  who: string,
  time: string,
): Promise<void> {
  const user = userOf(nest, who);
  const { error } = await user.client
    .from("profiles")
    .update({ morning_digest_time: time })
    .eq("id", user.id);
  if (error) throw new Error("Ora della sintesi di prova non scritta");
}

export async function setLens(
  nest: CasaNest,
  who: string,
  lens: StartLens,
): Promise<void> {
  await setPreferences(userOf(nest, who), { start_lens: lens });
}

// ------------------------------------------------------------ notification rows

export type NotificationRow = {
  id: string;
  household_id: string;
  recipient_member_id: string;
  kind: string;
  actor_member_id: string | null;
  todo_id: string | null;
  deadline_id: string | null;
  event_id: string | null;
  occurrence_date: string | null;
  days_before: number | null;
  evening_date: string | null;
  free_from: string | null;
  item_count: number | null;
  read_at: string | null;
  created_at: string;
};

/** The rows of `notifications` of the Nest (or of one recipient), read with the administrative key. */
export async function notificationRows(
  nest: CasaNest,
  recipient?: string,
): Promise<NotificationRow[]> {
  let query = adminOf(nest)
    .from("notifications")
    .select("*")
    .eq("household_id", nest.householdId);
  if (recipient) {
    query = query.eq("recipient_member_id", memberId(nest, recipient));
  }
  const { data, error } = await query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error("Lettura delle notifiche di prova fallita");
  return (data ?? []) as NotificationRow[];
}

export async function unreadCount(
  nest: CasaNest,
  recipient: string,
): Promise<number> {
  const rows = await notificationRows(nest, recipient);
  return rows.filter((row) => row.read_at === null).length;
}

type NotificationFilter = Partial<
  Record<"todo_id" | "event_id" | "kind" | "recipient_member_id", string>
>;

/**
 * Moves notifications to the instant the criterion talks about (and, if
 * asked, marks them read at that instant). Only the administrative key can
 * write the table.
 */
export async function stamp(
  nest: CasaNest,
  filter: NotificationFilter,
  values: { createdAt: Date; readAt?: Date },
): Promise<void> {
  const changes: Record<string, string> = {
    created_at: values.createdAt.toISOString(),
  };
  if (values.readAt) changes.read_at = values.readAt.toISOString();
  let query = adminOf(nest)
    .from("notifications")
    .update(changes)
    .eq("household_id", nest.householdId);
  for (const [column, value] of Object.entries(filter)) {
    query = query.eq(column, value);
  }
  const { error } = await query;
  if (error) throw new Error("Notifica di prova non spostata");
}

/** Inserts a notification directly (administrative key), the way the database would. */
export async function insertNotification(
  nest: CasaNest,
  row: {
    recipient: string;
    kind: "todo_assigned";
    actorId: string;
    todoId: string;
    createdAt?: Date;
  },
): Promise<string> {
  const { data, error } = await adminOf(nest)
    .from("notifications")
    .insert({
      household_id: nest.householdId,
      recipient_member_id: memberId(nest, row.recipient),
      kind: row.kind,
      actor_member_id: row.actorId,
      todo_id: row.todoId,
      created_at: (row.createdAt ?? new Date()).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Notifica di prova non inserita");
  return data.id as string;
}

/**
 * `who` assigns a thing to do to `to` (the trigger writes the notification
 * with the session of `who`), and the notification is moved to `when`.
 * Returns the id of the thing to do.
 */
export async function assign(
  nest: CasaNest,
  title: string,
  options: {
    by?: string;
    to?: string;
    due?: Day;
    when: Date;
    readAt?: Date;
  },
): Promise<string> {
  const by = options.by ?? "Paolo";
  const to = options.to ?? "Giulia";
  const todoId = await nest.todo(by, {
    title,
    assignee: to,
    due: options.due,
  });
  await stamp(
    nest,
    { todo_id: todoId, recipient_member_id: memberId(nest, to) },
    { createdAt: options.when, readAt: options.readAt },
  );
  return todoId;
}

export type Job =
  "free_together" | "deadline_reminders" | "shopping_digest" | "purge";

/**
 * The test function of the database: runs one job of the Nest at an instant.
 * Returns how many notifications it created (or deleted, for `purge`).
 */
export async function runJob(
  nest: CasaNest,
  job: Job,
  when: Date,
): Promise<number> {
  const { data, error } = await adminOf(nest).rpc("run_notification_job", {
    p_job: job,
    p_household_id: nest.householdId,
    p_at: when.toISOString(),
  });
  if (error) {
    throw new Error(
      `Lavoro di prova non eseguito (${error.code ?? "?"}: ${error.message})`,
    );
  }
  return Number(data);
}

// ------------------------------------------------------------------ events

/**
 * Changes the start and the end of a whole event or series with the session of
 * `who` (what «Salva tutti» does): `update_event` wants the complete form, so
 * it is sent again from the spec the event was created with.
 */
export async function retime(
  nest: CasaNest,
  who: string,
  id: string,
  spec: EventSpec,
  to: { from: string; to: string; day?: Day },
): Promise<void> {
  const target = to.day ?? spec.day;
  const { error } = await userOf(nest, who).client.rpc("update_event", {
    p_event_id: id,
    p_day: null,
    p_title: spec.title,
    p_starts_at: instant(target, to.from).toISOString(),
    p_ends_at: instant(target, to.to).toISOString(),
    p_visibility: spec.visibility ?? "household",
    p_member_ids: spec.members.map((name) => memberId(nest, name)),
    p_location: spec.place ?? null,
    p_escort_member_id: spec.escort ? memberId(nest, spec.escort) : null,
    p_recurrence: spec.repeat?.kind ?? "none",
    p_recurrence_weekdays:
      spec.repeat?.kind === "weekly" ? spec.repeat.weekdays : null,
    p_recurrence_until: spec.until ?? null,
    p_notes: spec.notes ?? null,
  });
  if (error) {
    throw new Error(`Orario di prova non cambiato (${error.code ?? "?"})`);
  }
}

/**
 * The scene of «Liberi insieme»: Giulia and Paolo are both busy on the
 * evenings of T+1 and T+2 (from 18:00 to 23:00), so the first free evening
 * for both is T+3 (Friday). The job of 8:00 of T runs. Returns how many
 * notifications it created (one for Giulia, one for Paolo).
 */
export async function freeFridayScene(nest: CasaNest): Promise<number> {
  for (const n of [1, 2]) {
    await createEvent(nest, "Paolo", {
      title: `Cena in due ${n}`,
      day: day(n),
      from: "18:00",
      to: "23:00",
      members: ["Giulia", "Paolo"],
    });
  }
  return runJob(nest, "free_together", at(0, "08:00"));
}

// ------------------------------------------------------------------- page

/** The page is up: the skeletons are gone (the container with `aria-busy`). */
export async function loaded(page: Page): Promise<void> {
  await expect(busy(page)).toHaveCount(0, { timeout: 20_000 });
  // Never the first `main` alone: two can coexist for an instant (LEZIONI).
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

/**
 * Signs in as `who`, sets the clock of the browser at `time` (12:00 of T by
 * default), opens the page and, by default, stops the clock once it is up (so
 * toasts and timers move only with `page.clock.runFor`).
 */
export async function open(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  options: { time?: Date; pause?: boolean; path?: string } = {},
): Promise<void> {
  const { time = at(0, "12:00"), pause = true, path = PATH } = options;
  await setClock(page, time);
  await nest.signIn(page, baseURL, who);
  await page.goto(path);
  await loaded(page);
  if (pause) await pauseClock(page);
}

/** Opens the page again; with a stopped clock, lets it run for the load and stops it again. */
export async function reload(
  page: Page,
  options: { paused?: boolean } = {},
): Promise<void> {
  if (options.paused) await page.clock.resume();
  await page.reload();
  await loaded(page);
  if (options.paused) await pauseClock(page);
}

/**
 * Runs `run` on a page of a new browser context (own clock and own session),
 * for the criteria that open the page at two different times.
 */
export async function withPageAt<R>(
  browser: Browser,
  viewport: ViewportSize | null,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  time: Date,
  run: (page: Page) => Promise<R>,
): Promise<R> {
  const context = await browser.newContext({
    baseURL,
    viewport: viewport ?? undefined,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  try {
    const page = await context.newPage();
    await open(page, baseURL, nest, who, { time, pause: false });
    return await run(page);
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------- locators

export const rows = (page: Page): Locator => page.locator("li.riga-notifica");
export const newRows = (page: Page): Locator =>
  page.locator("li.riga-notifica.is-nuova");
/** The row whose text contains `text`. */
export const rowOf = (page: Page, text: string | RegExp): Locator =>
  rows(page).filter({ hasText: text });
/** The text of a row (`p.riga-notifica__testo`). */
export const textOf = (row: Locator): Locator =>
  row.locator("p.riga-notifica__testo");
export const timeOf = (row: Locator): Locator =>
  row.locator(".riga-notifica__ora");
export const sectionTitles = (page: Page): Locator =>
  page.locator("h2.sezione__titolo");
export const sectionNews = (page: Page): Locator =>
  page.locator(".sezione__info");
/** The summary of the morning: a region called «Il tuo martedì». */
export const digest = (page: Page, name: string): Locator =>
  page.getByRole("region", { name, exact: true });
export const sentence = (page: Page): Locator =>
  page.locator("p.sintesi__frase");
export const markAllButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Segna tutte come lette", exact: true });
/** The bell: «Notifiche» or «Notifiche, 3 nuove». */
export const bell = (page: Page): Locator =>
  page.getByRole("link", { name: /^Notifiche(, \d+ nuov[ae])?$/ });
export const toast = (page: Page): Locator => page.getByTestId("toast");
/** An alert with this text (Next keeps an empty one for the route announcer). */
export const alertWith = (page: Page, text: string | RegExp): Locator =>
  page.getByRole("alert").filter({ hasText: text });
export const doneButton = (row: Locator): Locator =>
  row.getByRole("button", { name: "Fatto", exact: true });
export const openLink = (row: Locator): Locator =>
  row.getByRole("link", { name: "Apri", exact: true });

// ------------------------------------------------------------------ network

export const REST_NOTIFICATIONS = /\/rest\/v1\/notifications(\?|$)/;
export const REST_TODOS = /\/rest\/v1\/todos(\?|$)/;
export const RPC_MARK_READ = /\/rest\/v1\/rpc\/mark_notifications_read(\?|$)/;
export const RPC_LIST_EVENTS = /\/rest\/v1\/rpc\/list_household_events(\?|$)/;

/**
 * Makes the requests with this method to the matching path fail: `server` is
 * an answer 500 (a database error), `network` a request that gets no answer.
 * Other methods (and the preflight) go on. Returns the function that removes it.
 */
export async function failRequests(
  page: Page,
  url: RegExp,
  method: "GET" | "POST" | "PATCH",
  how: "server" | "network",
): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    if (how === "network") {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom internal detail" }),
    });
  };
  await page.route(url, handler);
  return () => page.unroute(url, handler);
}

/** Holds the requests with this method until `release()`, then lets them go on. */
export async function holdRequests(
  page: Page,
  url: RegExp,
  method: "GET" | "POST" | "PATCH",
): Promise<() => void> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    await gate;
    try {
      await route.continue();
    } catch {
      // The page is gone: nothing left to answer.
    }
  });
  return release;
}

/** Counts, from now on, the requests with this method to the matching path. */
export function countRequests(
  page: Page,
  url: RegExp,
  method: "GET" | "POST" | "PATCH",
): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.method() === method && url.test(request.url())) count += 1;
  });
  return () => count;
}

/** The text of the whole page (to prove a title or a name is not there). */
export async function pageText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

/**
 * A round trip to the page: the events of the requests made so far have
 * reached the test (used before counting that a request was NOT made).
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => Promise.resolve());
}
