import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Accessibility of the public sign-in screens (#11), at 390 and 1280 px (the
// two projects): axe on every state, one visible h1, focus order and visible
// focus ring, no keyboard trap, touch targets of at least 44 px on mobile.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  // The stickers fade in: axe must not read half-transparent colors.
  reducedMotion: "reduce",
});

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

async function expectOneH1(page: Page) {
  await expect(page.locator("h1:visible")).toHaveCount(1);
}

/** Name of the focused element, or "" when focus is on the page itself. */
function focusedName(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "";
    const label =
      el.getAttribute("aria-label") ??
      (el instanceof HTMLInputElement
        ? (document.querySelector(`label[for="${el.id}"]`)?.textContent ?? "")
        : el.textContent);
    return (label ?? "").trim();
  });
}

function focusRingVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      s.boxShadow !== "none"
    );
  });
}

/**
 * Presses Tab until focus leaves the page content or comes back to a stop
 * already seen (no trap). Every stop must show a focus ring.
 */
async function tabOrder(page: Page, max = 12) {
  const stops: string[] = [];
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const name = await focusedName(page);
    if (!name || stops.includes(name)) break;
    stops.push(name);
    expect(await focusRingVisible(page), `anello di focus su «${name}»`).toBe(
      true,
    );
  }
  return stops;
}

// Hydration may not be over when the page is first interactive: retry until
// the step has taken effect.
async function until(step: () => Promise<void>) {
  await expect(step).toPass({ timeout: 15_000 });
}

test.describe("/accesso", () => {
  test("stato normale: axe, un solo h1, ordine del focus", async ({ page }) => {
    await page.goto("/accesso");
    await expectOneH1(page);
    await expectNoBlocking(page);
    expect(await tabOrder(page)).toEqual([
      "Continua con Apple",
      "Continua con Google",
      "Usa la mail",
      "Termini d'uso",
      "Informativa sulla privacy",
    ]);
  });

  test("stato di errore: axe, avviso annunciato, Riprova per primo", async ({
    page,
  }) => {
    await page.goto("/accesso?errore=apple");
    await expectOneH1(page);
    const alert = page.locator(".avviso--errore:visible");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText(
      "Accesso con Apple non riuscito. Controlla la connessione e riprova.",
    );
    await expectNoBlocking(page);
    // The alert receives the focus on arrival; from there the order goes on.
    await expect(alert).toBeFocused();
    const order = await tabOrder(page);
    expect(order[0]).toBe("Riprova");
    expect(order).toEqual([
      "Riprova",
      "Continua con Apple",
      "Continua con Google",
      "Usa la mail",
      "Termini d'uso",
      "Informativa sulla privacy",
    ]);
  });

  test("stato di caricamento: axe con il bottone occupato", async ({
    page,
  }) => {
    // 204: the browser stays on the page, so the loading state stays too.
    await page.route("**/auth/v1/authorize**", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto("/accesso");
    // While the browser is being sent to the provider locators wait for that
    // navigation: the clicks and the state go straight through the DOM.
    const state = () =>
      page.evaluate(() => {
        const button = [
          ...document.querySelectorAll<HTMLButtonElement>("main button"),
        ].find(
          (b) => b.offsetParent !== null && /Google/.test(b.textContent ?? ""),
        );
        button?.click();
        return {
          text: (button?.textContent ?? "").trim(),
          busy: button?.getAttribute("aria-busy"),
        };
      });
    // Not hydrated yet: the first clicks do nothing, so retry.
    await until(async () => {
      expect(await state()).toEqual({
        text: "Accesso con Google in corso",
        busy: "true",
      });
    });
    await expectNoBlocking(page);
  });
});

for (const [route, h1] of [
  ["/termini", "Termini d'uso"],
  ["/privacy", "Informativa sulla privacy"],
] as const) {
  test.describe(route, () => {
    test("axe, un solo h1, ordine del focus", async ({ page }) => {
      await page.goto(route);
      await expectOneH1(page);
      await expect(page.locator("h1:visible")).toHaveText(h1);
      await expectNoBlocking(page);
      expect(await tabOrder(page)).toEqual(["Torna all'accesso"]);
    });
  });
}

// The pages with the mail and password forms (#327) have controls whose touch
// area is wider than their box (selector, links): they are measured with
// elementFromPoint in tests/a11y/accesso-password.spec.ts.
test.describe("aree di tocco su mobile", () => {
  for (const route of [
    "/accesso",
    "/accesso?errore=google",
    "/accesso/link-scaduto",
    "/termini",
    "/privacy",
  ]) {
    test(`${route}: controlli di almeno 44 px`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "solo mobile");
      await page.goto(route);
      await expectOneH1(page);
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            "main a, main button, main input",
          ),
        ]
          .filter((el) => el.offsetParent !== null)
          // Links inside a sentence are exempt (WCAG 2.5.5 «in linea»).
          .filter(
            (el) => !el.closest("p.legale, p.t-nota, p.intestazione__sotto"),
          )
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              name: (
                el.getAttribute("aria-label") ??
                el.textContent ??
                ""
              ).trim(),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          // «Indietro» is 40 px as in the mockup (widening is proposal 7 of #43).
          .filter((e) => e.name !== "Indietro")
          .filter((e) => e.w < 44 || e.h < 44),
      );
      expect(small).toEqual([]);
    });
  }
});
