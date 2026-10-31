import { expect, test } from "@playwright/test";

// #165 (PR #170): confirm dialog above a sheet (`aboveSheet`) and the look of
// the buttons while an action is running (inactive buttons keep their look).
// Uses the public design-system gallery, no login needed.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  await page.goto("/design-system");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("h1")).toHaveText("Design system");
  await page.getByRole("button", { name: "Apri foglio" }).click();
  await expect(page.getByRole("dialog", { name: "Aggiungi" })).toBeVisible();
  await page.getByTestId("foglio-elimina").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.mouse.move(0, 0);
});

test("#165: dialogo di conferma sopra il foglio", async ({ page }) => {
  await expect(page).toHaveScreenshot("dialogo-sopra-foglio.png");
});

test("#165: dialogo con azione in corso, bottoni inattivi con lo stesso aspetto", async ({
  page,
}) => {
  const dialog = page.getByRole("alertdialog");
  const look = () =>
    dialog.getByRole("button").evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return {
          text: el.textContent,
          opacity: s.opacity,
          background: s.backgroundColor,
          color: s.color,
        };
      }),
    );
  const before = await dialog.screenshot();
  const lookBefore = await look();

  // What ConfirmDialog renders while an async action runs: marker on the
  // actions, `aria-disabled` on every button.
  await dialog.evaluate((el) => {
    el.querySelector(".dialogo__azioni")?.setAttribute("data-in-corso", "");
    el.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-disabled", "true"),
    );
  });
  const lookAfter = await look();
  expect(lookAfter).toEqual(lookBefore);
  for (const b of lookAfter) expect(b.opacity).toBe("1");
  expect(await dialog.screenshot()).toEqual(before);
  await expect(page).toHaveScreenshot("dialogo-azione-in-corso.png");
});
