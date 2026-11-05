import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { installFakes } from "../fixtures/aggiungi-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Aggiungi · Impegni, phase 2 (#171, PR #264): accessibility of the full form
// «Nuovo impegno» opened from the Add sheet, at 390 and 1280 px (projects):
// axe in every state, focus on opening and on return, order of the Tab, focus
// trapped and visible, touch areas of the entries. Needs test user A; nothing
// is written to the database (fakes of fixtures/aggiungi-fake.ts).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:52:00+02:00");
const PHRASE = "Nuoto Sofia giovedì alle 17";

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  await page.clock.install({ time: NOW });
});

function isDesktop(testInfo: { project: { name: string } }) {
  return testInfo.project.name === "desktop";
}

async function open(page: Page) {
  await page.goto("/aggiungi");
  const dialog = page.getByRole("dialog", { name: "Aggiungi" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  return { dialog, field };
}

async function openWithPhrase(page: Page, phrase = PHRASE) {
  const { dialog, field } = await open(page);
  await field.pressSequentially(phrase);
  const entry = dialog.getByRole("button", {
    name: /^(Più|Tutti i) dettagli$/,
  });
  await expect(entry).toBeVisible();
  return { dialog, field, entry };
}

function formOf(page: Page) {
  return page.getByRole("dialog", { name: "Nuovo impegno" });
}

async function blocking(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

/** Name of the element that has the focus, as a person would read it. */
function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "";
    const labels = (el as HTMLInputElement).labels;
    return (
      el.getAttribute("aria-label") ??
      labels?.[0]?.textContent?.trim() ??
      (el.textContent ?? "").trim()
    );
  });
}

/** True when the focus ring of the active element is drawn (outline or inner ring). */
function ringVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const style = getComputedStyle(el);
    const outline =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none";
    return outline || shadow;
  });
}

/** Points of a square of at least 44 px centered on the control that land elsewhere. */
async function missedPoints(control: Locator, min = 44) {
  const box = await control.boundingBox();
  if (!box) throw new Error("the control is not visible");
  const w = Math.max(box.width, min);
  const h = Math.max(box.height, min);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const points = [
    [cx, cy],
    [cx, cy - h / 2 + 2],
    [cx, cy + h / 2 - 2],
    [cx - w / 2 + 2, cy],
    [cx + w / 2 - 2, cy],
  ];
  return control.evaluate((el, pts) => {
    const missed: string[] = [];
    for (const [x, y] of pts as number[][]) {
      const hit = document.elementFromPoint(x!, y!);
      if (!hit || !(el === hit || el.contains(hit))) {
        missed.push(
          `(${Math.round(x!)}, ${Math.round(y!)}) -> ${hit ? `${hit.tagName.toLowerCase()}.${String(hit.className)}` : "nothing"}`,
        );
      }
    }
    return missed;
  }, points);
}

test.describe("Aggiungi · Impegni · modulo: axe", () => {
  test("frase con gli ingressi", async ({ page }) => {
    await installFakes(page);
    await openWithPhrase(page);
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("frase con errore del campo e ingressi attivi", async ({ page }) => {
    await installFakes(page);
    const { field } = await open(page);
    await field.pressSequentially("dentista giovedì");
    await field.press("Enter");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("modulo aperto", async ({ page }) => {
    await installFakes(page);
    const { entry } = await openWithPhrase(page);
    await entry.click();
    await expect(formOf(page)).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("modulo con errori dei campi", async ({ page }) => {
    await installFakes(page);
    const { entry } = await openWithPhrase(page, "Dentista 3/11/2030");
    await entry.click();
    const form = formOf(page);
    await form.getByLabel("Titolo").fill("");
    await form.getByRole("button", { name: /^Metti in / }).click();
    await expect(form.getByLabel("Titolo")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(form.getByLabel("Titolo")).toBeFocused();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("modulo, salvataggio in corso", async ({ page }) => {
    await installFakes(page, { save: "hold" });
    const { entry } = await openWithPhrase(page);
    await entry.click();
    const submit = formOf(page).getByRole("button", {
      name: "Metti in giovedì 22",
    });
    await submit.click();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });

  test("modulo, salvataggio non riuscito", async ({ page }) => {
    await installFakes(page, { save: "fail" });
    const { entry } = await openWithPhrase(page);
    await entry.click();
    const form = formOf(page);
    await form.getByRole("button", { name: "Metti in giovedì 22" }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    expect(await blocking(page, '[role="dialog"]')).toEqual([]);
  });
});

test.describe("Aggiungi · Impegni · modulo: fuoco e tastiera", () => {
  test("il fuoco entra nel titolo e torna sull'ingresso con Esc", async ({
    page,
  }) => {
    await installFakes(page);
    const { entry } = await openWithPhrase(page);
    await entry.click();
    const form = formOf(page);
    await expect(form.getByLabel("Titolo")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(formOf(page)).toHaveCount(0);
    await expect(entry).toBeFocused();
    expect(await ringVisible(page)).toBe(true);
  });

  test("ordine del Tab nel modulo e fuoco chiuso nel dialogo", async ({
    page,
  }) => {
    await installFakes(page);
    const { entry } = await openWithPhrase(page);
    await entry.click();
    const form = formOf(page);
    await expect(form.getByLabel("Titolo")).toBeFocused();
    const order: string[] = [await focused(page)];
    const submitName = "Metti in giovedì 22";
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const name = await focused(page);
      order.push(name);
      expect(await ringVisible(page)).toBe(true);
      // never outside the dialog
      expect(
        await page.evaluate(() =>
          document.activeElement?.closest('[role="dialog"]') ? true : false,
        ),
      ).toBe(true);
      if (name === submitName) break;
    }
    // Titolo → Giorno → Dalle → Alle → Si ripete → Dove → Chi → La porta → Chi lo vede → Note → submit
    const expected = ["Titolo", "Giorno", "Dalle", "Alle", "Si ripete", "Dove"];
    expect(order.slice(0, expected.length)).toEqual(expected);
    expect(order.at(-2)).toBe("Note");
    expect(order.at(-1)).toBe(submitName);
    // one more Tab wraps to the first control of the dialog, not out of it
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("Chiudi");
  });

  test("dalle righe il fuoco va sul campo giusto e torna sulla riga", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "le righe sono bottoni solo da 1024 px");
    await installFakes(page);
    const { dialog } = await openWithPhrase(page);
    const cases = [
      ["day", "Giorno"],
      ["people", "Tu"],
      ["escort", "Tu"],
      ["visibility", "Occupato"],
    ] as const;
    for (const [row, target] of cases) {
      const button = dialog.getByTestId(`aggiungi-ingresso-${row}`);
      await button.click();
      await expect(formOf(page)).toBeVisible();
      expect(await focused(page)).toBe(target);
      await page.keyboard.press("Escape");
      await expect(formOf(page)).toHaveCount(0);
      await expect(
        dialog.getByTestId(`aggiungi-ingresso-${row}`),
      ).toBeFocused();
    }
  });

  test("gli ingressi hanno nome accessibile uguale al testo visibile", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "le righe sono bottoni solo da 1024 px");
    await installFakes(page);
    const { dialog } = await openWithPhrase(page);
    for (const row of ["day", "people", "escort", "visibility"]) {
      const button = dialog.getByTestId(`aggiungi-ingresso-${row}`);
      await expect(button).not.toHaveAttribute("aria-label", /.+/);
    }
    await expect(
      dialog.getByRole("button", { name: /^Giovedì 22 ottobre/ }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Chi / })).toHaveCount(2);
    await expect(
      dialog.getByRole("button", { name: /^La porta / }),
    ).toBeVisible();
  });
});

test.describe("Aggiungi · Impegni · modulo: aree di tocco", () => {
  test("«Più dettagli» / «Tutti i dettagli», X e bottone del modulo", async ({
    page,
  }) => {
    await installFakes(page);
    const { entry } = await openWithPhrase(page);
    expect(await missedPoints(entry)).toEqual([]);
    const box = await entry.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await entry.click();
    const form = formOf(page);
    expect(
      await missedPoints(form.getByRole("button", { name: "Chiudi" })),
    ).toEqual([]);
    expect(
      await missedPoints(
        form.getByRole("button", { name: "Metti in giovedì 22" }),
      ),
    ).toEqual([]);
    // chips of the people and of the escort
    for (const chip of await form.getByRole("button", { name: "Tu" }).all()) {
      expect(await missedPoints(chip)).toEqual([]);
    }
  });

  test("righe del riepilogo (desktop) da 44 px", async ({ page }, testInfo) => {
    test.skip(!isDesktop(testInfo), "le righe sono bottoni solo da 1024 px");
    await installFakes(page);
    const { dialog } = await openWithPhrase(page);
    for (const row of ["day", "people", "escort", "visibility"]) {
      const button = dialog.getByTestId(`aggiungi-ingresso-${row}`);
      expect(await missedPoints(button)).toEqual([]);
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
