import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "./animations";
import {
  fakeCalendar,
  fakeCalendarConfigured,
  fakeCalendarSkipReason,
  type FakeCalendar,
} from "./calendar-fake";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "./throwaway-user";

// Helpers shared by tests/visual/calendari-collegati.spec.ts and
// tests/a11y/calendari-collegati.spec.ts (page /calendari-collegati, issues
// #34 part 1 and #35, PR #289).
//
// Every test makes its own throwaway user with its own Nest (marked as a test
// user, deleted in the `finally`) and prepares the fake provider for it. The
// accounts are linked with the real path of the page: «Collega …» → the
// consent page of the fake → «Consenti». The mails and the calendars are the
// ones of the mockup 26, so the screens can be compared with it.
// Nothing here has a value of its own: keys come only from the environment.

export const FIXED_NOW = new Date("2026-10-20T15:52:00+02:00");

export const baseURL = () =>
  test.info().project.use.baseURL ?? "http://localhost:3000";

export type ProviderName = "Outlook" | "Google";

export const OUTLOOK = {
  provider: "outlook" as const,
  name: "Outlook" as const,
  email: "marco@studio.it",
  calendars: [
    { id: "lavoro", name: "Lavoro", primary: true },
    { id: "ferie", name: "Ferie del team", readOnly: true },
  ] satisfies FakeCalendar[],
};

export const GOOGLE = {
  provider: "google" as const,
  name: "Google" as const,
  email: "marco.dangelo@gmail.com",
  calendars: [
    { id: "personale", name: "Personale", primary: true },
    { id: "tennis", name: "Tennis" },
    { id: "festivita", name: "Festività in Italia", readOnly: true },
  ] satisfies FakeCalendar[],
};

/** Skips the test when the throwaway users or the fake provider are not there. */
export function skipUnlessReady() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.skip(!fakeCalendarConfigured(), fakeCalendarSkipReason);
}

export type Ctx = {
  user: ThrowawayUser;
  fake: ReturnType<typeof fakeCalendar>;
};

/**
 * A throwaway adult with a Nest of their own («Marco», as in the mockup), signed
 * in the context of the page, with both fake accounts prepared but not linked.
 */
export async function prepare(page: Page): Promise<Ctx> {
  const user = await createThrowawayUser("Marco D'Angelo");
  const fake = fakeCalendar(baseURL());
  try {
    const { error } = await user.client.rpc("create_household", {
      name: "Casa D'Angelo",
      household_type: "single",
      member_name: "Marco",
      color: "pomodoro",
    });
    if (error) throw new Error("Nest di prova non creato");
    await user.signInContext(page.context(), baseURL());
    for (const account of [OUTLOOK, GOOGLE]) {
      await fake.setup({
        userId: user.id,
        email: account.email,
        provider: account.provider,
        calendars: account.calendars,
      });
    }
  } catch (caught) {
    await user.remove();
    throw caught;
  }
  return { user, fake };
}

/** Runs the body and always cleans up: the fake provider and the user. */
export async function withUser(
  page: Page,
  body: (ctx: Ctx) => Promise<void>,
): Promise<void> {
  skipUnlessReady();
  const ctx = await prepare(page);
  try {
    await body(ctx);
  } finally {
    await ctx.fake.reset(ctx.user.id).catch(() => undefined);
    await ctx.user.remove();
  }
}

/**
 * Opens /calendari-collegati and waits for the real page (the loading shell
 * has the same h1): the empty state, or the first calendar switch.
 */
export async function openCalendars(page: Page, kind: "empty" | "linked") {
  await expect(async () => {
    await page.goto("/calendari-collegati");
    await expect(
      kind === "empty"
        ? page.getByText("Nessun calendario collegato", { exact: true })
        : page.getByRole("switch").first(),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** «Collega Outlook» / «Collega Google» of the empty state, up to the consent page. */
export async function connectFromEmptyState(
  page: Page,
  provider: ProviderName,
) {
  await page
    .getByRole("button", { name: `Collega ${provider}`, exact: true })
    .click();
  await page.waitForURL(/\/fornitore-finto\//);
}

/** On the consent page of the fake: one button, then back on the page. */
export async function answerConsent(
  page: Page,
  button:
    | "Consenti"
    | "Consenti senza calendario"
    | "Nega"
    | "Serve l'approvazione dell'amministratore" = "Consenti",
) {
  await page.getByRole("link", { name: button, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/calendari-collegati");
}

/** Opens a sheet of the page with a click, retrying until React has taken over. */
export async function openSheet(
  page: Page,
  opener: () => ReturnType<Page["locator"]>,
  sheetName: string | RegExp,
) {
  const sheet = page.getByRole("dialog", { name: sheetName });
  await expect(async () => {
    if (!(await sheet.isVisible())) await opener().click();
    await expect(sheet).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await waitForAnimationsToEnd(page);
  return sheet;
}

export function openConnectSheet(page: Page) {
  return openSheet(
    page,
    () => page.getByRole("button", { name: "Collega un altro account" }),
    "Collega un altro account",
  );
}

export function openCalendarSheet(page: Page, calendar: string) {
  return openSheet(
    page,
    () =>
      page.getByRole("button", {
        name: `${calendar}: impostazioni`,
        exact: true,
      }),
    `Impostazioni del calendario ${calendar}`,
  );
}

export function openTargetSheet(page: Page) {
  return openSheet(
    page,
    () => page.getByRole("button", { name: /^Dove vanno i nuovi impegni/ }),
    "Dove vanno i nuovi impegni",
  );
}

/** Links Outlook, and then Google from the sheet, and settles the page. */
export async function linkBoth(page: Page, ctx: Ctx) {
  await openCalendars(page, "empty");
  await connectFromEmptyState(page, "Outlook");
  await answerConsent(page);
  await expect(
    page.getByRole("heading", { level: 2, name: "Outlook" }),
  ).toBeVisible();
  const sheet = await openConnectSheet(page);
  await sheet.getByRole("button", { name: "Collega Google" }).click();
  await page.waitForURL(/\/fornitore-finto\/google/);
  await answerConsent(page);
  await expect(
    page.getByRole("heading", { level: 2, name: "Google" }),
  ).toBeVisible();
  await settled(page, ctx);
}

/**
 * Synchronises now (so the page does not start a synchronisation when it
 * opens) and reads the page again with every calendar there.
 */
export async function settled(page: Page, ctx: Ctx) {
  await ctx.fake.sync(ctx.user.id);
  await openCalendars(page, "linked");
}

/** Id of the account with this mail, read with the session of the user. */
async function accountId(ctx: Ctx, email: string): Promise<string> {
  const { data, error } = await ctx.user.client
    .from("calendar_accounts")
    .select("id")
    .eq("email", email);
  if (error || !data?.[0]) throw new Error("Account di prova non trovato");
  return data[0].id as string;
}

/**
 * Puts an account in a state the page has to show. Prepared with the
 * administrative key (it only writes the state of a throwaway user, like a
 * failed synchronisation would): `minutesAgo` counts back from now.
 */
export async function putAccountIn(
  ctx: Ctx,
  email: string,
  state: {
    status: "reconnect" | "temporary_error";
    failingMinutesAgo: number;
    syncedMinutesAgo?: number;
  },
) {
  const id = await accountId(ctx, email);
  const ago = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000).toISOString();
  const { error } = await ctx.user.admin
    .from("calendar_accounts")
    .update({
      status: state.status,
      failing_since: ago(state.failingMinutesAgo),
      ...(state.syncedMinutesAgo !== undefined
        ? { last_synced_at: ago(state.syncedMinutesAgo) }
        : {}),
    })
    .eq("id", id);
  if (error) throw new Error("Stato dell'account di prova non scritto");
}

/**
 * The times on the page come from the server clock, which the test cannot
 * fix: they are put back to the ones of the mockup so the reference does not
 * change from one run to the next. Only the digits change, never the words.
 */
export async function freezeTimes(page: Page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.querySelector("main") ?? document.body,
      NodeFilter.SHOW_TEXT,
    );
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    // Dialogs and toasts live outside <main>.
    const extra = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [role="status"]',
    );
    for (const root of extra) {
      const inner = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (inner.nextNode()) nodes.push(inner.currentNode as Text);
    }
    for (const node of new Set(nodes)) {
      const text = node.nodeValue ?? "";
      if (!/\d{1,2}:\d{2}/.test(text)) continue;
      // JSX splits a sentence in several text nodes: read the context from the parent.
      const context = node.parentElement?.textContent ?? text;
      const time = /Ultima sincronizzazione/.test(context)
        ? "15:48"
        : /Vedi i calendari aggiornati/.test(context)
          ? "15:40"
          : "13:10";
      node.nodeValue = text.replace(/\d{1,2}:\d{2}/, time);
    }
  });
}

/** Pins the pointer away, freezes the times and shoots. */
export async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await freezeTimes(page);
  await expect(page).toHaveScreenshot(name, { fullPage });
}
