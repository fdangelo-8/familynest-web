import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  fakeCalendar,
  fakeCalendarConfigured,
  fakeCalendarSkipReason,
  STANDARD_FAKE_ACCOUNT,
  type FakeCalendar,
  type FakeEvent,
} from "./calendar-fake";
import { addDays, romeDay, romeInstant, weekdayIndex } from "./casa";
import {
  chooseLens,
  dayPath,
  h1 as dayH1,
  region as dayRegion,
} from "./giorno";
import { withInviteNest, type InviteNest } from "./invito";
import { openMember, removeButton, withRita, type RitaNest } from "./membro";
import {
  deleteButton,
  deleteDialog,
  openProfile,
  waitHydrated,
} from "./profilo";
import {
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "./throwaway-user";

// Helpers of the tests of «Calendari collegati» (#34 part 1, #35). Every test
// builds its own throwaway Nest (U, optionally with Rita), prepares the fake
// provider for U only, and removes everything in the `finally`. The secrets of
// the fake come only from the environment (see ./calendar-fake.ts).

export { expect, test };
export type { FakeCalendar, FakeEvent };
export { addDays, romeDay, waitHydrated };

export const PATH = "/calendari-collegati";
export const PAGE_TITLE = "FamilyNest · Calendari collegati";
export const SAVE_ERROR =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";
export const EMPTY_TITLE = "Nessun calendario collegato";

export const NAME = { google: "Google", outlook: "Outlook" } as const;
export type Provider = keyof typeof NAME;

// ----------------------------------------------------------------- the fake

export type Fake = ReturnType<typeof fakeCalendar>;

export type AccountSpec = {
  provider: Provider;
  email: string;
  calendars: FakeCalendar[];
};

/** The «Google finto standard» (#34). */
export const GOOGLE: AccountSpec = {
  provider: "google",
  email: STANDARD_FAKE_ACCOUNT.email,
  calendars: STANDARD_FAKE_ACCOUNT.calendars,
};

/** The «Outlook finto standard» (#35). */
export const OUTLOOK: AccountSpec = {
  provider: "outlook",
  email: "u.studio@example.test",
  calendars: [
    { id: "calendario", name: "Calendario", primary: true },
    { id: "ferie", name: "Ferie del team", readOnly: true },
  ],
};

/** The same account with events in some of its calendars (by calendar id). */
export function withEvents(
  spec: AccountSpec,
  events: Record<string, FakeEvent[]>,
): AccountSpec {
  return {
    ...spec,
    calendars: spec.calendars.map((calendar) => ({
      ...calendar,
      events: events[calendar.id] ?? calendar.events,
    })),
  };
}

/** Skips the test where the fake provider or the throwaway users are off. */
export function needsFake() {
  test.skip(!fakeCalendarConfigured(), fakeCalendarSkipReason);
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

export const isMobile = () => test.info().project.name === "mobile";

// ------------------------------------------------------------- dates (Rome)

/** Hour and minutes in Europe/Rome, hours without a leading zero: «9:05». */
export function clock(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${Number(get("hour"))}:${get("minute")}`;
}

/** The ISO instant of a wall-clock time in Rome on a day. */
export const at = (day: string, hour: number, minute = 0) =>
  romeInstant(day, hour, minute).toISOString();

export const today = () => romeDay();
export const tomorrow = () => addDays(romeDay(), 1);

/** The first Saturday after today. */
export function nextSaturday(): string {
  const now = romeDay();
  const ahead = (6 - weekdayIndex(now) + 7) % 7;
  return addDays(now, ahead === 0 ? 7 : ahead);
}

// -------------------------------------------------------------------- Nests

export type Linker = {
  user: ThrowawayUser;
  householdId: string;
  adminMemberId: string;
  fake: Fake;
  baseURL: string;
  /** Prepares an account at the fake; the next consent page grants it. */
  prepare: (spec: AccountSpec, nextConsent?: boolean) => Promise<void>;
  /** Replaces the events of a calendar of an account already linked. */
  provide: (
    spec: AccountSpec,
    calendarId: string,
    events: FakeEvent[],
  ) => Promise<void>;
  /** Signs the browser of `page` in as U. */
  signIn: (page: Page) => Promise<void>;
  /** Accounts of U, read with the administrative key. */
  accounts: () => Promise<AccountRow[]>;
  /** Calendars of U (of one account), read with the administrative key. */
  calendars: (accountId?: string) => Promise<CalendarRow[]>;
  /** Events of the Nest (with that title), read with the administrative key. */
  events: (title?: string) => Promise<EventRow[]>;
  /** Waits for the number of events with that title in the Nest. */
  waitForEvents: (title: string, count: number) => Promise<void>;
  /** The refresh tokens the fake issued to U. */
  tokens: () => Promise<string[]>;
  /** Changes the choices of a calendar by name, with the session of U. */
  setCalendar: (
    name: string,
    patch: Partial<
      Pick<
        CalendarRow,
        | "visibility"
        | "direction"
        | "counts_for_free_time"
        | "weekdays_only"
        | "is_enabled"
      >
    >,
  ) => Promise<void>;
};

export type AccountRow = {
  id: string;
  provider: Provider;
  email: string;
  status: string;
  failing_since: string | null;
  last_synced_at: string | null;
  credentials_ciphertext: string;
};

export type CalendarRow = {
  id: string;
  account_id: string;
  name: string;
  is_enabled: boolean;
  direction: string;
  visibility: string;
  counts_for_free_time: boolean;
  weekdays_only: boolean;
  is_new_events_target: boolean;
  last_synced_at: string | null;
};

export type EventRow = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  visibility: string;
  author_member_id: string | null;
};

function linker(
  user: ThrowawayUser,
  nest: { householdId: string; adminMemberId: string },
  baseURL: string | undefined,
): Linker {
  if (!baseURL) throw new Error("baseURL non impostato");
  const fake = fakeCalendar(baseURL);
  const self: Linker = {
    user,
    householdId: nest.householdId,
    adminMemberId: nest.adminMemberId,
    fake,
    baseURL,
    async prepare(spec, nextConsent = true) {
      await fake.setup({
        userId: user.id,
        provider: spec.provider,
        email: spec.email,
        calendars: spec.calendars,
        nextConsent,
      });
    },
    async provide(spec, calendarId, events) {
      await fake.setEvents({
        userId: user.id,
        provider: spec.provider,
        email: spec.email,
        calendarId,
        events,
      });
    },
    signIn: (page) => user.signInContext(page.context(), baseURL),
    async accounts() {
      const { data, error } = await user.admin
        .from("calendar_accounts")
        .select(
          "id, provider, email, status, failing_since, last_synced_at, credentials_ciphertext",
        )
        .eq("member_id", nest.adminMemberId)
        .order("connected_at", { ascending: true });
      if (error) throw new Error("Lettura degli account di prova fallita");
      return data as AccountRow[];
    },
    async calendars(accountId) {
      let query = user.admin
        .from("external_calendars")
        .select(
          "id, account_id, name, is_enabled, direction, visibility, counts_for_free_time, weekdays_only, is_new_events_target, last_synced_at",
        )
        .eq("member_id", nest.adminMemberId);
      if (accountId) query = query.eq("account_id", accountId);
      const { data, error } = await query;
      if (error) throw new Error("Lettura dei calendari di prova fallita");
      return data as CalendarRow[];
    },
    async events(title) {
      let query = user.admin
        .from("events")
        .select(
          "id, title, location, notes, starts_at, ends_at, visibility, author_member_id",
        )
        .eq("household_id", nest.householdId)
        .order("starts_at", { ascending: true });
      if (title !== undefined) query = query.eq("title", title);
      const { data, error } = await query;
      if (error) throw new Error("Lettura degli impegni di prova fallita");
      return data as EventRow[];
    },
    async waitForEvents(title, count) {
      await expect
        .poll(async () => (await self.events(title)).length, {
          timeout: 30_000,
          message: `Impegni «${title}» nel Nest`,
        })
        .toBe(count);
    },
    async setCalendar(name, patch) {
      const row = (await self.calendars()).find((c) => c.name === name);
      if (!row) throw new Error(`Calendario di prova non trovato: ${name}`);
      const { error, count } = await user.client
        .from("external_calendars")
        .update(patch, { count: "exact" })
        .eq("id", row.id);
      if (error || count === 0) {
        throw new Error(`Calendario di prova non cambiato: ${name}`);
      }
    },
    async tokens() {
      const log = await fake.log(user.id);
      return log
        .filter((entry) => entry.action === "token" && entry.token)
        .map((entry) => entry.token as string);
    },
  };
  return self;
}

/** U with a Nest and the fake provider; everything is removed at the end. */
export async function withLinker(
  baseURL: string | undefined,
  body: (ctx: Linker) => Promise<void>,
) {
  await withInviteNest(async (nest: InviteNest) => {
    const ctx = linker(nest.user, nest, baseURL);
    try {
      await body(ctx);
    } finally {
      await ctx.fake.reset(nest.user.id).catch(() => undefined);
    }
  });
}

export type RitaLinker = Linker & {
  rita: ThrowawayUser;
  ritaId: string;
  /** The same tools, for Rita (U2). */
  asRita: Linker;
};

/** U and Rita (adult with an account) in the same Nest. */
export async function withLinkerRita(
  baseURL: string | undefined,
  body: (ctx: RitaLinker) => Promise<void>,
) {
  await withRita(async (nest: RitaNest) => {
    const ctx = linker(nest.user, nest, baseURL);
    const asRita = linker(
      nest.u2,
      { ...nest, adminMemberId: nest.ritaId },
      baseURL,
    );
    try {
      await body({ ...ctx, rita: nest.u2, ritaId: nest.ritaId, asRita });
    } finally {
      await ctx.fake.reset(nest.user.id).catch(() => undefined);
      await ctx.fake.reset(nest.u2.id).catch(() => undefined);
    }
  });
}

// ------------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** The section of an account: «Account Google u.finto@example.test». */
export const accountSection = (
  page: Page,
  provider: Provider,
  email?: string,
) =>
  email
    ? page.getByRole("region", {
        name: `Account ${NAME[provider]} ${email}`,
        exact: true,
      })
    : page.getByRole("region", {
        name: new RegExp(`^Account ${NAME[provider]}`),
      });

export const anySection = (page: Page) =>
  page.getByRole("region", { name: /^Account (Google|Outlook)/ });

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Accessible name of the button of a row: «Personale : impostazioni». */
export const rowButtonName = (name: string) =>
  new RegExp(`^${escapeRe(name)}\\s?: impostazioni$`);

/** The row of a calendar inside a section. */
export const calendarRow = (section: Locator, name: string) =>
  section.getByRole("listitem").filter({
    has: section.page().getByRole("button", { name: rowButtonName(name) }),
  });

export const rowButton = (row: Locator) => row.getByRole("button").first();
export const rowSummary = (row: Locator) => row.locator(".riga-lista__info");
export const rowSwitch = (row: Locator, name: string) =>
  row.getByRole("switch", { name: `Sincronizza ${name}`, exact: true });

/** The dialog (sheet on mobile, modal on desktop) of a calendar. */
export const settingsDialog = (page: Page, name: string) =>
  page.getByRole("dialog", {
    name: `Impostazioni del calendario ${name}`,
    exact: true,
  });

export const targetRow = (page: Page) =>
  page.getByRole("button", { name: /^Dove vanno i nuovi impegni/ });

/** Alerts and statuses with text (the route announcer is an empty alert). */
export const alerts = (page: Page) =>
  page.getByRole("alert").filter({ hasText: /\S/ });

/** The «Ricollega» / «Riprova» / «Collega ...» buttons. */
export const button = (scope: Page | Locator, name: string) =>
  scope.getByRole("button", { name, exact: true });

// ----------------------------------------------------------------- the page

/** Opens the page and waits until it is hydrated (a click before is lost). */
export async function openCalendars(page: Page) {
  await page.goto(PATH);
  await expect(h1(page)).toHaveText("Calendari collegati");
  await waitHydrated(h1(page));
}

/** Starts the link: from the empty state or from «Collega un altro account». */
export async function startLink(
  page: Page,
  provider: Provider,
  from: "vuoto" | "altro",
) {
  const name = `Collega ${NAME[provider]}`;
  if (from === "altro") {
    await button(page, "Collega un altro account").click();
    const dialog = page.getByRole("dialog", {
      name: "Collega un altro account",
    });
    await expect(dialog).toBeVisible();
    await button(dialog, name).click();
  } else {
    await button(page, name).click();
  }
  await expect(page).toHaveURL(/\/fornitore-finto\//);
}

export type Answer =
  | "Consenti"
  | "Consenti senza calendario"
  | "Nega"
  | "Serve l'approvazione dell'amministratore";

/** Answers on the page of the fake provider and waits for the way back. */
export async function answer(page: Page, what: Answer) {
  await page.getByRole("link", { name: what, exact: true }).click();
  await expect(page).toHaveURL(/\/calendari-collegati$/);
  await expect(h1(page)).toHaveText("Calendari collegati");
  await waitHydrated(h1(page));
}

/** Opens the page and links an account from the empty state / the sheet. */
export async function linkFromPage(
  page: Page,
  provider: Provider,
  from: "vuoto" | "altro" = "vuoto",
  what: Answer = "Consenti",
) {
  await openCalendars(page);
  await startLink(page, provider, from);
  await answer(page, what);
}

/** Prepares the account at the fake, signs `page` in as U and links it. */
export async function linkAs(
  who: Linker,
  page: Page,
  spec: AccountSpec,
  from: "vuoto" | "altro" = "vuoto",
) {
  await who.prepare(spec);
  await who.signIn(page);
  await linkFromPage(page, spec.provider, from);
}

/**
 * Links another account without the sheet: the same form the buttons send
 * (for the tests that need many accounts).
 */
export async function linkWithForm(
  page: Page,
  provider: Provider,
  what: Answer = "Consenti",
) {
  await page.evaluate((id) => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = `/calendari-collegati/collega/${id}`;
    const destination = document.createElement("input");
    destination.type = "hidden";
    destination.name = "destination";
    destination.value = "page";
    form.append(destination);
    document.body.append(form);
    form.submit();
  }, provider);
  await expect(page).toHaveURL(/\/fornitore-finto\//);
  await answer(page, what);
}

/** Waits until the calendar of the row is switched on or off. */
export async function expectSwitch(row: Locator, name: string, on: boolean) {
  await expect(rowSwitch(row, name)).toHaveAttribute(
    "aria-checked",
    on ? "true" : "false",
  );
}

/** Opens the settings of a calendar and returns the dialog. */
export async function openSettings(
  page: Page,
  section: Locator,
  name: string,
): Promise<Locator> {
  const trigger = rowButton(calendarRow(section, name));
  await waitHydrated(trigger);
  await trigger.click();
  const dialog = settingsDialog(page, name);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Saves the settings dialog and waits for it to close. */
export async function saveSettings(dialog: Locator) {
  await button(dialog, "Salva").click();
  await expect(dialog).toBeHidden();
}

export const directionRadio = (dialog: Locator, title: string) =>
  dialog.getByRole("radio", { name: new RegExp(`^${title}`) });

export const visibilityButton = (dialog: Locator, label: string) =>
  dialog
    .getByRole("group", { name: "Chi vede questi impegni nel Nest" })
    .getByRole("button", { name: label, exact: true });

/** Fails the writes the page makes on the calendars (switches and «Salva»). */
export async function failCalendarWrites(page: Page) {
  await page.route("**/rest/v1/external_calendars*", (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.fallback(),
  );
}

/**
 * Runs `body` with a page of a browser of its own, signed in as `who`, so that
 * the page of the test can belong to somebody else (Rita looking at what U has
 * linked). Cookies of two adults never mix.
 */
export async function inNewPage(
  browser: Browser,
  who: Linker,
  body: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    baseURL: who.baseURL,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  try {
    const page = await context.newPage();
    await who.signIn(page);
    await body(page);
  } finally {
    await context.close();
  }
}

/** Links an account of `who` in a browser of its own. */
export async function linkInBackground(
  browser: Browser,
  who: Linker,
  provider: Provider,
) {
  await inNewPage(browser, who, (page) => linkFromPage(page, provider));
}

// ---------------------------------------------------------------- day view

/** Opens the day view of Calendario with the «Nest» lens and waits for data. */
export async function openDay(page: Page, day: string) {
  await page.goto(dayPath(day));
  await expect(dayH1(page)).toBeVisible({ timeout: 20_000 });
  await chooseLens(page, "Nest");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(
    dayRegion(page).or(page.getByText("Giornata libera", { exact: true })),
  ).toBeVisible();
}

/** The blocks of an event the viewer can open. */
export const eventBlocks = (page: Page, title: string) =>
  page.locator("a.blocco-orario").filter({ hasText: title });

export const busyBlocks = (page: Page) =>
  page.locator(".blocco-orario--occupato");

export const freeBlocks = (page: Page) =>
  page.locator(".blocco-orario--insieme");

// ------------------------------------------------------------- privacy tools

/** Collects the text of the answers (pages, data, flight payloads) of a page. */
export function watchBodies(page: Page) {
  const pending: Promise<string>[] = [];
  page.on("response", (response) => {
    // The page of the fake provider plays the part of Google or Microsoft: the
    // code lives there by design. Only the answers of FamilyNest are checked.
    if (new URL(response.url()).pathname.startsWith("/fornitore-finto/"))
      return;
    const type = response.headers()["content-type"] ?? "";
    if (!/json|html|text\/x-component|text\/plain|xml/.test(type)) return;
    // A body that never ends (a stream) must not hang the test: after a few
    // seconds it counts as empty.
    const body = response.text().catch(() => "");
    const giveUp = new Promise<string>((resolve) =>
      setTimeout(() => resolve(""), 8_000),
    );
    pending.push(Promise.race([body, giveUp]));
  });
  return {
    async texts(): Promise<string[]> {
      return Promise.all(pending);
    },
  };
}

/** Everything the browser keeps: cookies, local and session storage. */
export async function browserKeeps(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    }),
  );
  return JSON.stringify(cookies) + storage;
}

/** A Nest event, created with the session of U (RLS applies). */
export async function createNestEvent(
  ctx: Linker,
  title: string,
  day: string,
  from: [number, number],
  to: [number, number],
) {
  const { error } = await ctx.user.client.rpc("create_event", {
    p_title: title,
    p_starts_at: at(day, from[0], from[1]),
    p_ends_at: at(day, to[0], to[1]),
    p_member_ids: [ctx.adminMemberId],
    p_visibility: "household",
  });
  if (error) throw new Error(`Impegno di prova non creato: ${title}`);
}

// ------------------------------------------------- unlinking and deletion

/** What U has at the provider side of the database, before it is removed. */
export type Snapshot = {
  accountIds: string[];
  calendarIds: string[];
  eventIds: string[];
  ciphertexts: string[];
  tokens: string[];
};

export async function snapshot(ctx: Linker): Promise<Snapshot> {
  const accounts = await ctx.accounts();
  const calendars = await ctx.calendars();
  const events = await ctx.events();
  return {
    accountIds: accounts.map((a) => a.id),
    calendarIds: calendars.map((c) => c.id),
    eventIds: events.map((e) => e.id),
    ciphertexts: accounts.map((a) => a.credentials_ciphertext),
    tokens: await ctx.tokens(),
  };
}

/** Rows left in the tables of the linked calendars for what `before` held. */
export async function leftovers(ctx: Linker, before: Snapshot) {
  const admin = ctx.user.admin;
  const count = async (
    table: string,
    column: string,
    values: string[],
  ): Promise<number> => {
    if (values.length === 0) return 0;
    const { data, error } = await admin
      .from(table)
      .select("id")
      .in(column, values);
    if (error) throw new Error(`Lettura di ${table} fallita`);
    return data.length;
  };
  const queued = async (): Promise<number> => {
    let total = 0;
    for (const ciphertext of before.ciphertexts) {
      const { data, error } = await admin
        .from("calendar_credential_revocations")
        .select("id")
        .eq("credentials_ciphertext", ciphertext);
      if (error) throw new Error("Lettura della coda di revoca fallita");
      total += data.length;
    }
    return total;
  };
  return {
    accounts: await count("calendar_accounts", "id", before.accountIds),
    calendars: await count("external_calendars", "id", before.calendarIds),
    links: await count(
      "event_external_links",
      "calendar_id",
      before.calendarIds,
    ),
    events: await count("events", "id", before.eventIds),
    queue: await queued(),
  };
}

/** The tokens the fake was asked to revoke, after running the queue. */
export async function revokedTokens(ctx: Linker): Promise<string[]> {
  await ctx.fake.revocations();
  const log = await ctx.fake.log(ctx.user.id);
  return log
    .filter((entry) => entry.action === "revoke" && entry.token)
    .map((entry) => entry.token as string);
}

/** U deletes the FamilyNest account from /profilo (Rita stays in the Nest). */
export async function deleteOwnAccount(ctx: Linker, page: Page) {
  await ctx.signIn(page);
  await openProfile(page);
  await deleteButton(page).click();
  const dialog = deleteDialog(page);
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Elimina l'account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/accesso\?account=eliminato$/);
}

/** Rita (made administrator) takes U out of the Nest. */
export async function ritaRemovesU(ctx: RitaLinker, page: Page) {
  const { error } = await ctx.user.admin
    .from("household_members")
    .update({ is_admin: true })
    .eq("id", ctx.ritaId);
  if (error) throw new Error("Rita non è diventata amministratrice");
  await ctx.asRita.signIn(page);
  await openMember(page, ctx.adminMemberId, "Ilaria");
  await removeButton(page, "Ilaria").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Togli Ilaria", exact: true })
    .click();
  await expect(page).toHaveURL(/\/nest$/);
}
