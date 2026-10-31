import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  notifyEventsChanged,
  subscribeEventsChanged,
} from "../../src/lib/events-changed";

// #164: Add opens over the current page (parallel + intercepted route),
// directly it opens over Today, and from 1024 px the N key opens it.
// Needs test user A (skipped, with a reason, while it is not available).

const NAV = { name: "Navigazione principale" };

function dialogOf(page: Page) {
  return page.getByRole("dialog", { name: "Aggiungi" });
}

/** The only visible "Aggiungi" link: bottom navigation on mobile, top navigation on desktop. */
function addLink(page: Page) {
  return page.getByRole("link", { name: "Aggiungi", exact: true });
}

async function openPage(
  page: Page,
  baseURL: string | undefined,
  route: string,
) {
  await signInAs(page.context(), baseURL as string, "A");
  await page.goto(route);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("h1:visible")).toHaveCount(1);
}

/** Presses "n" until the sheet opens (the listener exists only once the page is hydrated). */
async function openWithN(page: Page) {
  await expect(async () => {
    await page.keyboard.press("n");
    await expect(dialogOf(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
}

async function closeWithEscape(page: Page, backTo: RegExp) {
  await page.keyboard.press("Escape");
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(page).toHaveURL(backTo);
}

test.describe("Aggiungi sopra la pagina", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-4: dal link Aggiungi si apre sopra la pagina, Esc chiude e il fuoco torna sul link", async ({
    page,
    baseURL,
  }) => {
    await openPage(page, baseURL, "/calendario");
    await page.evaluate(() => {
      (window as unknown as { __marker: string }).__marker = "same-page";
    });
    const link = addLink(page);
    await expect(async () => {
      await link.click();
      await expect(dialogOf(page)).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page).toHaveURL(/\/aggiungi$/);
    await expect(dialogOf(page).getByText("scrivi come parli")).toBeVisible();
    // no reload: the value set before opening is still there
    expect(
      await page.evaluate(
        () => (window as unknown as { __marker?: string }).__marker,
      ),
    ).toBe("same-page");

    await closeWithEscape(page, /\/calendario$/);
    expect(
      await page.evaluate(
        () => (window as unknown as { __marker?: string }).__marker,
      ),
    ).toBe("same-page");
    await expect(link).toBeFocused();
  });

  test("la cornice sotto il foglio non cambia pagina", async ({
    page,
    baseURL,
  }, testInfo) => {
    await openPage(page, baseURL, "/calendario");
    await expect(async () => {
      await addLink(page).click();
      await expect(dialogOf(page)).toBeVisible({ timeout: 1000 });
    }).toPass();
    const active = page.getByRole("navigation", NAV).locator("[aria-current]");
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText("Calendario");
    await expect(active).toHaveAttribute("aria-current", "page");
    if (testInfo.project.name === "mobile") {
      // the mobile bar of Calendario keeps "Cerca nel Nest"
      await expect(
        page.getByRole("link", { name: /^Cerca nel Nest/ }),
      ).toHaveCount(1);
    }
  });

  test("CA-6: «Indietro» del browser chiude il foglio e torna alla pagina di prima", async ({
    page,
    baseURL,
  }) => {
    await openPage(page, baseURL, "/calendario");
    await expect(async () => {
      await addLink(page).click();
      await expect(dialogOf(page)).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.goBack();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("CA-5: aperta direttamente, /aggiungi mostra il foglio sopra Oggi; il velo porta a /oggi con il fuoco sul main", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/aggiungi");
    await expect(dialogOf(page)).toBeVisible();
    await expect(page).toHaveTitle("FamilyNest · Aggiungi");
    await expect(page.locator("main h1")).toHaveText("Oggi");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    const active = page.getByRole("navigation", NAV).locator("[aria-current]");
    await expect(active).toHaveText("Oggi");

    await expect(async () => {
      await page.getByTestId("velo").click({ position: { x: 5, y: 5 } });
      await expect(dialogOf(page)).toHaveCount(0, { timeout: 1000 });
    }).toPass();
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(page.locator("main#contenuto")).toBeFocused();
  });
});

test.describe("Tasto N", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-7: su desktop «n» apre Aggiungi; con Alt, in un campo o con un dialogo aperto no", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Solo da 1024 px");
    await openPage(page, baseURL, "/calendario");

    // first prove the shortcut is alive (page hydrated), then try the cases that must do nothing
    await openWithN(page);
    await expect(page).toHaveURL(/\/aggiungi$/);
    // a dialog is open: "n" does nothing more
    const historyBefore = await page.evaluate(() => history.length);
    await page.keyboard.press("n");
    await page.waitForTimeout(300);
    await expect(dialogOf(page)).toHaveCount(1);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);
    await closeWithEscape(page, /\/calendario$/);

    await page.keyboard.press("Alt+n");
    await page.waitForTimeout(300);
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);

    // with the focus in a text field: the letter is typed, nothing opens
    await page.goto("/casa/spesa");
    const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
    await expect(field).toBeVisible();
    await openWithN(page);
    await closeWithEscape(page, /\/casa\/spesa$/);
    await field.click();
    await page.keyboard.press("n");
    await page.waitForTimeout(300);
    await expect(field).toHaveValue("n");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/casa\/spesa$/);
  });

  test("su mobile «n» non apre Aggiungi", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Solo sotto 1024 px");
    await openPage(page, baseURL, "/calendario");
    // wait for hydration with a real interaction before pressing "n"
    await expect(async () => {
      await addLink(page).click();
      await expect(dialogOf(page)).toBeVisible({ timeout: 1000 });
    }).toPass();
    await closeWithEscape(page, /\/calendario$/);
    await page.keyboard.press("n");
    await page.waitForTimeout(300);
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });
});

test("notifyEventsChanged avvisa chi è iscritto, finché non annulla l'iscrizione", () => {
  const calls: string[] = [];
  const g = globalThis as { window?: unknown };
  const previous = g.window;
  g.window = new EventTarget();
  try {
    const stop = subscribeEventsChanged(() => calls.push("a"));
    notifyEventsChanged();
    expect(calls).toEqual(["a"]);
    stop();
    notifyEventsChanged();
    expect(calls).toEqual(["a"]);
  } finally {
    g.window = previous;
  }
});
