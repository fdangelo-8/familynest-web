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

const MARKER = "same-page";

/**
 * Opens Add from the "Aggiungi" link as a sheet over `route`. A click before
 * hydration makes the browser load `/aggiungi` from scratch (direct mode): a
 * marker set on `window` tells the two apart, and in that case the attempt
 * starts again from `route`. No timed waits.
 */
async function openAddOverPage(page: Page, route: string) {
  await expect(async () => {
    if (new URL(page.url()).pathname !== route) await page.goto(route);
    await expect(page.getByRole("main")).toBeVisible();
    await page.evaluate((value) => {
      (window as unknown as { __marker?: string }).__marker = value;
    }, MARKER);
    await addLink(page).click();
    await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
    const marker = await page.evaluate(
      () => (window as unknown as { __marker?: string }).__marker,
    );
    if (marker !== MARKER)
      throw new Error("page was reloaded, not intercepted");
  }).toPass();
}

/**
 * After a direct close Today loads as a normal page: wait for the load and
 * the real h1, then the first Tab goes to "Vai al contenuto".
 */
async function expectFirstTabOnSkipLink(page: Page) {
  await page.waitForURL(/\/oggi$/, { waitUntil: "load" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Oggi" }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Vai al contenuto" }),
  ).toBeFocused();
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
    const link = addLink(page);
    await openAddOverPage(page, "/calendario");
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
    await openAddOverPage(page, "/calendario");
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
    await openAddOverPage(page, "/calendario");
    await page.goBack();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("CA-5: aperta direttamente, /aggiungi mostra il foglio sopra Oggi; il velo porta a /oggi", async ({
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
    await expectFirstTabOnSkipLink(page);
  });
});

/**
 * Sends a keydown of "n" straight to `selector` and tells whether the shortcut
 * took it (it calls preventDefault only when it opens Add). Synchronous, so
 * "nothing happens" is checked without timed waits.
 */
async function shortcutTakesN(
  page: Page,
  selector: string,
  modifiers: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) {
  return page.evaluate(
    ([sel, mods]) => {
      const target = document.querySelector(sel as string);
      if (!target) throw new Error(`no element for ${String(sel)}`);
      const event = new KeyboardEvent("keydown", {
        key: "n",
        bubbles: true,
        cancelable: true,
        ...(mods as object),
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    },
    [selector, modifiers] as const,
  );
}

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
    // a dialog is open: "n" is not taken and nothing is added to the history
    const historyBefore = await page.evaluate(() => history.length);
    expect(await shortcutTakesN(page, "body")).toBe(false);
    await page.keyboard.press("n");
    await expect(dialogOf(page)).toHaveCount(1);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);
    await closeWithEscape(page, /\/calendario$/);

    // modifiers: Alt, Ctrl and Cmd never open it
    expect(await shortcutTakesN(page, "body", { altKey: true })).toBe(false);
    expect(await shortcutTakesN(page, "body", { ctrlKey: true })).toBe(false);
    expect(await shortcutTakesN(page, "body", { metaKey: true })).toBe(false);
    await page.keyboard.press("Alt+n");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);

    // with the focus in a text field: the letter is typed, nothing opens
    await page.goto("/casa/spesa");
    // the quick field is called "Cosa manca in casa?" while the list is empty
    const field = page.getByRole("textbox", {
      name: /^(Aggiungi alla spesa…|Cosa manca in casa\?)$/,
    });
    await expect(field).toBeVisible();
    await openWithN(page);
    await closeWithEscape(page, /\/casa\/spesa$/);
    await field.click();
    await expect(field).toBeFocused();
    expect(await shortcutTakesN(page, ":focus")).toBe(false);
    await page.keyboard.press("n");
    await expect(field).toHaveValue("n");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/casa\/spesa$/);
  });

  test("CA-7: su mobile «n» non apre Aggiungi", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Solo sotto 1024 px");
    await openPage(page, baseURL, "/calendario");
    // wait for hydration with a real interaction before pressing "n"
    await openAddOverPage(page, "/calendario");
    await closeWithEscape(page, /\/calendario$/);
    expect(await shortcutTakesN(page, "body")).toBe(false);
    await page.keyboard.press("n");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });
});

test.describe("Aggiungi sopra la pagina: altri casi", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-4: la X del foglio chiude e porta alla pagina di prima", async ({
    page,
    baseURL,
  }) => {
    await openPage(page, baseURL, "/calendario");
    await openAddOverPage(page, "/calendario");
    await dialogOf(page).getByRole("button", { name: "Chiudi" }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("CA-5: ricaricando con il foglio aperto, /aggiungi resta un foglio sopra Oggi", async ({
    page,
    baseURL,
  }) => {
    await openPage(page, baseURL, "/calendario");
    await openAddOverPage(page, "/calendario");
    await page.reload();
    await expect(dialogOf(page)).toBeVisible();
    await expect(page).toHaveURL(/\/aggiungi$/);
    await expect(page.locator("main h1")).toHaveText("Oggi");
  });

  test("CA-5: aperta direttamente, Esc porta a /oggi", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/aggiungi");
    await expect(dialogOf(page)).toBeVisible();
    await closeWithEscape(page, /\/oggi$/);
    await expectFirstTabOnSkipLink(page);
  });

  test("con il foglio aperto, Ctrl+K porta alla ricerca e il foglio sparisce", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Scorciatoia da tastiera");
    await openPage(page, baseURL, "/calendario");
    await openAddOverPage(page, "/calendario");
    await page.keyboard.press("Control+k");
    await expect(page).toHaveURL(/\/ricerca$/);
    await expect(dialogOf(page)).toHaveCount(0);
  });

  test("isolamento: l'utente del nucleo B apre Aggiungi sopra Oggi, la sua pagina", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B"), skipReason("B"));
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto("/aggiungi");
    await expect(dialogOf(page)).toBeVisible();
    await expect(page.locator("main h1")).toHaveText("Oggi");
  });
});

// The demo page needs no login: its member sheet is locked while it saves.
test.describe("Sheet bloccato", () => {
  test("durante il salvataggio la X ha aria-disabled e non chiude; a fine salvataggio il foglio si chiude", async ({
    page,
  }) => {
    await page.goto("/design-system/membri");
    await page.getByRole("button", { name: "Lento" }).click();
    await page
      .getByRole("button", { name: "Aggiungi una persona o un animale" })
      .click();
    const dialog = page.getByRole("dialog");
    const close = dialog.getByRole("button", { name: "Chiudi" });
    await expect(close).not.toHaveAttribute("aria-disabled", "true");
    await dialog.getByLabel("Nome").fill("Rita");
    const save = dialog.getByRole("button", { name: "Aggiungi Rita" });
    await save.click();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(close).toHaveAttribute("aria-disabled", "true");
    await close.click({ force: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCount(0);
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
