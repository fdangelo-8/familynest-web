import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  LONG_DEADLINES,
  NORMAL_DEADLINES,
  OVERDUE_TODAY_PRIVATE_DEADLINES,
  installScadenzeFake,
  type FakeOptions,
} from "../fixtures/scadenze-fake";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import { NORMAL_TODOS, installTodosFake } from "../fixtures/todos-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Casa · Scadenze (#24), visual tester: axe in every state, keyboard (focus
// order, visible focus, no trap), touch areas, hidden texts, reduced motion.
// (The functional tester has tests/a11y/casa-scadenze.spec.ts.) The deadlines
// are served by a fake (fixtures/scadenze-fake.ts): nothing is written to the
// database. Test user A (Casa D'Angelo: Marco, Laura, Sofia, Tommaso, the dog
// Biscotto) is needed. Clock fixed: Tuesday 20 October 2026, 15:52 (Rome).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const NOW = new Date("2026-10-20T15:52:00+02:00");

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(page: Page, options: FakeOptions, ready = true) {
  await page.clock.install({ time: NOW });
  // Casa reads the three lists on every page: the other two are faked too.
  await installSpesaFake(page, { items: NORMAL_LIST });
  await installTodosFake(page, { todos: NORMAL_TODOS });
  const fake = await installScadenzeFake(page, options);
  await page.goto("/casa/scadenze");
  if (ready) {
    await expect(page.getByRole("region", { name: "Scadenze" })).toBeVisible({
      timeout: 20_000,
    });
  }
  return fake;
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

const isMobile = (name: string) => name === "mobile";

// --- axe, every state -----------------------------------------------------

test.describe("axe", () => {
  test("normale", async ({ page }) => {
    await open(page, { deadlines: NORMAL_DEADLINES });
    await expect(page.getByTestId("scadenza-riga")).toHaveCount(4);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("scadute, oggi e Solo io", async ({ page }) => {
    await open(page, { deadlines: OVERDUE_TODAY_PRIVATE_DEADLINES });
    await expect(page.getByTestId("scadenza-riga")).toHaveCount(8);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("titoli lunghi", async ({ page }) => {
    await open(page, { deadlines: LONG_DEADLINES });
    await expect(page.getByTestId("scadenza-riga")).toHaveCount(2);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("vuoto", async ({ page }) => {
    await open(page, { deadlines: [] });
    await expect(page.getByText("Nessuna scadenza")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento", async ({ page }) => {
    await open(page, { deadlines: NORMAL_DEADLINES, reads: "slow" }, false);
    const busy = page.locator('[aria-busy="true"][aria-live="polite"]');
    await expect(busy).toContainText("Caricamento in corso");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore di lettura", async ({ page }) => {
    await open(page, { reads: "error" }, false);
    if (page.viewportSize()!.width < 1024) {
      await expect(
        page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Non riusciamo a caricare le scadenze."),
      ).toBeVisible();
    }
    expect(await seriousViolations(page)).toEqual([]);
  });
});

// --- structure ----------------------------------------------------------------

test("struttura: un solo h1, h2 «Scadenze», h3 «Prossime», righe in un elenco", async ({
  page,
}) => {
  await open(page, { deadlines: NORMAL_DEADLINES });
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casa");
  // On mobile the h2 of the column is there for the readers but hidden to the eye.
  await expect(
    page.getByRole("heading", { level: 2, name: "Scadenze" }),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { level: 3, name: "Prossime" }),
  ).toBeVisible();
  await expect(page.getByRole("list").filter({ hasText: "Bollo" })).toHaveCount(
    1,
  );
  expect(await page.getByRole("main").count()).toBe(1);
});

test("righe: testi nascosti per i lettori di schermo, pallino decorativo", async ({
  page,
}) => {
  await open(page, { deadlines: OVERDUE_TODAY_PRIVATE_DEADLINES });
  const rows = page.getByTestId("scadenza-riga");
  // Urgent rows: ", urgente" read after the unit, the dot hidden.
  const first = rows.nth(0);
  await expect(first).toContainText("giorni fa");
  await expect(first.locator(".visivamente-nascosto").first()).toHaveText(
    ", urgente",
  );
  await expect(first.getByTestId("pallino-urgente")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  // «Oggi»: no unit, still urgent.
  const today = rows.filter({ hasText: "Tagliando dell'auto" });
  await expect(today.locator(".riga-scadenza__unita")).toHaveCount(0);
  await expect(today.locator(".visivamente-nascosto").first()).toHaveText(
    ", urgente",
  );
  // The avatar of the one who looks after it, spoken as «te ne occupi tu»;
  // the avatar of who it concerns, spoken as «riguarda <nome>».
  const bollo = rows.filter({ hasText: "Bollo dell'auto" });
  await expect(bollo).toContainText(", te ne occupi tu");
  const id = rows.filter({ hasText: "Rinnovo carta d'identità di Sofia" });
  await expect(id).toContainText(", riguarda Sofia");
  // Already said in the visible text: not repeated.
  const biscotto = rows.filter({ hasText: "Assicurazione di Biscotto" });
  await expect(biscotto).not.toContainText("te ne occupi tu");
  await expect(biscotto).not.toContainText("riguarda");
  // «Solo io»: padlock hidden, «solo tu» written.
  const passport = rows.filter({ hasText: "Rinnovo del passaporto" });
  await expect(passport.locator(".riga-lista__info")).toContainText("solo tu");
  await expect(passport.locator(".riga-lista__lucchetto svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("le righe non sono controlli: niente link né bottoni, fuori dall'ordine del focus", async ({
  page,
}) => {
  await open(page, { deadlines: NORMAL_DEADLINES });
  const rows = page.getByTestId("scadenza-riga");
  await expect(rows.locator("a, button, [tabindex]")).toHaveCount(0);
  const cursor = await rows
    .first()
    .locator(".riga-scadenza")
    .evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).not.toBe("pointer");
  // axe sees the deadlines in the list, not as links.
  await expect(page.getByRole("link", { name: /Bollo dell'auto/ })).toHaveCount(
    0,
  );
});

// --- touch areas ------------------------------------------------------------

/**
 * True when the 44 x 44 px square around the centre of the control hits the
 * control (or something inside it): the touch area is the whole square.
 */
async function hasTouchArea(target: Locator, size = 44) {
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

test("aree di tocco di almeno 44 px (mobile)", async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  await open(page, { deadlines: NORMAL_DEADLINES });
  await page.evaluate(() => window.scrollTo(0, 0));
  const group = page.getByRole("group", { name: "Sezione della casa" });
  for (const [role, name] of [
    ["link", /^Spesa/],
    ["link", /^Da fare/],
    ["button", /^Scadenze/],
  ] as const) {
    const voice = group.getByRole(role, { name });
    expect(await hasTouchArea(voice), `voce ${name}`).toBe(true);
  }
  for (const label of ["Cerca nel Nest", "Notifiche"]) {
    const control = page
      .getByRole("banner")
      .getByRole("link", { name: new RegExp(label) });
    const box = (await control.first().boundingBox())!;
    expect(box.width, label).toBeGreaterThanOrEqual(40);
    expect(await hasTouchArea(control.first()), label).toBe(true);
  }
  const nav = page.getByRole("navigation", { name: /principale/i }).last();
  for (const link of await nav.getByRole("link").all()) {
    expect(await hasTouchArea(link)).toBe(true);
  }
});

test("aree di tocco: stato vuoto e errore (mobile)", async ({
  page,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  await open(page, { deadlines: [] });
  const add = page.getByRole("link", { name: "Aggiungi una scadenza" });
  expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await add.boundingBox())!.width).toBeGreaterThanOrEqual(44);
});

test("aree di tocco: errore di pagina (mobile)", async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  await open(page, { reads: "error" }, false);
  await expect(
    page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
  ).toBeVisible();
  for (const target of [
    page.getByRole("button", { name: "Riprova" }),
    page.getByRole("link", { name: "Torna a Oggi" }),
  ]) {
    expect(await hasTouchArea(target)).toBe(true);
  }
});

// --- keyboard -----------------------------------------------------------------

/** Name of the focused element: aria-label, else its text. */
async function focusedLabel(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "(body)";
    const label = el.getAttribute("aria-label");
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return label ?? (text || el.tagName.toLowerCase());
  });
}

async function tabThrough(page: Page, max = 30) {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const label = await focusedLabel(page);
    if (label === "(body)" || seen.includes(label)) break;
    seen.push(label);
  }
  return seen;
}

test("ordine del focus con le righe: nessuna riga riceve il focus, nessuna trappola", async ({
  page,
}, testInfo) => {
  await open(page, { deadlines: NORMAL_DEADLINES });
  const seen = await tabThrough(page);
  console.log(`[focus ${testInfo.project.name}]`, JSON.stringify(seen));
  expect(seen[0]).toBe("Vai al contenuto");
  // None of the focused things is a deadline.
  for (const label of seen) {
    expect(label).not.toMatch(/Bollo|Assicurazione|Rinnovo/);
  }
  // The order of §6 of the specification.
  if (isMobile(testInfo.project.name)) {
    const idx = (re: RegExp) => seen.findIndex((l) => re.test(l));
    expect(idx(/Cerca nel Nest/)).toBeGreaterThan(0);
    expect(idx(/^Spesa/)).toBeGreaterThan(idx(/Cerca nel Nest/));
    expect(idx(/^Da fare/)).toBe(idx(/^Spesa/) + 1);
    expect(idx(/^Scadenze/)).toBe(idx(/^Da fare/) + 1);
    expect(idx(/^Oggi/)).toBeGreaterThan(idx(/^Scadenze/));
  } else {
    expect(seen.length).toBeGreaterThan(5);
  }
  // The focus goes on: no trap (the walk ended by itself, not at the limit).
  expect(seen.length).toBeLessThan(30);
});

test("ordine del focus nello stato vuoto: «Aggiungi una scadenza» prima della navigazione", async ({
  page,
}, testInfo) => {
  await open(page, { deadlines: [] });
  const seen = await tabThrough(page);
  console.log(`[focus vuoto ${testInfo.project.name}]`, JSON.stringify(seen));
  const add = seen.findIndex((l) => l === "Aggiungi una scadenza");
  expect(add).toBeGreaterThan(-1);
  if (isMobile(testInfo.project.name)) {
    expect(seen.findIndex((l) => /^Scadenze/.test(l))).toBeLessThan(add);
    expect(seen.findIndex((l) => /^Oggi/.test(l))).toBeGreaterThan(add);
  }
});

test("anello di focus visibile: selettore, «Aggiungi una scadenza», «Riprova»", async ({
  page,
}, testInfo) => {
  const ring = (el: Element) => {
    const cs = getComputedStyle(el);
    return {
      outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
      color: cs.outlineColor,
    };
  };
  await open(page, { deadlines: [] });
  await page.keyboard.press("Tab"); // make :focus-visible apply
  const targets = [page.getByRole("link", { name: "Aggiungi una scadenza" })];
  if (isMobile(testInfo.project.name)) {
    targets.push(
      page
        .getByRole("group", { name: "Sezione della casa" })
        .getByRole("link", { name: /^Spesa/ }),
    );
  }
  for (const target of targets) {
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    const r = await target.evaluate(ring);
    expect(r.outline).toBe(true);
  }
});

test("anello di focus visibile su «Riprova» (errore)", async ({ page }) => {
  await open(page, { reads: "error" }, false);
  const retry = page.getByRole("button", { name: "Riprova" });
  await expect(retry).toBeVisible();
  await page.keyboard.press("Tab");
  await retry.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(retry).toBeFocused();
  const outline = await retry.evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  });
  expect(outline).toBe(true);
});

test("«Riprova» riuscito su desktop: il focus va sul titolo «Scadenze»", async ({
  page,
}, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "colonna: solo desktop");
  const fake = await open(
    page,
    { deadlines: NORMAL_DEADLINES, reads: "error" },
    false,
  );
  const retry = page.getByRole("button", { name: "Riprova" });
  await expect(retry).toBeVisible();
  await retry.focus();
  fake.recover();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("scadenza-riga")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { level: 2, name: "Scadenze" }),
  ).toBeFocused();
});

// --- motion ---------------------------------------------------------------------

test("movimento ridotto: gli scheletri stanno fermi", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  await signInAs(context, baseURL!, "A");
  const page = await context.newPage();
  await open(page, { deadlines: NORMAL_DEADLINES, reads: "slow" }, false);
  const skeleton = page.locator(".skeleton:visible").first();
  await expect(skeleton).toBeVisible();
  const name = await skeleton.evaluate(
    (el) => getComputedStyle(el).animationName,
  );
  expect(name).toBe("none");
  await context.close();
});
