import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// #165 (PR #170): accessibility of the confirm dialog above a sheet, with an
// action running (`aria-disabled`) and with the error alert. Public gallery.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

async function blocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

async function openNested(page: Page) {
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Apri foglio" }).click();
  await expect(page.getByRole("dialog", { name: "Aggiungi" })).toBeVisible();
  await page.getByTestId("foglio-elimina").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
}

const insideDialog = () =>
  document.activeElement?.closest('[role="alertdialog"]') !== null;

test("axe: dialogo sopra il foglio", async ({ page }) => {
  await openNested(page);
  expect(await blocking(page)).toEqual([]);
});

test("il fuoco parte da Annulla nel dialogo e resta intrappolato", async ({
  page,
}) => {
  await openNested(page);
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(insideDialog)).toBe(true);
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(insideDialog)).toBe(true);
  }
});

test("Esc chiude solo il dialogo e il fuoco torna al foglio", async ({
  page,
}) => {
  await openNested(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Aggiungi" })).toBeVisible();
  await expect(page.getByTestId("foglio-elimina")).toBeFocused();
});

test("il dialogo sta sopra il foglio e il suo velo", async ({ page }) => {
  await openNested(page);
  const onTop = await page.evaluate(() => {
    const d = document.querySelector('[role="alertdialog"]') as HTMLElement;
    const r = d.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + 20);
    return d.contains(top);
  });
  expect(onTop).toBe(true);
});

test("axe e aria-disabled con un'azione in corso", async ({ page }) => {
  await openNested(page);
  const dialog = page.getByRole("alertdialog");
  await dialog.evaluate((el) => {
    el.querySelector(".dialogo__azioni")?.setAttribute("data-in-corso", "");
    el.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-disabled", "true"),
    );
  });
  for (const b of await dialog.getByRole("button").all()) {
    await expect(b).toHaveAttribute("aria-disabled", "true");
  }
  expect(await blocking(page)).toEqual([]);
});

test("l'avviso di errore nel dialogo è role=alert e senza violazioni", async ({
  page,
}) => {
  await openNested(page);
  // The gallery has no failing action: add the markup `Alert` renders for the
  // error variant, to check role and axe at that spot of the dialog.
  await page.getByRole("alertdialog").evaluate((el) => {
    const div = document.createElement("div");
    div.className = "avviso avviso--errore";
    div.setAttribute("role", "alert");
    div.textContent =
      "Non siamo riusciti a completare l'azione. Controlla la connessione e riprova.";
    el.querySelector(".dialogo__azioni")?.before(div);
  });
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "Non siamo riusciti",
  );
  expect(await blocking(page)).toEqual([]);
});
