import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { waitHydrated } from "../fixtures/invito-ingresso";
import {
  caseVisitor,
  removeShared,
  signIn,
} from "../visual/invito-ingresso-helpers";

// Accessibility of the page of the button of the new-password link (#461,
// PR #484), `/accesso/conferma-recupero`: axe, one h1, one `main`, focus order
// and visible ring, no trap, touch area of 44 px on mobile, role of the notice
// with another session open, form that works without scripts.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.afterAll(removeShared);

const LINK = "/auth/confirm?type=recovery&token_hash=link-di-prova";
const isMobile = () => test.info().project.name === "mobile";

const button = (page: Page) =>
  page.getByRole("button", { name: "Scegli una nuova password", exact: true });
const stayLink = (page: Page) =>
  page.getByRole("link", { name: "Resta con questo account", exact: true });

async function openRecovery(page: Page) {
  await page.goto(LINK);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Hai chiesto una nuova password",
      exact: true,
    }),
  ).toBeVisible();
  await waitHydrated(button(page));
}

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
  const problems = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
    return {
      duplicates: ids.filter((id, i) => ids.indexOf(id) !== i),
      positive: Array.from(document.querySelectorAll("[tabindex]")).filter(
        (e) => Number(e.getAttribute("tabindex")) > 0,
      ).length,
    };
  });
  expect(problems).toEqual({ duplicates: [], positive: 0 });
}

/** The four corners of a 44 x 44 box around the control reach the control. */
async function expectTouchArea(
  page: Page,
  name: string,
  role: "button" | "link",
) {
  const locator = page.getByRole(role, { name, exact: true });
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
        misses.push(`${dx},${dy}`);
      }
    }
    return { width: r.width, height: r.height, misses };
  });
  expect(
    (result.width >= 44 && result.height >= 44) || result.misses.length === 0,
    `${name}: ${Math.round(result.width)}x${Math.round(result.height)} px, area di 44 px non raggiunta`,
  ).toBe(true);
}

/** Tabs through the page: names in order, a ring on each, then no trap. */
async function expectKeyboard(page: Page, expected: string[]) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  const seen: string[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        name: el.textContent?.trim() ?? "",
        visible:
          (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
          cs.boxShadow !== "none",
      };
    });
    seen.push(ring.name);
    expect(ring.visible, `anello su ${ring.name}`).toBe(true);
  }
  expect(seen).toEqual(expected);
  await page.keyboard.press("Tab");
  const after = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? "",
  );
  expect(after).not.toBe(expected[expected.length - 1]);
}

test.describe("conferma-recupero · accessibilità", () => {
  test("senza sessione: axe, un h1, nessun avviso, form che funziona senza script", async ({
    page,
  }) => {
    await openRecovery(page);
    await expectNoBlocking(page);
    await expectStructure(page);
    await expect(page.locator(".avviso")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Indietro" })).toHaveCount(0);
    const form = page.locator("form#accesso-recupero-modulo");
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/auth/recupero");
  });

  test("senza sessione, tastiera: un solo stop con l'anello, nessuna trappola, area di tocco", async ({
    page,
  }) => {
    await openRecovery(page);
    await expectKeyboard(page, ["Scegli una nuova password"]);
    if (isMobile()) {
      await expectTouchArea(page, "Scegli una nuova password", "button");
    }
  });

  test("in corso: bottone con aria-busy e nome «Apertura in corso»", async ({
    page,
  }) => {
    await page.route("**/auth/recupero", (route) =>
      route.request().method() === "POST"
        ? route.abort("aborted")
        : route.continue(),
    );
    await openRecovery(page);
    await button(page).click({ noWaitAfter: true });
    const busy = page.getByRole("button", {
      name: "Apertura in corso",
      exact: true,
    });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expectNoBlocking(page);
  });

  test("sessione già aperta: axe, avviso role status con la mail in grassetto, ordine del fuoco", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    const visitor = await caseVisitor("mockup");
    await signIn(page, baseURL, visitor);
    await openRecovery(page);
    await expect(stayLink(page)).toBeVisible();
    await expectNoBlocking(page);
    await expectStructure(page);
    const notice = page.getByRole("status");
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("In questo browser sei dentro con");
    await expect(notice.locator("b")).toHaveText(visitor.email);
    await expectKeyboard(page, [
      "Scegli una nuova password",
      "Resta con questo account",
    ]);
    if (isMobile()) {
      await expectTouchArea(page, "Scegli una nuova password", "button");
      await expectTouchArea(page, "Resta con questo account", "link");
    }
  });
});
