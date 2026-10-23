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

const MAIL = "marco.dangelo@example.com";

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

async function fillAndSubmit(
  page: Page,
  value: string,
  done: () => Promise<void>,
) {
  await until(async () => {
    await page
      .getByLabel("La tua mail")
      .filter({ visible: true })
      .fill(value, { timeout: 2000 });
    await page
      .getByRole("button", { name: "Mandami il link" })
      .filter({ visible: true })
      .click({ timeout: 2000, noWaitAfter: true });
    await done();
  });
}

async function mockOtp(page: Page) {
  await page.route("**/auth/v1/otp**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

async function reachCheckMail(page: Page) {
  await mockOtp(page);
  await page.goto("/accesso/mail");
  await fillAndSubmit(page, MAIL, async () => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
    ).toBeVisible({ timeout: 2000 });
  });
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

test.describe("/accesso/mail", () => {
  test("inserimento: axe, un solo h1, ordine del focus", async ({
    page,
  }, info) => {
    await page.goto("/accesso/mail");
    await expectOneH1(page);
    await expectNoBlocking(page);
    const field = page.getByLabel("La tua mail").filter({ visible: true });
    if (info.project.name === "desktop") {
      // From 1024 px the field takes the focus on arrival.
      await expect(field).toBeFocused();
      expect(await tabOrder(page)).toEqual([
        "Mandami il link",
        "Torna all'accesso",
        "Termini d'uso",
        "Informativa sulla privacy",
      ]);
    } else {
      await expect(field).not.toBeFocused();
      expect(await tabOrder(page)).toEqual([
        "Indietro",
        "La tua mail",
        "Mandami il link",
        "Termini d'uso",
        "Informativa sulla privacy",
      ]);
    }
  });

  test("errore del campo: axe, aria-invalid e aria-describedby", async ({
    page,
  }) => {
    await mockOtp(page);
    await page.goto("/accesso/mail");
    const field = page.getByLabel("La tua mail").filter({ visible: true });
    await until(async () => {
      await page
        .getByRole("button", { name: "Mandami il link" })
        .filter({ visible: true })
        .click({ timeout: 2000, noWaitAfter: true });
      await expect(field).toHaveAttribute("aria-invalid", "true", {
        timeout: 1000,
      });
    });
    const describedBy = await field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(
      "Scrivi la tua mail per ricevere il link.",
    );
    await expectOneH1(page);
    await expectNoBlocking(page);
    // The focus goes to the wrong field.
    await expect(field).toBeFocused();
    expect(await focusRingVisible(page)).toBe(true);
  });

  test("errore di invio: axe con l'avviso", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (route) => route.abort("failed"));
    await page.goto("/accesso/mail");
    await fillAndSubmit(page, MAIL, async () => {
      await expect(page.locator(".avviso--errore:visible")).toBeVisible({
        timeout: 2000,
      });
    });
    await expect(page.locator(".avviso--errore:visible")).toHaveAttribute(
      "role",
      "alert",
    );
    await expectOneH1(page);
    await expectNoBlocking(page);
  });

  test("controlla la posta: axe, h1 con il focus, ordine del focus", async ({
    page,
  }, info) => {
    await reachCheckMail(page);
    await expectOneH1(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
    ).toBeFocused();
    await expectNoBlocking(page);
    // «Mandami un altro link» waits 60 seconds and is disabled: it is skipped.
    const order = await tabOrder(page);
    expect(order).toEqual(
      info.project.name === "desktop"
        ? ["Usa un'altra mail", "Torna all'accesso"]
        : ["Usa un'altra mail"],
    );
  });
});

test.describe("/accesso/link-scaduto", () => {
  test("axe, un solo h1, ordine del focus", async ({ page }) => {
    await page.goto("/accesso/link-scaduto");
    await expectOneH1(page);
    await expectNoBlocking(page);
    expect(await tabOrder(page)).toEqual([
      "Mandami un nuovo link",
      "Torna all'accesso",
    ]);
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

test.describe("aree di tocco su mobile", () => {
  for (const route of [
    "/accesso",
    "/accesso?errore=google",
    "/accesso/mail",
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
