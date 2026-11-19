import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// #482 / PR #490: animal components in the gallery
// (/design-system?pezzi-pagine=1, section #pezzi-animali). Runs on mobile
// (390) and desktop (1280).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

async function open(page: Page) {
  await page.goto("/design-system?pezzi-pagine=1");
  await expect(page.locator("#pezzi-animali")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("a11y: sezione degli animali, senza violazioni serious o critical", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include("#pezzi-animali")
    .analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("a11y: nomi accessibili dei componenti", async ({ page }) => {
  const days = page.getByTestId("scelta-giorni");
  for (const name of [
    "Lun, lunedì",
    "Mar, martedì",
    "Mer, mercoledì",
    "Gio, giovedì",
    "Ven, venerdì",
    "Sab, sabato",
    "Dom, domenica",
  ]) {
    await expect(days.getByRole("button", { name }).first()).toBeVisible();
  }
  await expect(
    days.getByRole("group", { name: "Giorni" }).first(),
  ).toBeVisible();

  const turn = page.getByTestId("turno-persone");
  for (const name of [
    "Sposta su: Laura",
    "Sposta giù: Laura",
    "Togli Laura",
    "Sposta su: Marco",
    "Togli Sofia",
  ]) {
    await expect(turn.getByRole("button", { name })).toBeVisible();
  }
  await expect(turn.getByRole("list")).toHaveCount(1);
  await expect(turn.getByRole("listitem")).toHaveCount(3);

  const photo = page.getByTestId("campo-foto");
  await expect(
    photo.getByRole("button", { name: "Scegli una foto" }),
  ).toBeVisible();
  await expect(
    photo.getByRole("button", { name: "Cambia la foto" }),
  ).toBeVisible();
  await expect(
    photo.getByRole("button", { name: "Togli la foto" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("avatar-foto")
      .getByRole("img", { name: "Foto di Biscotto" }),
  ).toHaveCount(1);

  const repeat = page.getByTestId("si-ripete-scadenza");
  await expect(repeat.getByLabel("Si ripete")).toHaveValue("monthly");
  const everyN = page.getByTestId("si-ripete-giorni");
  await expect(everyN.getByLabel("Quanti giorni")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(everyN.getByLabel("Quanti giorni")).toHaveAccessibleDescription(
    /Scrivi un numero di giorni da 1 a 365/,
  );
});

test("a11y: giorni scelti, tastiera e stato premuto", async ({ page }) => {
  const days = page.getByTestId("scelta-giorni");
  const lun = days.getByRole("button", { name: "Lun, lunedì" }).first();
  const mar = days.getByRole("button", { name: "Mar, martedì" }).first();
  await expect(lun).toHaveAttribute("aria-pressed", "true");
  await expect(mar).toHaveAttribute("aria-pressed", "false");
  await mar.focus();
  await page.keyboard.press("Space");
  await expect(mar).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(
    days.getByRole("button", { name: "Mer, mercoledì" }).first(),
  ).toBeFocused();
});

test("a11y: turno, il fuoco segue il bottone dopo lo spostamento", async ({
  page,
}) => {
  const turn = page.getByTestId("turno-persone");
  const status = turn.getByRole("status");
  // Laura, Sofia, Marco -> move Laura down: stays on «Sposta giù: Laura».
  await turn.getByRole("button", { name: "Sposta giù: Laura" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    turn.getByRole("button", { name: "Sposta giù: Laura" }),
  ).toBeFocused();
  await expect(status).toHaveText("Laura ora è al posto 2.");
  // Laura is now second: «Sposta su: Laura» moves her back.
  await turn.getByRole("button", { name: "Sposta su: Laura" }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Laura ora è al posto 1.");
  // At the edge «Sposta su» is aria-disabled: the focus goes to the other
  // button of the row (B.2).
  await expect(
    turn.getByRole("button", { name: "Sposta giù: Laura" }),
  ).toBeFocused();
});

test("a11y: turno, il fuoco dopo «Togli» e dopo l'aggiunta, annunci neutri", async ({
  page,
}) => {
  const turn = page.getByTestId("turno-persone");
  const status = turn.getByRole("status");
  // Togli Laura (first row): the focus goes to the «Togli» of the row that
  // takes her place (Sofia).
  await turn.getByRole("button", { name: "Togli Laura" }).focus();
  await page.keyboard.press("Enter");
  await expect(turn.getByRole("button", { name: "Togli Sofia" })).toBeFocused();
  await expect(status).toHaveText("Laura esce dal turno.");
  // Togli the last row: no row takes its place, the focus goes to the first
  // chip (B.2), never lost.
  await turn.getByRole("button", { name: "Togli Marco" }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Marco esce dal turno.");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (
          !!el?.closest('[data-testid="turno-persone"]') &&
          !el.closest("li") &&
          el.tagName === "BUTTON"
        );
      }),
    )
    .toBe(true);
  // Add a person from the chips: the announcement says where.
  await turn.getByRole("button", { name: /Laura/ }).last().click();
  await expect(status).toHaveText("Laura entra nel turno al posto 2.");
  const active = await page.evaluate(
    () => document.activeElement?.tagName ?? "",
  );
  expect(["BUTTON"]).toContain(active);
  for (const text of await status.allTextContents()) {
    expect(text).not.toMatch(/aggiunta|tolta|spostata|aggiunto|tolto|spostato/);
  }
});

test("a11y: turno, togliere l'ultima persona porta il fuoco sul primo chip", async ({
  page,
}) => {
  const turn = page.getByTestId("turno-persone");
  await turn.getByRole("button", { name: "Togli Laura" }).click();
  await turn.getByRole("button", { name: "Togli Sofia" }).click();
  await turn.getByRole("button", { name: "Togli Marco" }).click();
  await expect(turn.getByRole("listitem")).toHaveCount(0);
  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      inTurn: !!el?.closest('[data-testid="turno-persone"]'),
      tag: el?.tagName ?? "",
    };
  });
  expect(info).toEqual({ inTurn: true, tag: "BUTTON" });
});

test("a11y: foto, dopo «Togli la foto» il fuoco va su «Scegli una foto»", async ({
  page,
}) => {
  const photo = page.getByTestId("campo-foto");
  // Pick a file, then remove it: the gallery example reports it.
  await photo
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "biscotto.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await expect(photo.getByText("Scelta: biscotto.png")).toBeVisible();
  await photo.getByRole("button", { name: "Togli la foto" }).first().click();
  await expect(photo.getByText("Scelta: nessuna foto")).toBeVisible();
  await expect(
    photo.getByRole("button", { name: "Scegli una foto" }).first(),
  ).toBeFocused();
});

test("a11y: foto, un file di formato non ammesso dà un errore", async ({
  page,
}) => {
  const photo = page.getByTestId("campo-foto");
  await photo
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "nota.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("ciao"),
    });
  await expect(
    photo.getByText(
      "Questo file non si apre: scegli una foto JPEG, PNG o WebP.",
    ),
  ).toBeVisible();
});

test("a11y: aree di tocco di 44 px sui controlli degli animali (mobile)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo mobile");
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const root = document.querySelector("#pezzi-animali")!;
    const controls = root.querySelectorAll<HTMLElement>(
      "button, select, input:not([type=file]):not([type=hidden])",
    );
    for (const el of controls) {
      if (el.closest("[aria-hidden=true]")) continue;
      if (!el.checkVisibility()) continue;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let miss = 0;
      const corners: Array<[number, number]> = [
        [-21, -21],
        [21, -21],
        [-21, 21],
        [21, 21],
      ];
      for (const [dx, dy] of corners) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        const ok =
          hit &&
          (el === hit || el.contains(hit) || hit.contains(el)) &&
          !(hit === document.body);
        const inLabel = hit?.closest("label")?.contains(el);
        if (!ok && !inLabel) miss += 1;
      }
      if (miss > 0) {
        out.push(
          `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("a11y: testo ingrandito al 200%, niente scorrimento orizzontale", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "solo mobile");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  await open(page);
  const result = await page.evaluate(() => {
    const de = document.documentElement;
    const root = document.querySelector("#pezzi-animali")!;
    const wide: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        wide.push(
          `${el.tagName}.${el.className} ${Math.round(r.left)}..${Math.round(r.right)}`,
        );
      }
    }
    return { wide };
  });
  // Only this section is judged: other gallery sections are not part of #482.
  expect(result.wide).toEqual([]);
  // The narrow weekday picker keeps its seven chips reachable at the big size.
  const days = page.getByTestId("scelta-giorni-stretta");
  await days.scrollIntoViewIfNeeded();
  await expect(days.getByRole("button")).toHaveCount(7);
  const results = await new AxeBuilder({ page })
    .include("#pezzi-animali")
    .analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("layout: le righe del turno occupano tutta la scheda, senza rientro dell'elenco", async ({
  page,
}) => {
  const turn = page.getByTestId("turno-persone");
  const card = turn.locator(".scheda").first();
  const row = turn.locator("li.riga-lista").first();
  const cardBox = await card.boundingBox();
  const rowBox = await row.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(rowBox!.x - cardBox!.x).toBeLessThanOrEqual(1);
  expect(
    cardBox!.x + cardBox!.width - (rowBox!.x + rowBox!.width),
  ).toBeLessThanOrEqual(1);
});

test("a11y: fuoco visibile sui controlli degli animali", async ({ page }) => {
  const controls = [
    page.getByTestId("scelta-giorni").getByRole("button").first(),
    page
      .getByTestId("turno-persone")
      .getByRole("button", { name: "Togli Laura" }),
    page
      .getByTestId("campo-foto")
      .getByRole("button", { name: "Scegli una foto" }),
  ];
  for (const control of controls) {
    await control.focus();
    const outline = await control.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  }
});
