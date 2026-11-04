import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  oggiNow,
  installOggiFake,
  type OggiFakeOptions,
} from "../fixtures/oggi-visuale";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// Oggi (#30): axe in every state of the mockup 09-oggi.html, focus order and
// focus ring from the keyboard, touch areas on mobile. The data is served by a
// fake (fixtures/oggi-visuale.ts): nothing is written to the database. Test
// user A (Casa D'Angelo) is needed.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

/** The first visible match: the page has two layouts, one is always hidden. */
const shown = (page: Page, text: string | RegExp) =>
  page.getByText(text).locator("visible=true").first();

async function open(page: Page, options: OggiFakeOptions, ready = true) {
  await page.clock.setFixedTime(oggiNow(options.scenario));
  await installOggiFake(page, options);
  await page.goto("/oggi");
  await expect(page.getByRole("main")).toBeVisible();
  if (ready) {
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
      timeout: 20_000,
    });
  }
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }));
}

async function chooseNest(page: Page) {
  const lens = page.getByRole("group", {
    name: "Punto di vista: solo tu o tutto il Nest",
  });
  const nest = lens.getByRole("button", { name: /Nest$/ });
  await nest.click();
  await expect(nest).toHaveAttribute("aria-pressed", "true");
}

// --- axe, every state -----------------------------------------------------

test.describe("axe", () => {
  test("normale: lente «Io»", async ({ page }) => {
    await open(page, { scenario: "normale" });
    await expect(shown(page, "Call con Acme")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    // One visible h1: the greeting.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("normale: lente «Nest»", async ({ page }) => {
    await open(page, { scenario: "normale" });
    await chooseNest(page);
    await expect(shown(page, "Firmare autorizzazione gita")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("vuoto: il primo giorno", async ({ page }) => {
    await open(page, { scenario: "vuoto" });
    await expect(shown(page, "Giornata libera, per ora")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento", async ({ page }) => {
    await open(page, { scenario: "normale", events: "slow" }, false);
    await expect(
      page.locator('[aria-busy="true"]').locator("visible=true").first(),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore: offline", async ({ page, context }) => {
    await open(page, { scenario: "normale" });
    await context.setOffline(true);
    await expect(shown(page, /^Sei offline\./)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("conferma: cosa da fare spuntata", async ({ page }) => {
    await open(page, { scenario: "normale" });
    await page
      .getByRole("checkbox", {
        name: "Segna come fatto: Chiamare il commercialista",
      })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Fatto: Chiamare il commercialista" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("primo accesso di chi è stato invitato", async ({ page }) => {
    await open(page, { scenario: "invitato" });
    await expect(
      page.getByRole("region", { name: "La casa in una frase" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("per oggi è tutto", async ({ page }) => {
    await open(page, { scenario: "tutto-fatto" });
    await expect(shown(page, "Per oggi è tutto")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore di una parte: cose da fare", async ({ page }) => {
    await open(page, { scenario: "normale", todos: "error" });
    await expect(shown(page, "Call con Acme")).toBeVisible();
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore di tutta la pagina", async ({ page }) => {
    await open(page, { scenario: "normale", all: "error", events: "error" });
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible({ timeout: 30_000 });
    expect(await seriousViolations(page)).toEqual([]);
  });

  // The rows of «Già fatti» are at 50% of opacity until the shared request
  // #241 (colour of the secondary text): axe reports a contrast of less than
  // 4.5:1 (serious). Remove the fixme when #241 is merged.
  test("«Già fatti» aperto", async ({ page }) => {
    test.fixme(true, "attende #241");
    await open(page, { scenario: "normale" });
    await page.getByRole("button", { name: /^Già fatt/ }).click();
    await expect(
      page.getByRole("button", { name: /^Già fatt/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(await seriousViolations(page)).toEqual([]);
  });
});

// --- keyboard ---------------------------------------------------------------

test.describe("tastiera", () => {
  test("il fuoco attraversa la pagina in ordine, sempre visibile, senza trappole", async ({
    page,
  }, testInfo) => {
    await open(page, { scenario: "normale" });
    await expect(shown(page, "Call con Acme")).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.mouse.move(0, 0);

    const seen: Array<{
      name: string;
      top: number;
      inMain: boolean;
      ring: boolean;
    }> = [];
    let leftPage = false;
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        const outline =
          style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        const shadow = style.boxShadow !== "none";
        const parent = el.closest("[data-focus-ring], .campo-rapido");
        return {
          name:
            el.getAttribute("aria-label") ||
            (el.textContent ?? "").trim().slice(0, 40) ||
            el.tagName,
          top: Math.round(box.top + window.scrollY),
          inMain: el.closest("main") !== null,
          ring: outline || shadow || parent !== null,
          id: `${el.tagName}|${el.getAttribute("aria-label") ?? ""}|${(el.textContent ?? "").trim().slice(0, 40)}|${Math.round(box.top + window.scrollY)}`,
        };
      });
      if (info === null) {
        leftPage = true;
        break;
      }
      if (seen.some((s) => s.name === info.name && s.top === info.top)) {
        leftPage = true;
        break;
      }
      seen.push(info);
    }
    expect(seen.length).toBeGreaterThan(8);
    // No trap: the cycle comes back to the start (or to the browser).
    expect(leftPage).toBe(true);
    // Every focused element shows a ring.
    expect(seen.filter((s) => !s.ring).map((s) => s.name)).toEqual([]);
    // On mobile the content is one column: the focus goes top to bottom.
    if (testInfo.project.name === "mobile") {
      const tops = seen.filter((s) => s.inMain).map((s) => s.top);
      const sorted = [...tops].sort((a, b) => a - b);
      expect(tops).toEqual(sorted);
    }
  });
});

// --- touch areas (mobile) -------------------------------------------------

test.describe("aree di tocco", () => {
  test("ogni controllo ha almeno 44 × 44 px da toccare", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo su telefono");
    await open(page, { scenario: "normale" });
    await expect(shown(page, "Call con Acme")).toBeVisible();
    // The window as tall as the page: elementFromPoint only sees what is in view.
    const base = page.viewportSize()!;
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({
      width: base.width,
      height: Math.max(base.height, height),
    });
    const small = await page.evaluate(() => {
      const MIN = 44;
      const found: string[] = [];
      const targets = document.querySelectorAll<HTMLElement>(
        "main a[href], main button, main [role=checkbox], main input",
      );
      for (const el of targets) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        // Links inside a sentence (empty states) are exempt («in linea»).
        if (el.closest(".stato-vuoto__testo")) continue;
        // Where a touch really reaches the control (a transparent ::before
        // counts): sample around the box and take the box of the hits.
        const bigEnough = box.width >= MIN && box.height >= MIN;
        let ok = bigEnough;
        if (!bigEnough) {
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (let x = box.left - MIN; x <= box.right + MIN; x += 2) {
            for (let y = box.top - MIN; y <= box.bottom + MIN; y += 2) {
              const hit = document.elementFromPoint(x, y);
              if (hit !== null && el.contains(hit)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
              }
            }
          }
          ok = maxX - minX >= MIN - 2 && maxY - minY >= MIN - 2;
        }
        if (!ok) {
          found.push(
            `${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
          );
        }
      }
      return found;
    });
    expect(small).toEqual([]);
  });
});
