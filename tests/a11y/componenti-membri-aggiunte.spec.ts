import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  signInAs,
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";

// Added by the functional tester for #85 (PR #94): more states of the shared
// parts, the page of /esplora, focus ring and touch targets.

test.use({ reducedMotion: "reduce" });

const DEMO = "/design-system/membri";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

function withUser(...users: TestUserKey[]) {
  test.skip(!usersConfigured(...users), skipReason(...users));
}

test("a11y: Esplora (A)", async ({ page, baseURL }) => {
  withUser("A");
  await signInAs(page.context(), baseURL as string, "A");
  await page.goto("/esplora");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Cosa può fare la vostra casa",
    }),
  ).toBeVisible();
  await expect(page.locator("ul.griglia-moduli:visible > li")).toHaveCount(10, {
    timeout: 20_000,
  });
  expect(await seriousViolations(page)).toEqual([]);
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[id]")).map((n) => n.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

for (const [outcome, text] of [
  ["Server", "problema nostro"],
  ["Al completo", "Il Nest è al completo"],
] as const) {
  test(`a11y: foglio di aggiunta con l'avviso «${outcome}»`, async ({
    page,
  }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: outcome, exact: true }).click();
    await page
      .getByRole("button", { name: "Aggiungi una persona o un animale" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Rita");
    await dialog.getByRole("button", { name: "Aggiungi Rita" }).click();
    await expect(dialog.getByRole("alert")).toContainText(text);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("a11y: foglio di invito con errore sul nome", async ({ page }) => {
  await page.goto(DEMO);
  await page.getByRole("button", { name: "Invita qualcuno" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continua" }).click();
  await expect(
    dialog.getByText("Scrivi il nome per continuare."),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("a11y: foglio con «Animale» e data compilata", async ({ page }) => {
  await page.goto(DEMO);
  await page
    .getByRole("button", { name: "Aggiungi una persona o un animale" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Animale" }).click();
  await dialog.getByLabel("Data di nascita").fill("2020-04-02");
  expect(await seriousViolations(page)).toEqual([]);
});

test("a11y: la scelta del colore mostra l'anello del fuoco da tastiera", async ({
  page,
}) => {
  await page.goto(DEMO);
  const group = page.getByRole("radiogroup", { name: "Il tuo colore" });
  await group.getByRole("radio", { name: "Salvia" }).focus();
  await page.keyboard.press("ArrowRight");
  const focused = group.getByRole("radio", { name: "Cobalto" });
  await expect(focused).toBeFocused();
  // the chosen colour already has its own ring: compare focused and blurred
  const read = (el: Element) => {
    const style = getComputedStyle(el);
    return `${style.outlineStyle}|${style.outlineWidth}|${style.outlineColor}|${style.boxShadow}`;
  };
  const withFocus = await focused.evaluate(read);
  const withoutFocus = await focused.evaluate((el, readFn) => {
    (el as HTMLElement).blur();
    return new Function(`return (${readFn})`)()(el);
  }, read.toString());
  expect(withFocus).not.toBe(withoutFocus);
});

test("a11y: i bottoni del foglio hanno almeno 44 px di area di tocco", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Area di tocco: solo mobile");
  await page.goto(DEMO);
  await page
    .getByRole("button", { name: "Aggiungi una persona o un animale" })
    .click();
  const dialog = page.getByRole("dialog");
  for (const target of [
    dialog.getByRole("button", { name: "Chiudi" }),
    dialog.getByRole("button", { name: "Adulto" }),
    dialog.getByRole("button", { name: "Figlio o figlia" }),
    dialog.getByRole("button", { name: "Animale" }),
    dialog.getByRole("button", { name: "Aggiungi", exact: true }),
  ]) {
    // the area of a control is its box plus the invisible extension (::before)
    const area = await target.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const pseudo = getComputedStyle(el, "::before");
      const extra = (value: string) => {
        const n = parseFloat(value);
        return Number.isNaN(n) ? 0 : n;
      };
      return {
        width: Math.max(box.width, extra(pseudo.width)),
        height: Math.max(box.height, extra(pseudo.height)),
      };
    });
    expect(area.width).toBeGreaterThanOrEqual(44);
    expect(area.height).toBeGreaterThanOrEqual(44);
  }
});
