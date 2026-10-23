import { expect, test } from "@playwright/test";

// `/` redirects to /oggi and then, without a session, to /accesso (client-side).
// The screenshot is taken only after the final URL and the final heading are
// there, so it never captures the empty shell shown during the redirect.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
});

test("screenshot della pagina di accesso (arrivando da /)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/accesso$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Accesso" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("accesso.png");
});

test("screenshot della pagina di onboarding", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { level: 1, name: "Chi vive con te?" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("onboarding.png");
});
