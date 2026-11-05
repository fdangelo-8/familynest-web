import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  failRequests,
  FULL,
  holdRequests,
  isMobileProject,
  PINNED_READ,
  toast,
  withNest,
} from "../fixtures/esplora";
import {
  barPin,
  busyArea,
  h1,
  INTEREST_READ,
  MEMBERS_READ,
  notifyButton,
  openSpace,
  SPACE_PATH,
} from "../fixtures/esplora-spazio-visivo";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Esplora · «In arrivo» (#29): axe on every state (serious and critical),
// keyboard order, visible focus, 44 px touch areas on mobile and the
// coordinator's decisions (no pin on desktop, «← Esplora» centred).
// Every test uses a throwaway Nest.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
}

async function focusRingVisible(page: Page) {
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

test("axe: normale (A tavola, fissato)", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.pinAll(["A tavola"]);
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test("axe: conferma con il toast e avviso tolto", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    await notifyButton(page).click();
    await expect(notifyButton(page)).toHaveText("Ti avvisiamo appena è pronto");
    await expect(toast(page)).toContainText("Ti avvisiamo quando A tavola");
    expect(await seriousViolations(page)).toEqual([]);
    await notifyButton(page).click();
    await expect(toast(page)).toContainText("Non ti avvisiamo più per");
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test("axe: caricamento (Crescere, con i nomi da leggere)", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    const holdPins = await holdRequests(page, PINNED_READ);
    const holdMembers = await holdRequests(page, MEMBERS_READ);
    try {
      await page.goto(SPACE_PATH("crescere"), { waitUntil: "commit" });
      await expect(h1(page)).toHaveText("Crescere");
      await expect(busyArea(page)).toHaveCount(1);
      expect(await seriousViolations(page)).toEqual([]);
    } finally {
      holdPins.release();
      holdMembers.release();
    }
  });
});

test("axe: errore di lettura", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await failRequests(page, INTEREST_READ);
    await page.goto(SPACE_PATH("a-tavola"));
    await expect(
      page.getByRole("alert").filter({ hasText: "Non riusciamo a caricare" }),
    ).toBeVisible({ timeout: 20_000 });
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test("axe: Crescere senza lista e pagina non trovata", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openSpace(page, "crescere", "Crescere");
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto(SPACE_PATH("non-esiste"));
    await expect(
      page.getByRole("heading", { name: /Questa pagina non c.è/ }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test("struttura: un solo h1, lista di tre voci, una sola puntina", async ({
  page,
  baseURL,
}, testInfo) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByText("In arrivo", { exact: true })).toBeVisible();
    await expect(page.locator("main ul.lista > li")).toHaveCount(3);
    // The pin: only on mobile (bar). On desktop there is none (coordinator).
    const pins = page.getByRole("button", { name: /(Fissa|Togli) A tavola/ });
    await expect(pins).toHaveCount(
      isMobileProject(testInfo.project.name) ? 1 : 0,
    );
    const back = page.getByRole("link", { name: "Esplora", exact: true });
    if (isMobileProject(testInfo.project.name)) {
      await expect(back).toBeHidden();
    } else {
      await expect(back).toBeVisible();
      await expect(back).toHaveAttribute("href", "/esplora");
    }
  });
});

test("desktop: «← Esplora» ha il testo centrato nella colonna", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), "solo desktop");
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    const back = page.getByRole("link", { name: "Esplora", exact: true });
    const box = (await back.boundingBox())!;
    const main = (await page.locator("main").boundingBox())!;
    expect(Math.round(box.width)).toBe(720);
    // The link is as wide as the column and its text sits in the middle.
    const text = await back.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    });
    expect(
      Math.abs(text.x + text.width / 2 - (box.x + box.width / 2)),
    ).toBeLessThan(2);
    expect(
      Math.abs(box.x + box.width / 2 - (main.x + main.width / 2)),
    ).toBeLessThan(2);
  });
});

test("tastiera: ordine del focus, anello visibile, nessuna trappola", async ({
  page,
  baseURL,
}, testInfo) => {
  const mobile = isMobileProject(testInfo.project.name);
  await withNest(FULL, async (nest) => {
    await nest.pinAll(["A tavola"]);
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    const names: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return (
          el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName
        );
      });
      names.push(name);
      expect(await focusRingVisible(page), `anello su «${name}»`).toBe(true);
      if (name === "Avvisami quando è pronto") break;
    }
    const at = (label: string) => names.findIndex((n) => n.includes(label));
    expect(at("Avvisami quando è pronto")).toBeGreaterThan(-1);
    if (mobile) {
      // Indietro -> puntina -> Avvisami (then the bottom navigation).
      expect(at("Indietro")).toBeGreaterThan(-1);
      expect(at("Togli A tavola da Oggi")).toBeGreaterThan(at("Indietro"));
      expect(at("Avvisami quando è pronto")).toBeGreaterThan(
        at("Togli A tavola da Oggi"),
      );
    } else {
      // Top navigation -> «← Esplora» -> Avvisami; never a pin.
      expect(at("Esplora")).toBeGreaterThan(-1);
      expect(at("Avvisami quando è pronto")).toBeGreaterThan(at("Esplora"));
      expect(names.some((n) => /Togli A tavola|Fissa A tavola/.test(n))).toBe(
        false,
      );
    }
    // Space on the button asks for the notice and the focus stays on it.
    await page.keyboard.press("Enter");
    await expect(notifyButton(page)).toHaveText("Ti avvisiamo appena è pronto");
    await expect(notifyButton(page)).toBeFocused();
  });
});

test("aree di tocco di almeno 44 px su mobile", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "solo mobile");
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    const targets = [
      page.getByRole("link", { name: "Indietro" }),
      barPin(page),
      notifyButton(page),
    ];
    for (const target of targets) {
      // The touch area may be larger than the drawing (pseudo-element ::before).
      const size = await target.evaluate((node) => {
        const before = getComputedStyle(node, "::before");
        const own = node.getBoundingClientRect();
        const w = Math.max(own.width, parseFloat(before.width) || 0);
        const h = Math.max(own.height, parseFloat(before.height) || 0);
        return { w, h };
      });
      expect(size.w).toBeGreaterThanOrEqual(44);
      expect(size.h).toBeGreaterThanOrEqual(44);
    }
  });
});

test("la puntina cambia nome e stato; il focus resta", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), "solo mobile");
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openSpace(page, "a-tavola", "A tavola");
    const pin = page.getByRole("button", { name: "Fissa A tavola in Oggi" });
    await expect(pin).toHaveAttribute("aria-pressed", "false");
    await pin.focus();
    await page.keyboard.press("Enter");
    const pressed = page.getByRole("button", {
      name: "Togli A tavola da Oggi",
    });
    await expect(pressed).toHaveAttribute("aria-pressed", "true");
    await expect(pressed).toBeFocused();
  });
});
