import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ALL_TAKEN_LIST,
  FEW_LIST,
  NORMAL_LIST,
  installSpesaFake,
  type FakeOptions,
} from "../fixtures/spesa-fake";
import {
  NORMAL_DEADLINES,
  installScadenzeFake,
} from "../fixtures/scadenze-fake";
import { installTodosFake } from "../fixtures/todos-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Casa · Spesa (#21): axe in every state, touch areas, focus order and focus
// moves, announcements of the live region, reduced motion. The list is served
// by a fake (fixtures/spesa-fake.ts): nothing is written to the database.
// Test user A (Casa D'Angelo: Marco, Laura, the dog Biscotto) is needed.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(async ({ context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(
  page: Page,
  options: FakeOptions,
  ready = true,
  deadlines: "ok" | "error" = "ok",
) {
  const fake = await installSpesaFake(page, options);
  // The deadlines are the third column; if the list cannot be read they fail
  // too (on desktop the whole-page error needs all the lists to fail).
  await installScadenzeFake(page, {
    deadlines: NORMAL_DEADLINES,
    reads: options.reads === "error" || deadlines === "error" ? "error" : "ok",
  });
  // If the shopping list cannot be read the things to do fail too (on desktop
  // the whole-page error needs all the lists to fail).
  if (options.reads === "error") {
    await installTodosFake(page, { reads: "error" });
  }
  await page.goto("/casa/spesa");
  if (ready) {
    await expect(page.getByRole("region", { name: "Spesa" })).toBeVisible({
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
    await open(page, { items: NORMAL_LIST });
    await expect(page.getByTestId("spesa-riga")).toHaveCount(7);
    expect(await seriousViolations(page)).toEqual([]);
    // One h1; on mobile h1 -> h3 is bridged by the hidden h2 "Spesa".
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 2, name: "Spesa" }),
    ).toBeAttached();
  });

  test("vuoto", async ({ page }) => {
    await open(page, { items: [] });
    await expect(page.getByText("Una lista per tutta la casa")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("tutto preso", async ({ page }) => {
    await open(page, { items: ALL_TAKEN_LIST });
    await expect(page.getByText("Tutto preso")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("le più comuni con poche cose", async ({ page }) => {
    await open(page, { items: FEW_LIST });
    await expect(
      page.getByRole("group", { name: "Le più comuni" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("caricamento", async ({ page }) => {
    await open(page, { items: NORMAL_LIST, reads: "slow" }, false);
    // The page's own loading state (the route frame shows a similar one first).
    const busy = page.locator('[aria-busy="true"][aria-live="polite"]');
    await expect(busy).toContainText("Caricamento in corso");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore di una sola colonna (desktop)", async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), "Caso a 1280 px");
    await open(page, { items: NORMAL_LIST }, true, "error");
    await expect(
      page
        .getByRole("region", { name: "Scadenze" })
        .getByText("Non riusciamo a caricare le scadenze."),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("errore di lettura", async ({ page }) => {
    await open(page, { reads: "error" }, false);
    await expect(
      page.getByRole("heading", { name: "Questa pagina non si è caricata" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("offline", async ({ page, context }) => {
    await open(page, { items: NORMAL_LIST });
    await context.setOffline(true);
    await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
    await expect(page.locator(".avviso--errore")).toContainText("Sei offline");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("toast dello strappo", async ({ page }) => {
    await open(page, { items: NORMAL_LIST });
    await page
      .getByRole("button", { name: /Togli dalla lista le 3 cose/ })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "tolte dalla lista" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("toast del doppione", async ({ page }) => {
    await open(page, { items: NORMAL_LIST });
    const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
    await field.fill("latte");
    await field.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "già in lista" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("toast di modifica rifiutata", async ({ page }) => {
    const fake = await open(page, { items: NORMAL_LIST });
    fake.refuseWrites();
    await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Non siamo riusciti a salvare la modifica" }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("lama trascinata", async ({ page }) => {
    await open(page, { items: NORMAL_LIST });
    const blade = page.getByRole("button", {
      name: /Togli dalla lista le 3 cose/,
    });
    await blade.scrollIntoViewIfNeeded();
    const box = (await blade.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, {
      steps: 6,
    });
    await expect(page.getByTestId("spesa-strappo")).toHaveClass(
      /is-trascinato/,
    );
    expect(await seriousViolations(page)).toEqual([]);
    await page.mouse.up();
  });

  test("tablet (800 px)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "una sola volta");
    await page.setViewportSize({ width: 800, height: 900 });
    await open(page, { items: NORMAL_LIST });
    await expect(page.getByTestId("spesa-riga")).toHaveCount(7);
    expect(await seriousViolations(page)).toEqual([]);
  });
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
  await open(page, { items: FEW_LIST });
  await page.evaluate(() => window.scrollTo(0, 0));

  const checkbox = page.getByRole("checkbox", { name: "Preso: Latte" });
  expect(await hasTouchArea(checkbox)).toBe(true);
  const taken = page.getByRole("checkbox", { name: "Rimetti in lista: Pane" });
  expect(await hasTouchArea(taken)).toBe(true);

  // The touch areas of two rows do not overlap: the row stays 56 px tall.
  const first = (await checkbox.boundingBox())!;
  const second = (await page
    .getByRole("checkbox", { name: "Preso: Mele" })
    .boundingBox())!;
  expect(second.y - first.y).toBeGreaterThanOrEqual(44);

  for (const name of ["Spesa", "Da fare", "Scadenze"]) {
    const voice = page
      .getByRole("group", { name: "Sezione della casa" })
      .getByText(name, { exact: false })
      .first();
    const control = voice.locator(
      "xpath=ancestor-or-self::*[self::a or self::button][1]",
    );
    expect(await hasTouchArea(control), `voce ${name}`).toBe(true);
  }

  for (const name of ["Aggiungi Pane", "Aggiungi Crocchette per Biscotto"]) {
    const chip = page.getByRole("button", { name });
    expect(await hasTouchArea(chip), name).toBe(true);
  }

  const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
  expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  const blade = page.getByRole("button", {
    name: /Togli dalla lista le 2 cose/,
  });
  const bladeBox = (await blade.boundingBox())!;
  expect(bladeBox.width).toBeGreaterThanOrEqual(44);
  expect(bladeBox.height).toBeGreaterThanOrEqual(44);
});

test("aree di tocco: Riprova e Annulla (mobile)", async ({
  page,
  context,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "area di tocco: solo mobile");
  await open(page, { items: NORMAL_LIST });
  await context.setOffline(true);
  await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
  const retry = page.getByRole("button", { name: "Riprova" });
  await expect(retry).toBeVisible();
  expect(await hasTouchArea(retry, 44)).toBe(true);
  await context.setOffline(false);
  await expect(page.locator(".avviso--errore")).toBeHidden({ timeout: 15_000 });

  await page.getByRole("button", { name: /Togli dalla lista le/ }).click();
  const undo = page.getByRole("button", { name: "Annulla" });
  await expect(undo).toBeVisible();
  const box = (await undo.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});

// --- focus: order, visible ring, moves -----------------------------------------

async function focusedLabel(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "(body)";
    const label = el.getAttribute("aria-label");
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
    // The switcher voices carry a count ("Spesa2"): the name is enough here.
    return (
      label ?? (el.tagName === "INPUT" ? "campo" : text.replace(/\d+$/, ""))
    );
  });
}

test("ordine del focus: dal campo alla lama, poi la navigazione", async ({
  page,
}, testInfo) => {
  await open(page, { items: FEW_LIST });
  const seen: string[] = [];
  // Start just before the page content, then tab until the strappo is passed.
  if (isMobile(testInfo.project.name)) {
    await page.getByRole("button", { name: /^Spesa/ }).focus();
  } else {
    await page.getByRole("textbox", { name: "Aggiungi alla spesa…" }).focus();
  }
  seen.push(await focusedLabel(page));
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    seen.push(await focusedLabel(page));
    if (seen[seen.length - 1]!.startsWith("Togli dalla lista")) break;
  }
  const expected = [
    ...(isMobile(testInfo.project.name)
      ? ["Spesa", "Da fare", "Scadenze"]
      : []),
    "campo",
    "Aggiungi Pane",
    "Aggiungi Uova",
    "Aggiungi Frutta",
    "Aggiungi Caffè",
    "Aggiungi Carta igienica",
    "Aggiungi Crocchette per Biscotto",
    "Preso: Latte",
    "Preso: Mele",
    "Rimetti in lista: Pasta",
    "Rimetti in lista: Pane",
    "Togli dalla lista le 2 cose prese",
  ];
  // Desktop starts on the field itself; mobile starts on "Spesa 2".
  expect(seen).toEqual(expected);
  // Nothing in the page traps the focus: the next Tab leaves the strappo
  // (mobile: bottom navigation; desktop: nothing follows, the focus leaves the page).
  if (!isMobile(testInfo.project.name)) return;
  await page.keyboard.press("Tab");
  expect(await focusedLabel(page)).not.toBe("(body)");
  await page.keyboard.press("Tab");
  expect(await focusedLabel(page)).not.toBe(expected[expected.length - 1]);
});

test("anello di focus visibile su tondo, chip, lama e campo", async ({
  page,
}) => {
  await open(page, { items: FEW_LIST });
  const ring = (el: Element) => {
    const cs = getComputedStyle(el);
    return {
      outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
      shadow: cs.boxShadow !== "none",
    };
  };

  await page.keyboard.press("Tab"); // make :focus-visible apply
  for (const target of [
    page.getByRole("checkbox", { name: "Preso: Latte" }),
    page.getByRole("button", { name: "Aggiungi Pane" }),
    page.getByRole("button", { name: /Togli dalla lista le 2 cose/ }),
  ]) {
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    const r = await target.evaluate(ring);
    expect(r.outline || r.shadow).toBe(true);
  }

  // The field has no outline of its own: the ring is on its container (spec).
  const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
  await field.focus();
  const container = page.locator(
    'form.campo-rapido[aria-label="Aggiungi alla spesa…"]',
  );
  const before = await container.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );
  expect(before).toContain("23, 24, 28");
});

test("focus: aggiungendo un chip va sul chip vicino", async ({ page }) => {
  await open(page, { items: [] });
  const chip = page.getByRole("button", { name: "Aggiungi Uova" });
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("checkbox", { name: "Preso: Uova" }),
  ).toBeVisible();
  // "Uova" is gone from the chips; the focus went to the next chip, "Frutta".
  await expect(
    page.getByRole("button", { name: "Aggiungi Frutta" }),
  ).toBeFocused();
});

test("focus: se «Le più comuni» sparisce, il focus va su «Da prendere»", async ({
  page,
}) => {
  // Two to buy: the third one (a chip) makes the section go away.
  const items = ["Latte", "Pane"].map((name) => ({
    name,
    by: "Marco" as const,
  }));
  await open(page, { items });
  const chip = page.getByRole("button", { name: "Aggiungi Uova" });
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("spesa-piu-comuni")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 3, name: "Da prendere" }),
  ).toBeFocused();
});

test("focus: strappo da tastiera porta il focus su «Annulla», Annulla alla lama", async ({
  page,
}) => {
  await open(page, { items: NORMAL_LIST });
  const blade = page.getByRole("button", {
    name: /Togli dalla lista le 3 cose/,
  });
  await blade.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "tolte dalla lista" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Annulla" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("spesa-presi")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Togli dalla lista le 3 cose/ }),
  ).toBeFocused();
});

test("focus: strappo con Spazio e con il puntatore", async ({ page }) => {
  await open(page, { items: NORMAL_LIST });
  const blade = page.getByRole("button", {
    name: /Togli dalla lista le 3 cose/,
  });
  await blade.focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("spesa-presi")).toHaveCount(0);
  // Pointer: the focus goes to the "Da prendere" heading (spec 4).
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByTestId("spesa-presi")).toBeVisible();
  await page
    .getByRole("button", { name: /Togli dalla lista le 3 cose/ })
    .click();
  await expect(page.getByTestId("spesa-presi")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 3, name: "Da prendere" }),
  ).toBeFocused();
});

test("focus: la spunta resta sul tondo della stessa riga", async ({ page }) => {
  await open(page, { items: NORMAL_LIST });
  const row = page.getByRole("checkbox", { name: "Preso: Pane" });
  await row.focus();
  await page.keyboard.press("Space");
  const moved = page.getByRole("checkbox", { name: "Rimetti in lista: Pane" });
  await expect(moved).toBeFocused();
  // After the short wait the row changes list and keeps the focus.
  await expect(page.getByTestId("spesa-presi")).toContainText("Pane");
  await expect(moved).toBeFocused();
});

async function offlineWithPane(
  page: Page,
  context: import("@playwright/test").BrowserContext,
) {
  await open(page, { items: NORMAL_LIST });
  await context.setOffline(true);
  await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
  const retry = page.getByRole("button", { name: "Riprova" });
  await expect(retry).toBeVisible();
  return retry;
}

test("focus: «Riprova» premuto da tastiera, poi torna la rete: il focus va su un titolo", async ({
  page,
  context,
}) => {
  const retry = await offlineWithPane(page, context);
  await retry.focus();
  await page.keyboard.press("Enter");
  // Still offline: the alert stays and so does the focus.
  await expect(page.locator(".avviso--errore")).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".avviso--errore")).toBeHidden({ timeout: 15_000 });
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("H3");
});

test("focus: torna la rete con il focus su «Riprova» (senza premerlo): il focus non va perso", async ({
  page,
  context,
}) => {
  const retry = await offlineWithPane(page, context);
  await retry.focus();
  await context.setOffline(false);
  await expect(page.locator(".avviso--errore")).toBeHidden({ timeout: 15_000 });
  // Spec 3.6a: "se il focus era su «Riprova» va sull'h3 della prima sezione visibile".
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("H3");
});

test("focus: il «Riprova» della colonna Scadenze tiene il focus quando sparisce l'avviso offline (desktop)", async ({
  page,
  context,
}, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "Caso a 1280 px");
  await open(page, { items: NORMAL_LIST }, true, "error");
  const column = page.getByRole("region", { name: "Scadenze" });
  const columnRetry = column.getByRole("button", { name: "Riprova" });
  await expect(columnRetry).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
  await expect(page.locator(".avviso--errore")).toHaveCount(2);
  await columnRetry.focus();
  await context.setOffline(false);
  // The offline alert goes away by itself; the other alert, with the focus, stays.
  await expect(page.locator(".avviso--errore")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(columnRetry).toBeFocused();
  // A click on something that cannot take the focus drops it: nothing moves it later.
  await page.mouse.click(5, 300);
  await expect(columnRetry).not.toBeFocused();
  // The click puts the focus on the page itself: the body, or the `main`
  // (tabIndex -1, target of «Vai al contenuto»). Not on the old button.
  expect(["BODY", "MAIN"]).toContain(
    await page.evaluate(() => document.activeElement?.tagName),
  );
});

test("spunta rifiutata: la riga torna subito in «Da prendere»", async ({
  page,
}) => {
  const fake = await open(page, { items: NORMAL_LIST });
  fake.refuseWrites();
  await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Non siamo riusciti a salvare" }),
  ).toBeVisible();
  // At once, not after the 600 ms wait of a tick: the circle is empty and the row is in its own list.
  await expect(
    page.getByTestId("spesa-da-prendere").getByRole("checkbox", {
      name: "Preso: Latte",
    }),
  ).toBeVisible({ timeout: 300 });
  await expect(page.getByTestId("spesa-presi")).not.toContainText("Latte", {
    timeout: 300,
  });
});

// --- the live region ---------------------------------------------------------

test("regione aria-live: annunci dopo aggiunta e chip", async ({ page }) => {
  await open(page, { items: [] });
  const live = page.getByTestId("spesa-annuncio");
  await expect(live).toHaveAttribute("aria-live", "polite");
  await expect(live).toHaveText("");

  await page.getByRole("button", { name: "Aggiungi Latte" }).click();
  await expect(live).toHaveText("Aggiunto: Latte");

  const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
  await field.fill("Pomodori");
  await field.press("Enter");
  await expect(live).toHaveText("Aggiunto: Pomodori");
  // The region is hidden from sight, not from screen readers.
  expect(await live.evaluate((el) => getComputedStyle(el).display)).not.toBe(
    "none",
  );
  expect(await live.evaluate((el) => getComputedStyle(el).visibility)).toBe(
    "visible",
  );
});

test("regioni live: una sola per la pagina, più i toast e gli avvisi", async ({
  page,
}) => {
  await open(page, { items: NORMAL_LIST });
  const polite = page.locator('main [aria-live="polite"]');
  await expect(polite).toHaveCount(1);
  // The toast announces itself (role=status) and the alert is role=alert.
  await page
    .getByRole("button", { name: /Togli dalla lista le 3 cose/ })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "3 cose tolte dalla lista." }),
  ).toBeVisible();
});

test("il doppione e la modifica rifiutata si annunciano come stato", async ({
  page,
}) => {
  const fake = await open(page, { items: NORMAL_LIST });
  const field = page.getByRole("textbox", { name: "Aggiungi alla spesa…" });
  await field.fill("pane");
  await field.press("Enter");
  const dup = page
    .getByRole("status")
    .filter({ hasText: "Pane è già in lista." });
  await expect(dup).toBeVisible();
  fake.refuseWrites();
  await page.getByRole("checkbox", { name: "Preso: Latte" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Non siamo riusciti a salvare" }),
  ).toBeVisible();
});

test("offline: l'avviso è role=alert", async ({ page, context }) => {
  await open(page, { items: NORMAL_LIST });
  await context.setOffline(true);
  await page.getByRole("checkbox", { name: "Preso: Pane" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sei offline" }),
  ).toBeVisible();
});

// --- reduced motion ---------------------------------------------------------

test.describe("movimento ridotto", () => {
  test.use({ reducedMotion: "reduce" });

  test("lama, scheletri e tondi non si animano", async ({ page }) => {
    await open(page, { items: NORMAL_LIST });
    const blade = page.getByRole("button", {
      name: /Togli dalla lista le 3 cose/,
    });
    const duration = await blade.evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    expect(duration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
    const box = page.getByRole("checkbox", { name: "Preso: Latte" });
    const boxDuration = await box.evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    expect(boxDuration.split(",").every((d) => parseFloat(d) === 0)).toBe(true);
  });

  test("scheletri fermi nel caricamento", async ({ page }) => {
    await open(page, { items: NORMAL_LIST, reads: "slow" }, false);
    const skeleton = page.locator(".skeleton").first();
    await expect(skeleton).toBeAttached();
    const name = await skeleton.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(name).toBe("none");
  });

  test("la lama torna all'inizio subito, l'attesa della spunta resta", async ({
    page,
  }) => {
    await open(page, { items: NORMAL_LIST });
    const row = page.getByRole("checkbox", { name: "Preso: Pane" });
    await row.click();
    // The wait before the row changes list is not an animation: it stays.
    await expect(page.getByTestId("spesa-presi")).toContainText("Pane");
  });
});

test("controllo: senza movimento ridotto la lama ha la sua transizione", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, { items: NORMAL_LIST });
  const blade = page.getByRole("button", {
    name: /Togli dalla lista le 3 cose/,
  });
  const duration = await blade.evaluate(
    (el) => getComputedStyle(el).transitionDuration,
  );
  expect(duration.split(",").some((d) => parseFloat(d) > 0)).toBe(true);
});
