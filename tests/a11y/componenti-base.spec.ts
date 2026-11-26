import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// #503 (F4a) CA-27: /design-system, /accesso, /oggi e /impostazioni aperti da
// Marco, axe senza violazioni serious o critical. Più il fuoco da tastiera
// sui componenti nuovi della galleria (CA-25) e i campi uniti con errore.

async function seriousViolations(page: Page) {
  await waitForAnimationsToEnd(page);
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

test.describe("Componenti 2.0 di base · axe", () => {
  test("CA-27: /design-system non ha violazioni serious o critical", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await expect(page.locator("#base-2")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("CA-27: /design-system con l'avviso offline in cima", async ({
    page,
  }) => {
    await page.goto("/design-system?avviso-offline=1");
    await expect(page.getByTestId("base-avviso-offline-alto")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("CA-27: /accesso non ha violazioni serious o critical", async ({
    page,
  }) => {
    await page.goto("/accesso");
    await expect(page.getByRole("main")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  for (const path of ["/oggi", "/impostazioni"]) {
    test(`CA-27: ${path} aperto da Marco non ha violazioni serious o critical`, async ({
      page,
      baseURL,
    }) => {
      test.skip(!usersConfigured("A"), skipReason("A"));
      await signInAs(page.context(), baseURL as string, "A");
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
        timeout: 20_000,
      });
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("la tastiera raggiunge ogni controllo nuovo della galleria con il fuoco visibile", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const section = page.locator("#base-2");
    await expect(section).toBeVisible();
    const stops = [
      section.getByRole("button", { name: "Salva", exact: true }).nth(0),
      section.getByLabel("Nome", { exact: true }).nth(0),
      section.getByRole("button", { name: "Mostra la password" }),
      section.getByRole("button", { name: /^Nuova scadenza/ }),
      section.getByRole("link", { name: "Indietro", exact: true }).nth(0),
      section.getByRole("link", { name: /^Impostazioni/ }),
      section.getByRole("button", { name: "Modifica Nome", exact: true }),
      section.getByRole("switch", { name: "Cose aggiunte alla spesa" }),
    ];
    // Tastiera: la modalità del fuoco diventa «da tastiera» (:focus-visible).
    await page.keyboard.press("Tab");
    for (const stop of stops) {
      await stop.focus();
      await expect(stop).toBeFocused();
      const ring = await stop.evaluate((el) => {
        const own = getComputedStyle(el);
        const box = el.closest(".campo__scatola");
        const boxShadow = box ? getComputedStyle(box).boxShadow : "none";
        return {
          outline:
            own.outlineStyle !== "none" && parseFloat(own.outlineWidth) > 0,
          inset: /inset/.test(own.boxShadow) || /inset/.test(boxShadow),
        };
      });
      const name = await stop.evaluate(
        (el) => el.getAttribute("aria-label") ?? el.textContent ?? el.tagName,
      );
      expect(ring.outline || ring.inset, `fuoco visibile su ${name}`).toBe(
        true,
      );
    }
  });
});
