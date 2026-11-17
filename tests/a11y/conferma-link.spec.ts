import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { waitHydrated } from "../fixtures/invito-ingresso";
import {
  caseVisitor,
  removeShared,
  signIn,
  waitBusyButton,
} from "../visual/invito-ingresso-helpers";

// Accessibility of the link of the confirmation mail (#419), visual tester:
// axe on every state of «Conferma il tuo indirizzo» (`/auth/confirm?type=email`)
// and of «Mail confermata», one h1, no duplicate id, focus order of the
// specification (§4 of the designer), visible focus, no trap, touch areas of
// 44 px on mobile, roles of the notice. The line of the account on «Il tuo
// colore» is in invito-ingresso-visivo.spec.ts. Skipped without the keys.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);
test.afterAll(removeShared);

const LINK = "/auth/confirm?type=email&token_hash=link-di-prova";
const isMobile = () => test.info().project.name === "mobile";

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

async function expectStructure(page: Page) {
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  const dup = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dup).toEqual([]);
  // No positive tabindex anywhere.
  const positive = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll("[tabindex]")).filter(
        (e) => Number(e.getAttribute("tabindex")) > 0,
      ).length,
  );
  expect(positive).toBe(0);
}

/** The four corners of a 44 x 44 box around the control reach the control. */
async function expectTouchArea(locator: Locator, what: string) {
  await locator.scrollIntoViewIfNeeded();
  const result = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const misses: string[] = [];
    for (const [dx, dy] of [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ] as const) {
      const hit = document.elementFromPoint(cx + dx, cy + dy);
      if (!hit || !(el === hit || el.contains(hit))) {
        misses.push(`${dx},${dy} -> ${hit?.tagName}.${hit?.className}`);
      }
    }
    return { width: r.width, height: r.height, misses };
  });
  const bigEnough = result.width >= 44 && result.height >= 44;
  expect(
    bigEnough || result.misses.length === 0,
    `${what}: ${Math.round(result.width)}x${Math.round(result.height)} px, area di 44 px non raggiunta (${result.misses.join("; ")})`,
  ).toBe(true);
}

/** Focus ring of the element in focus (outline or shadow). */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    const outline =
      cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow !== "none";
    return {
      name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
      visible: outline || shadow,
    };
  });
}

/** Tabs through the page: names in order, a ring on each, then no trap. */
async function expectKeyboard(page: Page, expected: string[]) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  const seen: string[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    await page.keyboard.press("Tab");
    const ring = await focusRing(page);
    seen.push(ring.name);
    expect(ring.visible, `anello su ${ring.name}`).toBe(true);
  }
  expect(seen).toEqual(expected);
  // One more Tab leaves the last control (no trap).
  await page.keyboard.press("Tab");
  const after = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  expect(after).not.toBe(expected[expected.length - 1]);
}

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });
const confirmButton = (page: Page) =>
  page.getByRole("button", { name: "Conferma l'indirizzo", exact: true });
const stayLink = (page: Page) =>
  page.getByRole("link", { name: "Resta con questo account", exact: true });
const leaveButton = (page: Page) =>
  page.getByRole("button", { name: "Non sei tu? Esci", exact: true });

async function openConfirm(page: Page) {
  await page.goto(LINK);
  await expect(heading(page, "Conferma il tuo indirizzo")).toBeVisible();
  // Scripts loaded: before that a click is a native submit, with no loading state.
  await waitHydrated(confirmButton(page));
}

async function openConfirmed(page: Page, baseURL: string | undefined) {
  await signIn(page, baseURL, await caseVisitor("mockup"));
  await page.goto("/accesso/mail-confermata");
  await expect(heading(page, "Mail confermata")).toBeVisible();
  await waitHydrated(leaveButton(page));
}

test.describe("conferma del link · «Conferma il tuo indirizzo» · accessibilità", () => {
  test("senza sessione: axe, un h1, nessun avviso, un solo controllo", async ({
    page,
  }) => {
    await openConfirm(page);
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(page).toHaveTitle("FamilyNest · Conferma dell'indirizzo");
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Indietro" })).toHaveCount(0);
    // The form is a real form that posts to the route (works without scripts).
    const form = page.locator("form#accesso-conferma-modulo");
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/auth/confirm");
  });

  test("senza sessione, tastiera: un solo stop con l'anello, nessuna trappola, area di tocco", async ({
    page,
  }) => {
    await openConfirm(page);
    await expectKeyboard(page, ["Conferma l'indirizzo"]);
    if (isMobile()) {
      await expectTouchArea(confirmButton(page), "Conferma l'indirizzo");
    }
  });

  test("sessione già aperta: axe, avviso role status con la mail in grassetto", async ({
    page,
    baseURL,
  }) => {
    const visitor = await caseVisitor("mockup");
    await signIn(page, baseURL, visitor);
    await openConfirm(page);
    await expect(stayLink(page)).toBeVisible();
    await expectNoBlocking(page);
    await expectStructure(page);
    const notice = page.getByRole("status");
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("In questo browser sei dentro con");
    await expect(notice.locator("b")).toHaveText(visitor.email);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("sessione già aperta, tastiera: ordine del fuoco, anello, nessuna trappola, aree di tocco", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await openConfirm(page);
    await expect(stayLink(page)).toBeVisible();
    await expectKeyboard(page, [
      "Conferma l'indirizzo",
      "Resta con questo account",
    ]);
    if (isMobile()) {
      await expectTouchArea(confirmButton(page), "Conferma l'indirizzo");
      await expectTouchArea(stayLink(page), "Resta con questo account");
    }
  });

  test("conferma in corso: axe, aria-busy, «Resta con questo account» spento", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, baseURL, await caseVisitor("mockup"));
    await page.route("**/auth/confirm", (route) =>
      route.request().method() === "POST"
        ? new Promise<void>(() => undefined)
        : route.continue(),
    );
    await openConfirm(page);
    await confirmButton(page).click({ noWaitAfter: true });
    await waitBusyButton(page, "Conferma in corso");
    await expect(
      page.getByRole("button", { name: "Conferma in corso", exact: true }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(stayLink(page)).toHaveAttribute("aria-disabled", "true");
    await expectNoBlocking(page);
  });
});

test.describe("conferma del link · «Mail confermata» · accessibilità", () => {
  test("normale: axe, un h1, la mail in grassetto, due controlli", async ({
    page,
    baseURL,
  }) => {
    const visitor = await caseVisitor("mockup");
    await openConfirmed(page, baseURL);
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(page).toHaveTitle("FamilyNest · Mail confermata");
    await expect(page.getByText("Accesso con la mail")).toBeVisible();
    await expect(page.getByTestId("account-attivo")).toContainText(
      "Per l'account",
    );
    await expect(
      page.getByTestId("account-attivo").locator("strong"),
    ).toHaveText(visitor.email);
    await expect(
      page.getByRole("link", { name: "Continua", exact: true }),
    ).toBeVisible();
    await expect(leaveButton(page)).toBeVisible();
    // The sign-out is a real POST (a GET does nothing).
    const form = page.locator('form[action="/auth/signout"]');
    await expect(form).toHaveAttribute("method", "post");
  });

  test("tastiera: Continua → Non sei tu? Esci, anello, nessuna trappola, aree di tocco", async ({
    page,
    baseURL,
  }) => {
    await openConfirmed(page, baseURL);
    await expectKeyboard(page, ["Continua", "Non sei tu? Esci"]);
    if (isMobile()) {
      await expectTouchArea(
        page.getByRole("link", { name: "Continua", exact: true }),
        "Continua",
      );
      await expectTouchArea(leaveButton(page), "Non sei tu? Esci");
    }
  });

  test("uscita in corso: axe, aria-busy, «Continua» spento", async ({
    page,
    baseURL,
  }) => {
    await page.route("**/auth/signout", (route) =>
      route.request().method() === "POST"
        ? new Promise<void>(() => undefined)
        : route.continue(),
    );
    await openConfirmed(page, baseURL);
    await leaveButton(page).click({ noWaitAfter: true });
    await waitBusyButton(page, "Uscita in corso");
    await expect(
      page.getByRole("button", { name: "Uscita in corso", exact: true }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("link", { name: "Continua", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    await expectNoBlocking(page);
  });

  test("senza sessione porta a /accesso", async ({ page }) => {
    await page.goto("/accesso/mail-confermata");
    await expect(page).toHaveURL(/\/accesso$/);
  });
});
