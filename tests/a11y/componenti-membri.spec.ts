import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// #85: ColorChoice and MemberSheet (add, edit, invite, errors).

test.use({ reducedMotion: "reduce" });

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

const DEMO = "/design-system/membri";

test("a11y: pagina dei componenti dei membri", async ({ page }) => {
  await page.goto(DEMO);
  expect(await seriousViolations(page)).toEqual([]);
});

for (const [button, title] of [
  ["Aggiungi una persona o un animale", "Aggiungi una persona"],
  ["Modifica Sofia", "Modifica Sofia"],
  ["Invita qualcuno", "Invita qualcuno"],
] as const) {
  test(`a11y: foglio «${title}»`, async ({ page }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[id]")).map((n) => n.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
}

test("a11y: foglio con errori di campo e avviso di salvataggio", async ({
  page,
}) => {
  await page.goto(DEMO);
  await page.getByRole("button", { name: "Rete" }).click();
  await page
    .getByRole("button", { name: "Aggiungi una persona o un animale" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Aggiungi" }).click();
  await expect(
    dialog.getByText("Scrivi il nome per continuare."),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await dialog.getByLabel("Nome").fill("Rita");
  await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("a11y: colore preso nel frattempo, errore sul gruppo dei colori", async ({
  page,
}) => {
  await page.goto(DEMO);
  await page.getByRole("button", { name: "Colore preso" }).click();
  await page
    .getByRole("button", { name: "Aggiungi una persona o un animale" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Rita");
  await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
  await expect(dialog.getByRole("alert")).toContainText("appena preso");
  expect(await seriousViolations(page)).toEqual([]);
});
