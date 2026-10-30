import { expect, test, type Page } from "@playwright/test";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import { NORMAL_TODOS, installTodosFake } from "../fixtures/todos-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Corrections 6-13 of #43 (#67): the states that the other visual specs do
// not show. At 390 and 1280 px (projects); the bar at 360 px (mobile only).
// "Accesso annullato" needs no user; the others need test user A and are
// skipped without TEST_USER_A_*. Clock fixed, motion reduced.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const START = new Date("2026-10-20T15:00:00+02:00");

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Take the pointer out of the picture (no hover state).
  await page.mouse.move(0, 0);
}

test.describe("accesso annullato", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: START });
  });

  test("accesso: avviso neutro con Google", async ({ page }) => {
    await page.goto("/accesso?errore=google&annullato=1");
    const notice = page.locator(".avviso--info:visible");
    await expect(notice).toContainText("Accesso con Google annullato.");
    await expect(notice).toBeFocused();
    await settle(page);
    await expect(page).toHaveScreenshot("accesso-annullato.png", {
      fullPage: true,
    });
  });
});

test.describe("cornice dell'app (utente A)", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
    await page.clock.setFixedTime(START);
    const signedIn = await signInAs(context, baseURL!, "A");
    test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  });

  test("«Vai al contenuto» con il fuoco", async ({ page }) => {
    await page.goto("/calendario");
    await expect(page.getByRole("main")).toBeVisible();
    await settle(page);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto" }),
    ).toBeFocused();
    await expect(page).toHaveScreenshot("vai-al-contenuto.png");
  });

  test("barra di Calendario a 360 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/calendario");
    await expect(page.getByRole("main")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("calendario-360.png");
  });

  test("barra di Casa a 360 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo mobile");
    await page.setViewportSize({ width: 360, height: 800 });
    // Casa · Spesa shows the shopping list: a fixed list, served by a fake (#21).
    await installSpesaFake(page, { items: NORMAL_LIST });
    await installTodosFake(page, { todos: NORMAL_TODOS });
    await page.goto("/casa/spesa");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByTestId("spesa-riga")).toHaveCount(7);
    await settle(page);
    await expect(page).toHaveScreenshot("casa-spesa-360.png");
  });
});
