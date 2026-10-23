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
}, info) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/accesso$/);
  await expect(page.locator("h1:visible")).toHaveText(
    info.project.name === "mobile"
      ? /La casa,\s*in un posto solo\./
      : "Entra in FamilyNest",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("accesso.png");
});

// Without a session /onboarding sends to /accesso (#11).
test("screenshot di /onboarding senza accesso (porta ad /accesso)", async ({
  page,
}, info) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/accesso$/);
  await expect(page.locator("h1:visible")).toHaveText(
    info.project.name === "mobile"
      ? /La casa,\s*in un posto solo\./
      : "Entra in FamilyNest",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("onboarding.png");
});
