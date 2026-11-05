import { test as plain, type Browser, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { isMobileProject } from "../fixtures/casa";
import {
  at,
  busy,
  chooseLens,
  expect,
  h1,
  lensButton,
  lensGroup,
  longDay,
  open,
  T,
  test,
  type CasaNest,
} from "../fixtures/oggi";
import { pressedLenses, setPreferences } from "../fixtures/preferenze";

// Oggi (#30): access, header, lens and Aggiungi (CA-1 ... CA-4, CA-35, CA-42).
//
// The page has two layouts in the DOM, one of them `display: none`: roles are
// read from the accessibility tree, so only the layout on screen is seen.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });

plain.describe("accesso", () => {
  plain("CA-1: senza sessione /oggi porta a /accesso", async ({ page }) => {
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  plain(
    "CA-2: l'utente C, senza Nest, viene portato su /onboarding",
    async ({ page, baseURL }) => {
      plain.skip(!usersConfigured("C"), skipReason("C"));
      await signInAs(page.context(), baseURL as string, "C");
      await page.goto("/oggi");
      await expect(page).toHaveURL(/\/onboarding$/);
    },
  );
});

/**
 * Opens Oggi in a context of its own with the clock stopped at `time`, and
 * returns the page: the greeting follows the hour, and the clock of a context
 * can only be installed once.
 */
async function pageAt(
  browser: Browser,
  baseURL: string | undefined,
  casa: CasaNest,
  viewport: { width: number; height: number } | null,
  time: Date,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    viewport: viewport ?? undefined,
  });
  await context.clock.install({ time: new Date(time.getTime() - 120_000) });
  await casa.signInContext(context, baseURL, "Marco");
  const page = await context.newPage();
  await page.goto("/oggi");
  await expect(h1(page)).toBeVisible({ timeout: 20_000 });
  await expect(busy(page)).toHaveCount(0);
  await context.clock.pauseAt(time);
  return { page, close: () => context.close() };
}

test.describe("intestazione", () => {
  test("CA-3: l'h1 saluta secondo l'ora e sopra c'è il giorno di oggi", async ({
    page,
    browser,
    baseURL,
    casa,
  }) => {
    await open(page, baseURL, casa, "Marco");
    // 15:52: «Buon pomeriggio,» a capo «Marco», e sopra il giorno scritto per esteso.
    await expect(h1(page)).toContainText("Buon pomeriggio,");
    await expect(h1(page)).toContainText("Marco");
    await expect(h1(page).locator("b")).toHaveText("Marco");
    await expect(page.locator("p.intestazione__sopra:visible")).toHaveText(
      longDay(T),
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    for (const [time, expected] of [
      ["9:00", "Buongiorno,"],
      ["19:00", "Buonasera,"],
    ] as const) {
      const other = await pageAt(
        browser,
        baseURL,
        casa,
        page.viewportSize(),
        at(T, time),
      );
      try {
        await expect(h1(other.page)).toContainText(expected);
        await expect(h1(other.page)).toContainText("Marco");
      } finally {
        await other.close();
      }
    }
  });
});

test.describe("lente iniziale", () => {
  test("CA-4: con start_lens = io la lente parte da «Io»; su mobile sta nella barra, su desktop dentro main; «Oggi» è la voce attiva", async ({
    page,
    baseURL,
    casa,
  }) => {
    await open(page, baseURL, casa, "Marco", { pause: false });
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(
      mainNav(page).getByRole("link", { name: "Oggi", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const inMain = page
      .getByRole("main")
      .getByRole("group", { name: "Punto di vista: solo tu o tutto il Nest" });
    if (isMobileProject()) {
      await expect(inMain).toHaveCount(0);
      await expect(lensGroup(page)).toBeVisible();
    } else {
      await expect(inMain).toBeVisible();
    }
  });

  test("CA-42: con start_lens = nest la lente è «Nest» già nell'HTML del server; «Io» toccato resta dopo il ricaricamento; un contesto nuovo riparte da «Nest»", async ({
    page,
    browser,
    baseURL,
    casa,
  }) => {
    await setPreferences(casa.users["Marco"]!, { start_lens: "nest" });
    await casa.signIn(page, baseURL, "Marco");

    // The document as the server writes it, before any script runs.
    const response = await page.request.get("/oggi");
    expect(response.status()).toBe(200);
    expect(pressedLenses(await response.text())).toEqual(["Nest"]);

    await page.goto("/oggi");
    await expect(h1(page)).toBeVisible({ timeout: 20_000 });
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await chooseLens(page, "Io");
    await page.reload();
    await expect(h1(page)).toBeVisible({ timeout: 20_000 });
    await expect(lensButton(page, "Io")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lensButton(page, "Nest")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    const fresh = await browser.newContext({
      baseURL,
      viewport: page.viewportSize() ?? undefined,
    });
    try {
      await casa.signInContext(fresh, baseURL, "Marco");
      const other = await fresh.newPage();
      await other.goto("/oggi");
      await expect(h1(other)).toBeVisible({ timeout: 20_000 });
      await expect(lensButton(other, "Nest")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(lensButton(other, "Io")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    } finally {
      await fresh.close();
    }
  });
});

test.describe("Aggiungi", () => {
  const quickAdd = (page: Page) =>
    page.getByRole("link", {
      name: /^Aggiungi un impegno, una spesa o una cosa da fare/,
    });

  test("CA-35: su desktop il tasto «n» apre Aggiungi una volta sola, ma non dentro un campo; il campo rapido è un link con il tasto N; su mobile non c'è", async ({
    page,
    baseURL,
    casa,
  }) => {
    await open(page, baseURL, casa, "Marco", { pause: false });
    if (isMobileProject()) {
      await expect(quickAdd(page)).toHaveCount(0);
      return;
    }
    const link = quickAdd(page);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/aggiungi");
    await expect(link).toHaveAttribute("aria-keyshortcuts", "n");
    await expect(link.locator("kbd")).toHaveText("N");

    // In a text field «n» is only a letter. The frame has no search field, so
    // the test puts a field of its own in the page.
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.type = "text";
      input.setAttribute("aria-label", "Campo di prova");
      document.querySelector("main")?.prepend(input);
      input.focus();
    });
    const field = page.getByLabel("Campo di prova");
    await expect(field).toBeFocused();
    await page.keyboard.press("n");
    await expect(field).toHaveValue("n");
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(page.getByRole("dialog", { name: "Aggiungi" })).toHaveCount(0);
    await field.evaluate((element) => element.remove());

    // With the focus on the page «n» opens Aggiungi, over Oggi.
    await h1(page).focus();
    await expect(h1(page)).toBeFocused();
    await expect(async () => {
      await page.keyboard.press("n");
      await expect(page).toHaveURL(/\/aggiungi$/, { timeout: 1500 });
    }).toPass();
    await expect(page.getByRole("dialog", { name: "Aggiungi" })).toHaveCount(1);
  });
});
