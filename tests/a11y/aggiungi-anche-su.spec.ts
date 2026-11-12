import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { installFakes } from "../fixtures/aggiungi-fake";
import { hasTestUser } from "../fixtures/visual-login";
import { signInAsCached } from "../fixtures/visual-login-cached";

// «Anche su …» nel modulo «Nuovo impegno» di Aggiungi (#304, PR #361): axe nella
// riga (spenta, accesa, da ricollegare) e negli avvisi (invio non riuscito,
// lettura del calendario non riuscita), nomi, tastiera e aree di tocco di 44 px
// a 390 e 1280 px (progetti). Serve l'utente di prova A; non si scrive nulla nel
// database: il salvataggio, la persona e il calendario sono finti
// (fixtures/aggiungi-fake.ts e le rotte di questo file).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const NOW = new Date("2026-10-20T15:52:00+02:00");
const PHRASE = "Nuoto Sofia giovedì alle 17";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

type Side = {
  /** The calendar chosen in «Dove vanno i nuovi impegni» */
  reconnect?: boolean;
  /** The reading of the calendar fails */
  readFails?: boolean;
  /** `set_event_also_on` fails: the event is saved, the sending is not */
  sendFails?: boolean;
};

test.beforeEach(async ({ context, baseURL, page }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
  await page.clock.install({ time: NOW });
});

/** The reads and the sending of «Anche su»: Google, «Personale». */
async function installAlsoOn(page: Page, side: Side = {}) {
  const answer = (route: Route, row: Record<string, unknown>) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (side.readFails) {
      return route.fulfill({ status: 500, json: { message: "boom" } });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/vnd.pgrst.object+json",
      headers: CORS,
      body: JSON.stringify(row),
    });
  };
  await page.route("**/rest/v1/external_calendars*", (route) =>
    answer(route, {
      name: "Personale",
      account_id: "ac000000-0000-4000-8000-0001",
    }),
  );
  await page.route("**/rest/v1/calendar_accounts*", (route) =>
    answer(route, {
      provider: "google",
      status: side.reconnect ? "reconnect" : "active",
    }),
  );
  if (side.sendFails) {
    await page.route("**/rest/v1/rpc/set_event_also_on*", (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      return route.fulfill({
        status: 500,
        headers: CORS,
        json: { code: "XX000", message: "fake failure" },
      });
    });
  }
}

function formOf(page: Page) {
  return page.getByRole("dialog", { name: "Nuovo impegno" });
}
const sw = (page: Page) =>
  page.getByRole("switch", { name: "Anche su Google", exact: true });

/** Opens the full form «Nuovo impegno» with the phrase. */
async function openForm(page: Page, side: Side = {}) {
  await installFakes(page);
  await installAlsoOn(page, side);
  await page.goto("/aggiungi");
  const dialog = page.getByRole("dialog", { name: "Aggiungi" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const field = dialog.getByRole("textbox", { name: "Cosa vuoi aggiungere?" });
  await expect(field).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  await field.pressSequentially(PHRASE);
  await dialog
    .getByRole("button", { name: /^(Più|Tutti i) dettagli$/ })
    .click();
  await expect(formOf(page)).toBeVisible();
  return formOf(page);
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

/** True when the 44 x 44 px square around the centre of the control hits it. */
async function hasTouchArea(target: Locator, size = 44) {
  await target.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  return target.evaluate((el, s) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = s / 2 - 1;
    const points = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
      [cx, cy],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit !== null && (hit === el || el.contains(hit));
    });
  }, size);
}

/** Outline or inner ring of the focused element, or «nessuno». */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "nessuno";
    const own = getComputedStyle(el);
    if (own.outlineStyle !== "none" && parseFloat(own.outlineWidth) > 0) {
      return "contorno";
    }
    if (/inset/.test(own.boxShadow)) return "interno";
    return "nessuno";
  });
}

/** Fills nothing: the phrase already gave the title and the time. */
async function save(form: Locator) {
  await form.getByRole("button", { name: /^Metti in / }).click();
}

const isMobile = (name: string) => name === "mobile";

test.describe("la riga «Anche su Google»", () => {
  test("axe: modulo con la riga spenta e accesa", async ({ page }) => {
    const form = await openForm(page);
    await expect(sw(page)).toHaveAttribute("aria-checked", "false");
    expect(await seriousViolations(page)).toEqual([]);
    await sw(page).click();
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
    expect(await seriousViolations(page)).toEqual([]);
    await expect(form).toContainText("Nel calendario Personale");
  });

  test("axe: modulo con il calendario da ricollegare", async ({ page }) => {
    const form = await openForm(page, { reconnect: true });
    await expect(sw(page)).toBeDisabled();
    await expect(form).toContainText(
      "Google non si sincronizza: ricollegalo da Calendari collegati.",
    );
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("nomi: l'interruttore si chiama «Anche su Google» e ha l'info come descrizione", async ({
    page,
  }) => {
    await openForm(page);
    await expect(sw(page)).toHaveAccessibleDescription(
      "Nel calendario Personale",
    );
  });

  test("tastiera: con Tab si passa da «Chi lo vede» all'interruttore, che ha il fuoco visibile", async ({
    page,
  }) => {
    const form = await openForm(page);
    const choices = form
      .getByRole("group", { name: "Chi lo vede", exact: true })
      .getByRole("button");
    await choices.last().focus();
    await page.keyboard.press("Tab");
    await expect(sw(page)).toBeFocused();
    expect(await focusRing(page)).not.toBe("nessuno");
    await page.keyboard.press("Space");
    await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  });

  test.describe("aree di tocco di almeno 44 px (mobile)", () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
    });

    test("interruttore «Anche su Google»", async ({ page }) => {
      await openForm(page);
      expect(await hasTouchArea(sw(page))).toBe(true);
    });
  });
});

test.describe("avviso: invio non riuscito", () => {
  async function failedSend(page: Page) {
    const form = await openForm(page, { sendFails: true });
    await sw(page).click();
    await save(form);
    const notice = page.getByTestId("anche-su-errore");
    await expect(notice).toBeVisible();
    return { form, notice };
  }

  test("axe: avviso con «Riprova» dentro il foglio", async ({ page }) => {
    const { notice } = await failedSend(page);
    await expect(notice).toHaveAttribute("role", "alert");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("tastiera: il fuoco è su «Riprova» e da «Chiudi» con Tab ci si arriva, con il fuoco visibile", async ({
    page,
  }) => {
    const { form, notice } = await failedSend(page);
    const retry = notice.getByRole("button", { name: "Riprova" });
    await expect(retry).toBeFocused();
    // Reached with the keyboard (a scripted focus after a click shows no ring)
    await page.keyboard.press("Shift+Tab");
    await expect(form.getByRole("button", { name: "Chiudi" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(retry).toBeFocused();
    expect(await focusRing(page)).not.toBe("nessuno");
  });

  test("aree di tocco: «Riprova» e «Chiudi» da 44 px (mobile)", async ({
    page,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
    const { form, notice } = await failedSend(page);
    expect(
      await hasTouchArea(notice.getByRole("button", { name: "Riprova" })),
    ).toBe(true);
    expect(
      await hasTouchArea(form.getByRole("button", { name: "Chiudi" })),
    ).toBe(true);
  });
});

test.describe("avviso: lettura del calendario non riuscita", () => {
  // The reading is repeated by the client before it gives up: wait for it.
  async function failedRead(page: Page) {
    const form = await openForm(page, { readFails: true });
    const notice = page.getByTestId("anche-su-lettura-errore");
    await expect(notice).toBeVisible({ timeout: 30_000 });
    return { form, notice };
  }

  test("axe: avviso in fondo al modulo, con «Riprova»", async ({ page }) => {
    const { notice } = await failedRead(page);
    await expect(notice).toHaveAttribute("role", "alert");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("tastiera: «Riprova» si raggiunge con Tab da «Note» e ha il fuoco visibile", async ({
    page,
  }) => {
    const { form, notice } = await failedRead(page);
    const retry = notice.getByRole("button", { name: "Riprova" });
    await form.getByLabel("Note", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(retry).toBeFocused();
    expect(await focusRing(page)).not.toBe("nessuno");
    // Then the button that saves
    await page.keyboard.press("Tab");
    await expect(
      form.getByRole("button", { name: /^Metti in / }),
    ).toBeFocused();
  });

  test("area di tocco: «Riprova» da 44 px (mobile)", async ({
    page,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
    const { notice } = await failedRead(page);
    expect(
      await hasTouchArea(notice.getByRole("button", { name: "Riprova" })),
    ).toBe(true);
  });
});
