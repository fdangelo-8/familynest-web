import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "./throwaway-user";

// Helpers shared by the tests of Casa · Da fare (#23) and Casa · Scadenze (#24).
// Written before the pages exist: selectors use the roles and texts of the
// requirements (TODO(#23) / TODO(#24) mark what to check against the code).
//
// Data: every test that creates or changes data uses its own throwaway Nest
// (users created with the administrative key, marked as test users, removed at
// the end of the test), so desktop and mobile never meet on the same rows. The
// seed users A, B, B2 and C are only ever read. Credentials and keys come only
// from environment variables.

// --------------------------------------------------------------------- dates

export type Day = string; // YYYY-MM-DD

const ROME = "Europe/Rome";
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
const WEEKDAYS = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];

function romeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function parseDay(day: Day) {
  return {
    year: Number(day.slice(0, 4)),
    month: Number(day.slice(5, 7)),
    day: Number(day.slice(8, 10)),
  };
}

/** The day of an instant in Europe/Rome. */
export function romeDay(date: Date = new Date()): Day {
  const p = romeParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(day: Day, days: number): Day {
  const p = parseDay(day);
  const moved = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return moved.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayIndex(day: Day): number {
  const p = parseDay(day);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** The instant of a wall-clock time in Europe/Rome. */
export function romeInstant(day: Day, hour: number, minute: number): Date {
  const p = parseDay(day);
  const wanted = Date.UTC(p.year, p.month - 1, p.day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const r = romeParts(new Date(guess));
    const shown = Date.UTC(r.year, r.month - 1, r.day, r.hour, r.minute);
    guess += wanted - shown;
  }
  return new Date(guess);
}

/** T of #23: the most recent Tuesday (not in the future) at 15:52 in Rome. */
export function lastTuesday(now: Date = new Date()): Day {
  const today = romeDay(now);
  let back = (weekdayIndex(today) - 2 + 7) % 7;
  if (back === 0 && now < romeInstant(today, 15, 52)) back = 7;
  return addDays(today, -back);
}

export const at1552 = (day: Day) => romeInstant(day, 15, 52);

export const dayNumber = (day: Day) => parseDay(day).day;
export const monthName = (day: Day) => MONTHS[parseDay(day).month - 1]!;
export const weekdayName = (day: Day) => WEEKDAYS[weekdayIndex(day)]!;
export const capitalise = (text: string) =>
  text.charAt(0).toLocaleUpperCase("it-IT") + text.slice(1);

/** «3 novembre» / «20 gennaio 2027» (year only when it is not the current one). */
export function dateText(today: Day, day: Day): string {
  const p = parseDay(day);
  const year = p.year === parseDay(today).year ? "" : ` ${p.year}`;
  return `${p.day} ${MONTHS[p.month - 1]}${year}`;
}

/**
 * Deadline text of the table of #23 for a day after the Sunday of the current
 * week, in the sentence form («entro 26 ottobre», «entro fine mese»).
 */
export function farDeadline(today: Day, due: Day): string {
  const t = parseDay(today);
  const d = parseDay(due);
  const lastOfMonth = addDays(due, 1).slice(8, 10) === "01";
  const year = d.year === t.year ? "" : ` ${d.year}`;
  if (lastOfMonth) {
    if (d.year === t.year && d.month === t.month) return "entro fine mese";
    return `entro fine ${MONTHS[d.month - 1]}${year}`;
  }
  return `entro ${d.day} ${MONTHS[d.month - 1]}${year}`;
}

// ---------------------------------------------------------------------- clock

/** Fixes the clock of the browser at `time`; time keeps running. */
export async function setClock(page: Page, time: Date): Promise<void> {
  await page.clock.install({ time });
}

/**
 * Stops the clock a moment after "now" (browser time), once the page is loaded:
 * from here on only `page.clock.runFor` moves time (LEZIONI: tests with timers).
 */
export async function pauseClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 2000));
}

// --------------------------------------------------------------------- colors

/** The computed colour of `--color-allerta`, in the same form as `color`. */
export async function alertColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-allerta)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

export async function colorOf(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).color);
}

// ---------------------------------------------------------------------- Nests

type Kind = "adult" | "child" | "pet";
type Color = "pomodoro" | "glicine" | "salvia" | "cobalto" | "zafferano";

export type MemberSpec = {
  name: string;
  kind: Kind;
  color: Color;
  /** An adult with a login of his own (the first one creates the Nest) */
  account?: boolean;
};

export type TodoSpec = {
  title: string;
  /** Name of the member who takes care of it (adult or child) */
  assignee?: string;
  /** Name of the member it is for (any kind) */
  forMember?: string;
  due?: Day;
  /** «Solo io» */
  priv?: boolean;
  /** Instant when it was done (written with the session of the creator) */
  doneAt?: Date;
};

export type DeadlineSpec = {
  title: string;
  due: Day;
  note?: string;
  assignee?: string;
  forMember?: string;
  /** «Solo io» */
  priv?: boolean;
};

export type CasaNest = {
  name: string;
  householdId: string;
  /** Member ids by name */
  members: Record<string, string>;
  /** Users with an account, by member name */
  users: Record<string, ThrowawayUser>;
  /** Signs the context of the page in as the member with that name */
  signIn: (
    page: Page,
    baseURL: string | undefined,
    who: string,
  ) => Promise<void>;
  signInContext: (
    context: import("@playwright/test").BrowserContext,
    baseURL: string | undefined,
    who: string,
  ) => Promise<void>;
  /** Creates a thing to do with the session of `who` (RLS applies) */
  todo: (who: string, spec: TodoSpec) => Promise<string>;
  /** Creates a deadline with the session of `who` (RLS applies) */
  deadline: (who: string, spec: DeadlineSpec) => Promise<string>;
  /** Puts things to buy on the shopping list, in order */
  shopping: (who: string, names: string[]) => Promise<void>;
  /** Rows of `todos` of this Nest, read with the administrative key */
  todoRows: () => Promise<TodoRow[]>;
  deadlineRows: () => Promise<{ id: string; title: string }[]>;
};

export type TodoRow = {
  id: string;
  title: string;
  household_id: string;
  done_at: string | null;
  done_by_member_id: string | null;
  is_private: boolean;
};

/**
 * Builds a throwaway Nest. The first member with `account` creates it the way
 * onboarding does; the other members are added with the administrative key.
 * Everything is deleted by `cleanup`.
 */
export async function buildNest(
  name: string,
  specs: MemberSpec[],
): Promise<{ nest: CasaNest; cleanup: () => Promise<void> }> {
  const first = specs.find((spec) => spec.account);
  if (!first) throw new Error("Serve almeno un membro con account");
  const users: Record<string, ThrowawayUser> = {};
  const members: Record<string, string> = {};
  const created: ThrowawayUser[] = [];
  const cleanup = async () => {
    for (const user of created) await user.remove();
  };
  try {
    const owner = await createThrowawayUser(first.name);
    created.push(owner);
    users[first.name] = owner;
    const { error } = await owner.client.rpc("create_household", {
      name,
      household_type: "family_with_children",
      member_name: first.name,
      color: first.color,
    });
    if (error) throw new Error("Creazione del Nest di prova fallita");
    const { data: householdId } = await owner.client.rpc(
      "current_household_id",
    );
    const { data: me, error: meError } = await owner.admin
      .from("household_members")
      .select("id")
      .eq("user_id", owner.id)
      .single();
    if (meError || !me) throw new Error("Membro di prova non trovato");
    members[first.name] = me.id as string;

    // Members in order: the order of insertion is the order of the chips.
    for (const spec of specs) {
      if (spec === first) continue;
      let userId: string | null = null;
      if (spec.account) {
        const extra = await createThrowawayUser(spec.name);
        created.push(extra);
        users[spec.name] = extra;
        userId = extra.id;
      }
      const { data: row, error: insertError } = await owner.admin
        .from("household_members")
        .insert({
          household_id: householdId,
          kind: spec.kind,
          name: spec.name,
          color: spec.color,
          user_id: userId,
          joined_at: userId ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (insertError || !row)
        throw new Error(`Membro di prova non aggiunto: ${spec.name}`);
      members[spec.name] = row.id as string;
    }

    const memberId = (label: string | undefined) => {
      if (label === undefined) return null;
      const id = members[label];
      if (!id) throw new Error(`Membro di prova sconosciuto: ${label}`);
      return id;
    };
    const apiOf = (who: string) => {
      const user = users[who];
      if (!user) throw new Error(`${who} non ha un account di prova`);
      return user.client;
    };
    const idByTitle = async (
      table: "todos" | "deadlines",
      title: string,
    ): Promise<string> => {
      const { data, error: readError } = await owner.admin
        .from(table)
        .select("id")
        .eq("household_id", householdId as string)
        .eq("title", title);
      if (readError || !data || data.length === 0)
        throw new Error("Riga di prova non trovata");
      return data[data.length - 1]!.id as string;
    };

    const nest: CasaNest = {
      name,
      householdId: householdId as string,
      members,
      users,
      async signInContext(context, baseURL, who) {
        const user = users[who];
        if (!user) throw new Error(`${who} non ha un account di prova`);
        await user.signInContext(context, baseURL as string);
      },
      async signIn(page, baseURL, who) {
        await nest.signInContext(page.context(), baseURL, who);
      },
      async todo(who, spec) {
        const { error: insertError } = await apiOf(who)
          .from("todos")
          .insert({
            title: spec.title,
            assignee_member_id: memberId(spec.assignee),
            for_member_id: memberId(spec.forMember),
            due_date: spec.due ?? null,
            is_private: spec.priv ?? false,
          });
        if (insertError) throw new Error("Cosa da fare di prova non creata");
        const id = await idByTitle("todos", spec.title);
        if (spec.doneAt) {
          const { error: doneError } = await apiOf(who)
            .from("todos")
            .update({ done_at: spec.doneAt.toISOString() })
            .eq("id", id);
          if (doneError) throw new Error("Cosa fatta di prova non segnata");
        }
        return id;
      },
      async deadline(who, spec) {
        const { error: insertError } = await apiOf(who)
          .from("deadlines")
          .insert({
            title: spec.title,
            due_date: spec.due,
            note: spec.note ?? null,
            assignee_member_id: memberId(spec.assignee),
            for_member_id: memberId(spec.forMember),
            is_private: spec.priv ?? false,
          });
        if (insertError) throw new Error("Scadenza di prova non creata");
        return idByTitle("deadlines", spec.title);
      },
      async shopping(who, names) {
        for (const item of names) {
          const { error: insertError } = await apiOf(who)
            .from("shopping_items")
            .insert({ name: item });
          if (insertError) throw new Error("Cosa da prendere non aggiunta");
        }
      },
      async todoRows() {
        const { data, error: readError } = await owner.admin
          .from("todos")
          .select(
            "id, title, household_id, done_at, done_by_member_id, is_private",
          )
          .eq("household_id", householdId as string);
        if (readError) throw new Error("Lettura delle cose da fare fallita");
        return (data ?? []) as TodoRow[];
      },
      async deadlineRows() {
        const { data, error: readError } = await owner.admin
          .from("deadlines")
          .select("id, title")
          .eq("household_id", householdId as string);
        if (readError) throw new Error("Lettura delle scadenze fallita");
        return (data ?? []) as { id: string; title: string }[];
      },
    };
    return { nest, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** Casa D'Angelo as in the seed: Marco (account), Laura, Sofia, Tommaso, Biscotto. */
export const D_ANGELO: MemberSpec[] = [
  { name: "Marco", kind: "adult", color: "pomodoro", account: true },
  { name: "Laura", kind: "adult", color: "glicine" },
  { name: "Sofia", kind: "child", color: "salvia" },
  { name: "Tommaso", kind: "child", color: "cobalto" },
  { name: "Biscotto", kind: "pet", color: "zafferano" },
];

/** Casa Bianchi as in the seed: Giulia and Paolo (accounts), Leo, Anna. */
export const BIANCHI: MemberSpec[] = [
  { name: "Giulia", kind: "adult", color: "pomodoro", account: true },
  { name: "Paolo", kind: "adult", color: "glicine", account: true },
  { name: "Leo", kind: "child", color: "salvia" },
  { name: "Anna", kind: "adult", color: "cobalto" },
];

type Fixtures = {
  /** Throwaway Casa D'Angelo (Marco signs in) */
  casa: CasaNest;
  /** Throwaway Casa Bianchi (Giulia and Paolo sign in) */
  bianchi: CasaNest;
};

/** `test` with the throwaway Nests; skipped when the keys are not set. */
export const test = base.extend<Fixtures>({
  casa: async ({}, provide) => {
    base.skip(!throwawayConfigured(), throwawaySkipReason);
    const { nest, cleanup } = await buildNest("Casa D'Angelo", D_ANGELO);
    try {
      await provide(nest);
    } finally {
      await cleanup();
    }
  },
  bianchi: async ({}, provide) => {
    base.skip(!throwawayConfigured(), throwawaySkipReason);
    const { nest, cleanup } = await buildNest("Casa Bianchi", BIANCHI);
    try {
      await provide(nest);
    } finally {
      await cleanup();
    }
  },
});

export { expect };

export const isMobileProject = () => base.info().project.name === "mobile";

// ----------------------------------------------------------- shared locators

export const switcher = (page: Page) =>
  page.getByRole("group", { name: "Sezione della casa" });

/** A voice of the mobile section switcher, by label. */
export const switcherVoice = (page: Page, label: string) =>
  switcher(page)
    .locator(".selettore__voce")
    .filter({ hasText: new RegExp(`^${label}`) });

export const filterGroup = (page: Page) =>
  page.getByRole("group", { name: "Filtra per persona" });

export const column = (page: Page, name: "Spesa" | "Da fare" | "Scadenze") =>
  page.getByRole("region", { name });

/** The loading container (`aria-busy`). */
export const busy = (page: Page) => page.locator('[aria-busy="true"]');

/** Next.js keeps an empty role="alert" (route announcer) in every page. */
export const alerts = (page: Page) =>
  page.getByRole("alert").filter({ hasText: /\S/ });

export const OFFLINE_ALERT =
  "Sei offline: le cose che spunti partiranno appena torna la connessione.";
export const SAVE_FAILED =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";

/** CORS headers for the answers that Playwright makes up for the API. */
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};
