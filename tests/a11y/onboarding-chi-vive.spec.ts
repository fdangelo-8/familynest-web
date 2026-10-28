import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Accessibility of onboarding step 1 (#12), at 390 and 1280 px (the two
// projects): axe on every state, one visible h1, the radio group from the
// keyboard, visible focus, no repeated id. The user is C (no Nest); the
// request of "Continua" is aborted or answered by the test, so nothing is
// written. Skipped when the test users are not set up.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!usersConfigured("C"), skipReason("C"));

async function openAsC(page: Page, baseURL: string | undefined) {
  await signInAs(page.context(), baseURL as string, "C");
  await page.goto("/onboarding");
  await expect(page.locator("h1:visible")).toHaveText("Chi vive con te?");
}

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

const radios = (page: Page) =>
  page.getByRole("radio").filter({ visible: true });
const next = (page: Page) =>
  page.getByRole("button", { name: "Continua" }).filter({ visible: true });

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

const isAction = (route: {
  request(): { method(): string; headers(): Record<string, string> };
}) =>
  route.request().method() === "POST" &&
  "next-action" in route.request().headers();

async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name }).filter({ visible: true });
  await expect(async () => {
    await radio.click({ timeout: 2000 });
    await expect(radio).toHaveAttribute("aria-checked", "true", {
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
}

test.describe("onboarding · chi vive con te · accessibilità", () => {
  test("«Solo io» scelto (3 tacche): axe", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    await choose(page, "Solo io");
    await expect(
      page
        .getByRole("progressbar", { name: "Passo 1 di 3" })
        .filter({ visible: true }),
    ).toBeVisible();
    await expectNoBlocking(page);
  });

  test("nessuna scelta: axe, un solo h1, id unici", async ({
    page,
    baseURL,
  }) => {
    await openAsC(page, baseURL);
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await expect(page.getByRole("radiogroup")).toHaveCount(1); // hidden layout is not exposed
    await expectNoBlocking(page);
    const duplicates = await page.evaluate(() => {
      const seen = new Map<string, number>();
      for (const el of document.querySelectorAll("[id]")) {
        seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
      }
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(duplicates).toEqual([]);
  });

  test("scelta fatta: axe", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    await choose(page, "In famiglia, con figli");
    await expectNoBlocking(page);
  });

  test("errore di rete: axe, l'avviso è un alert con Riprova", async ({
    page,
    baseURL,
  }) => {
    await openAsC(page, baseURL);
    await page.route("**/onboarding", (route) =>
      isAction(route) ? route.abort() : route.continue(),
    );
    await choose(page, "In coppia");
    await next(page).click();
    const notice = page.locator('.avviso--errore[role="alert"]:visible');
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("button", { name: "Riprova" })).toBeVisible();
    await expectNoBlocking(page);
  });

  test("errore del server: axe", async ({ page, baseURL }) => {
    await openAsC(page, baseURL);
    await page.route("**/onboarding", (route) =>
      isAction(route)
        ? route.fulfill({
            status: 200,
            contentType: "text/x-component",
            body: '0:{"a":"$@1","f":"","b":"x"}\n1:{"status":"error"}\n',
          })
        : route.continue(),
    );
    await choose(page, "In coppia");
    await next(page).click();
    await expect(
      page.locator('.avviso--errore[role="alert"]:visible'),
    ).toContainText("per un problema nostro");
    await expectNoBlocking(page);
  });

  test("invio in corso: axe, il bottone è aria-busy", async ({
    page,
    baseURL,
  }) => {
    await openAsC(page, baseURL);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/onboarding", async (route) => {
      if (!isAction(route)) return route.continue();
      await held;
      await route.abort();
    });
    await choose(page, "In coppia");
    await next(page).click();
    await expect(next(page)).toHaveAttribute("aria-busy", "true");
    await expectNoBlocking(page);
    release();
  });

  test("tastiera: gruppo radio, focus visibile, nessuna trappola", async ({
    page,
    baseURL,
  }) => {
    await openAsC(page, baseURL);
    const group = radios(page);
    await expect(group).toHaveCount(4);
    // Radios are the only stop of the group: the others are out of the Tab.
    await expect(group.nth(0)).toHaveAttribute("tabindex", "0");
    for (const i of [1, 2, 3]) {
      await expect(group.nth(i)).toHaveAttribute("tabindex", "-1");
    }
    // Enter the group with Tab (mobile: after "Indietro").
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
      if (await group.nth(0).evaluate((el) => el === document.activeElement)) {
        break;
      }
    }
    await expect(group.nth(0)).toBeFocused();
    expect(await focusRingVisible(page), "anello sulla prima risposta").toBe(
      true,
    );
    await page.keyboard.press("Space");
    await expect(group.nth(0)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowDown");
    await expect(group.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(group.nth(1)).toBeFocused();
    expect(await focusRingVisible(page), "anello dopo la freccia").toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect(group.nth(2)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await expect(group.nth(1)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(group.nth(0)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await expect(group.nth(3)).toHaveAttribute("aria-checked", "true");
    // Tab leaves the group, onto a control with a visible ring, and keeps going.
    const seen: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return "";
        return (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      });
      if (!name) break;
      seen.push(name);
      expect(await focusRingVisible(page), `anello su «${name}»`).toBe(true);
    }
    expect(seen[0]).not.toBe("");
    expect(seen).not.toContain("In coppia");
    expect(seen).toContain("Continua");
  });

  test("aree di tocco: scelte e Continua di almeno 44 px", async ({
    page,
    baseURL,
  }) => {
    await openAsC(page, baseURL);
    await choose(page, "In coppia");
    const targets = [...(await radios(page).all()), next(page)];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    // "Indietro": link on desktop (44 px), 40 px arrow on mobile as in the
    // mockup (the 44 px area is proposal 7 of #43, not approved): not checked.
    const back = page
      .getByRole("link", { name: "Indietro" })
      .filter({ visible: true });
    if (await back.count()) {
      const box = await back.first().boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
