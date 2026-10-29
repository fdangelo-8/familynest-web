import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  greeting,
  memberNameFor,
  nestNameFor,
} from "../../src/components/onboarding/names";

// Onboarding step 1 (#12). CA-1 needs no users; the tests with C (Chiara, no
// Nest) are skipped when the test users are not configured. Nothing here
// presses "Continua" or "Indietro": C must keep no Nest (those cases need
// throwaway users, covered by the functional tester).

const QUESTION = "Chi vive con te?";
const TITLES = [
  "Solo io",
  "In coppia",
  "In famiglia, con figli",
  "Con coinquilini",
];
const INFOS = [
  "Per organizzare le tue cose",
  "Tu e il tuo partner",
  "Si attivano scuola e profili dei figli",
  "Spesa e spese di casa in comune",
];

test("CA-1: senza sessione /onboarding porta a /accesso", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/accesso$/);
});

test.describe("regole dei nomi (§4)", () => {
  test("nome, cognome, nome del Nest e saluto", () => {
    expect(nestNameFor("Ilaria De Santis")).toBe("Casa De Santis");
    expect(memberNameFor("Ilaria De Santis")).toBe("Ilaria");
    expect(nestNameFor("  Marco   D'Angelo ")).toBe("Casa D'Angelo");
    expect(nestNameFor("Ilaria")).toBe("Casa di Ilaria");
    expect(nestNameFor("")).toBe("Casa mia");
    expect(nestNameFor(null)).toBe("Casa mia");
    expect(memberNameFor("")).toBe("Io");
    expect(greeting("Chiara Neri")).toBe("Ciao Chiara");
    expect(greeting("")).toBe("Ciao");
  });

  test("CA-13: limiti di 40 e 60 caratteri", () => {
    const name = `${"a".repeat(45)} ${"b".repeat(70)}`;
    expect(memberNameFor(name)).toBe("a".repeat(40));
    const nest = nestNameFor(name);
    expect(nest).toHaveLength(60);
    expect(nest.startsWith("Casa b")).toBe(true);
  });
});

async function openAsC(page: Page, baseURL: string | undefined, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await signInAs(page.context(), baseURL as string, "C");
  await page.goto("/onboarding");
}

for (const width of [390, 1280]) {
  test.describe(`con C a ${width} px`, () => {
    test.beforeEach(() => {
      test.skip(!usersConfigured("C"), skipReason("C"));
    });

    test("CA-3, CA-4, CA-5, CA-20: contenuto e stato vuoto", async ({
      page,
      baseURL,
    }) => {
      await openAsC(page, baseURL, width);
      await expect(page).toHaveTitle("FamilyNest · Chi vive con te?");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole("heading", { level: 1, name: QUESTION }),
      ).toBeVisible();
      await expect(
        page.locator("main .intestazione__sopra:visible"),
      ).toHaveText("Ciao Chiara");
      const progress = page.getByRole("progressbar", { name: "Passo 1 di 4" });
      await expect(progress).toBeVisible();
      await expect(progress).toHaveAttribute("aria-valuenow", "1");
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(0);

      const group = page.getByRole("radiogroup", { name: QUESTION });
      const radios = group.getByRole("radio");
      await expect(radios).toHaveCount(4);
      for (const [i, title] of TITLES.entries()) {
        await expect(radios.nth(i)).toHaveAccessibleName(title);
        await expect(radios.nth(i)).toHaveAccessibleDescription(INFOS[i]!);
        await expect(radios.nth(i)).toHaveAttribute("aria-checked", "false");
      }

      await expect(
        page.getByRole("button", { name: "Continua" }),
      ).toBeDisabled();
      await expect(page.locator("main .campo__aiuto:visible")).toBeVisible();
      await expect(page).toHaveURL(/\/onboarding$/);

      // No id is repeated in the DOM (one help paragraph per layout).
      const ids = await page
        .locator("[id]")
        .evaluateAll((els) => els.map((el) => el.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(await page.locator("main").innerText()).not.toMatch(/Pediatra/i);
      expect(await page.locator("main").textContent()).not.toMatch(/Pediatra/i);
    });

    test("CA-6: cambiare scelta", async ({ page, baseURL }) => {
      await openAsC(page, baseURL, width);
      const group = page.getByRole("radiogroup", { name: QUESTION });
      const coppia = group.getByRole("radio", { name: "In coppia" });
      const coinquilini = group.getByRole("radio", { name: "Con coinquilini" });
      // Retry until the page is hydrated.
      await expect(async () => {
        await coppia.click();
        await expect(coppia).toHaveAttribute("aria-checked", "true", {
          timeout: 1000,
        });
      }).toPass();
      await coinquilini.click();
      await expect(coinquilini).toHaveAttribute("aria-checked", "true");
      await expect(coppia).toHaveAttribute("aria-checked", "false");
      await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "Continua" }),
      ).toBeEnabled();
      await expect(page.locator("main .campo__aiuto:visible")).toHaveCount(0);

      // CA-8: nothing is saved until "Continua".
      await page.reload();
      await expect(
        page
          .getByRole("radiogroup", { name: QUESTION })
          .locator('[aria-checked="true"]'),
      ).toHaveCount(0);
    });

    test("CA-7: tastiera", async ({ page, baseURL }) => {
      test.skip(width !== 390, "CA-7 si verifica a 390 px");
      await openAsC(page, baseURL, width);
      const group = page.getByRole("radiogroup", { name: QUESTION });
      const first = group.getByRole("radio").first();
      await expect(async () => {
        await first.focus();
        await page.keyboard.press("Space");
        await expect(first).toHaveAttribute("aria-checked", "true", {
          timeout: 1000,
        });
      }).toPass();
      const checkedTitle = async () =>
        group.locator('[aria-checked="true"] .scelta__titolo').textContent();
      const seen: (string | null)[] = [await checkedTitle()];
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("ArrowDown");
        seen.push(await checkedTitle());
      }
      expect(seen).toEqual([
        TITLES[0],
        TITLES[1],
        TITLES[2],
        TITLES[3],
        TITLES[0],
      ]);
      // Enter never chooses.
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      expect(await checkedTitle()).toBe(TITLES[1]);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Continua" }),
      ).toBeFocused();
    });
  });
}

test("CA-2: chi ha già un Nest va a /oggi", async ({ page, baseURL }) => {
  test.skip(!usersConfigured("A"), skipReason("A"));
  await signInAs(page.context(), baseURL as string, "A");
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/oggi$/);
});
