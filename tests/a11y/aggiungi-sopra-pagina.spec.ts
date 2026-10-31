import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// #164 (PR #167): accessibility of the Add sheet over the page. Focus trap and
// restore, accessible name, the X when the sheet is locked, the chip live region.
// Needs test user A (skipped with a reason otherwise) except the "locked" test,
// which uses the public design-system demo.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const DEMO = "/design-system/membri";

function dialogOf(page: Page) {
  return page.getByRole("dialog", { name: "Aggiungi" });
}

function addLink(page: Page) {
  return page.getByRole("link", { name: "Aggiungi", exact: true });
}

async function blocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

/** Opens Add from the link until it is intercepted (listener exists only after hydration). */
async function openFromLink(page: Page) {
  await expect(async () => {
    if (new URL(page.url()).pathname !== "/oggi") await page.goto("/oggi");
    await expect(page.getByRole("main")).toBeVisible();
    await addLink(page).focus();
    await page.keyboard.press("Enter");
    await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
}

test.describe("Aggiungi sopra la pagina", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
  });

  test("axe: foglio aperto sopra Oggi e aperto direttamente", async ({
    page,
  }) => {
    await page.goto("/oggi");
    await openFromLink(page);
    expect(await blocking(page)).toEqual([]);
    await page.goto("/aggiungi");
    await expect(dialogOf(page)).toBeVisible();
    expect(await blocking(page)).toEqual([]);
  });

  test("nome accessibile: dialogo modale chiamato «Aggiungi»", async ({
    page,
  }) => {
    await page.goto("/aggiungi");
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(
      dialog.getByRole("heading", { level: 2, name: "Aggiungi" }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Chiudi" })).toBeVisible();
  });

  test("fuoco: dentro il foglio, intrappolato con Tab e Maiusc+Tab", async ({
    page,
  }) => {
    await page.goto("/oggi");
    await openFromLink(page);
    const dialog = dialogOf(page);
    const inside = () =>
      dialog.evaluate((el) => el.contains(document.activeElement));
    await expect.poll(inside).toBe(true);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
    }
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await inside()).toBe(true);
    }
  });

  test("fuoco: alla chiusura con Esc torna sul link «Aggiungi»", async ({
    page,
  }) => {
    await page.goto("/oggi");
    await openFromLink(page);
    await page.keyboard.press("Escape");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(addLink(page)).toBeFocused();
  });

  test("fuoco: alla chiusura con «Chiudi» torna sul link «Aggiungi»", async ({
    page,
  }) => {
    await page.goto("/oggi");
    await openFromLink(page);
    await dialogOf(page).getByRole("button", { name: "Chiudi" }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(addLink(page)).toBeFocused();
  });

  test("fuoco: aperto direttamente, alla chiusura va su main (movimento ridotto)", async ({
    page,
  }) => {
    await page.goto("/aggiungi");
    await expect(dialogOf(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/oggi$/);
    // Loading and the page coexist for a moment: wait for the real Today page.
    await expect(
      page.getByRole("heading", { level: 1, name: "Oggi" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toBeFocused();
  });

  test.describe("con animazioni", () => {
    test.use({ reducedMotion: "no-preference" });
    test("fuoco: aperto direttamente, alla chiusura va su main (con animazioni)", async ({
      page,
    }) => {
      await page.goto("/aggiungi");
      await expect(dialogOf(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialogOf(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/oggi$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Oggi" }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toBeFocused();
    });
  });

  test("area di tocco della X almeno 44 px", async ({ page }) => {
    await page.goto("/aggiungi");
    const close = dialogOf(page).getByRole("button", { name: "Chiudi" });
    await expect(close).toBeVisible();
    const hit = await close.evaluate((el) => {
      const after = getComputedStyle(el, "::before");
      const r = el.getBoundingClientRect();
      return {
        w: Math.max(r.width, parseFloat(after.width) || 0),
        h: Math.max(r.height, parseFloat(after.height) || 0),
      };
    });
    expect(hit.w).toBeGreaterThanOrEqual(44);
    expect(hit.h).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Sheet: X bloccata e regione live dei chip", () => {
  test("con `locked` la X ha aria-disabled e non chiude", async ({ page }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Lento" }).click();
    await page
      .getByRole("button", { name: "Aggiungi una persona o un animale" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    const close = dialog.getByRole("button", { name: "Chiudi" });
    await expect(close).not.toHaveAttribute("aria-disabled", "true");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(
      dialog.getByRole("button", { name: "Aggiungi Rita" }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(close).toHaveAttribute("aria-disabled", "true");
    await close.click({ force: true });
    await expect(dialog).toBeVisible();
  });

  test("regione aria-live dei chip: vuota resta nel DOM e non occupa spazio", async ({
    page,
  }) => {
    // #20 fills the sheet with the chips; here the CSS rule of the shared work.
    await page.goto(DEMO);
    const result = await page.evaluate(() => {
      const group = document.createElement("div");
      group.className = "gruppo-chip";
      group.setAttribute("aria-live", "polite");
      document.body.append(group);
      const style = getComputedStyle(group);
      const out = {
        inDom: document.body.contains(group),
        position: style.position,
        live: group.getAttribute("aria-live"),
      };
      group.remove();
      return out;
    });
    expect(result).toEqual({
      inDom: true,
      position: "absolute",
      live: "polite",
    });
  });
});
