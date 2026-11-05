import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// #221 / PR #224: examples of the shared page parts in the gallery
// (/design-system?pezzi-pagine=1). Runs on mobile (390) and desktop (1280).

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.goto("/design-system?pezzi-pagine=1");
  await expect(page.locator("#pezzi-pagine")).toBeVisible();
});

test("a11y: esempi dei pezzi delle pagine, senza violazioni", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("a11y: link della testa di sezione, area di tocco di 44 px e fuoco visibile", async ({
  page,
}) => {
  const link = page.getByRole("link", { name: "Vedi nel calendario" });
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  // The ::before area rises 44 px from the bottom edge of the link.
  const y = box!.y + box!.height - 43;
  await expect
    .poll(() =>
      page.evaluate(
        ({ px, py }) => document.elementFromPoint(px, py)?.textContent ?? "",
        { px: x, py: y },
      ),
    )
    .toContain("Vedi nel calendario");
  await link.focus();
  const outline = await link.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
});

test("a11y: tre campi corti affiancati, con etichetta e senza scorrimento orizzontale", async ({
  page,
}) => {
  const group = page.getByTestId("campo-doppio-tre");
  await group.scrollIntoViewIfNeeded();
  const labels = ["Scarpe", "Vestiti", "Pigiama"];
  for (const label of labels) {
    await expect(group.getByLabel(label)).toBeVisible();
  }
  const boxes = await Promise.all(
    labels.map((l) => group.getByLabel(l).boundingBox()),
  );
  expect(new Set(boxes.map((b) => Math.round(b!.y))).size).toBe(1);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a11y: bottone di modifica del profilo, nascosto sotto 1024 px e raggiungibile sopra", async ({
  page,
}) => {
  const button = page.getByRole("button", {
    name: "Modifica il profilo di Sofia",
  });
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  if (wide) {
    await expect(button).toBeVisible();
    await button.focus();
    await expect(button).toBeFocused();
  } else {
    await expect(button).toBeHidden();
  }
});

test("a11y: esempio «Spazio in arrivo», link solo da desktop e senza trappole", async ({
  page,
}) => {
  const link = page.getByTestId("spazio-arrivo").getByRole("link");
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  if (wide) {
    await expect(link).toBeVisible();
    await link.focus();
    await page.keyboard.press("Tab");
    await expect(link).not.toBeFocused();
  } else {
    await expect(link).toBeHidden();
  }
});

test("a11y: disposizioni di Oggi, una sola visibile per larghezza, e passi in elenco", async ({
  page,
}, testInfo) => {
  const example = page.getByTestId("oggi-disposizioni");
  await example.scrollIntoViewIfNeeded();
  const isDesktop = testInfo.project.name === "desktop";
  await expect(page.getByTestId("oggi-solo-mobile")).toBeVisible({
    visible: !isDesktop,
  });
  await expect(page.getByTestId("oggi-solo-desktop")).toBeVisible({
    visible: isDesktop,
  });
  const steps = page.getByTestId("lista-passi");
  await expect(steps.getByRole("listitem")).toHaveCount(2);
  const style = await steps.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, list: cs.listStyleType, gap: cs.rowGap };
  });
  expect(style).toEqual({ display: "grid", list: "none", gap: "4px" });
  const results = await new AxeBuilder({ page })
    .include('[data-testid="oggi-disposizioni"]')
    .analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("a11y: esempi nuovi di Button, ColorChoice e Alert (#236), senza violazioni", async ({
  page,
}) => {
  for (const id of ["pezzi-bottoni-236", "pezzi-alert-251"]) {
    const example = page.getByTestId(id);
    await example.scrollIntoViewIfNeeded();
    await expect(example).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include(`[data-testid="${id}"]`)
      .analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
});

test("a11y: bottoni con pressed e aria-haspopup, stato esposto e altezza di 44 px", async ({
  page,
}) => {
  const example = page.getByTestId("pezzi-bottoni-236");
  const off = example.getByRole("button", { name: "Avvisami quando è pronto" });
  const on = example.getByRole("button", {
    name: "Ti avvisiamo appena è pronto",
  });
  await expect(off).toHaveAttribute("aria-pressed", "false");
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await expect(
    example.getByRole("button", { name: "Elimina l'account" }),
  ).toHaveAttribute("aria-haspopup", "dialog");
  await expect(example.getByRole("radiogroup")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  for (const button of [off, on]) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  }
});

// #258 / PR #261: option row as a button, in-progress state, sheet with onBack.
test("a11y: riga-opzione come bottone, 44 px, fuoco visibile e ordine del fuoco (#258)", async ({
  page,
}) => {
  const example = page.getByTestId("riga-opzione-258");
  await example.scrollIntoViewIfNeeded();
  const rows = example.locator("button.riga-opzione");
  await expect(rows).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    const box = await rows.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  // Inactive controls keep full opacity but stay announced as disabled.
  await expect(rows.nth(1)).toHaveAttribute("aria-disabled", "true");
  await expect(rows.nth(1)).toHaveCSS("opacity", "1");
  await expect(
    example.getByRole("button", { name: "Più dettagli" }),
  ).toHaveAttribute("aria-disabled", "true");
  await rows.nth(0).focus();
  const outline = await rows.nth(0).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    example.getByRole("button", { name: "Più dettagli" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    example.getByRole("button", { name: "Apri foglio con ritorno" }),
  ).toBeFocused();
});

test("a11y: foglio con ritorno, Esc e X tornano indietro senza chiudere, senza trappole (#258)", async ({
  page,
}) => {
  const example = page.getByTestId("riga-opzione-258");
  await example.scrollIntoViewIfNeeded();
  await example.getByRole("button", { name: "Apri foglio con ritorno" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuovo impegno" });
  await expect(dialog).toBeVisible();
  const counter = page.getByTestId("foglio-ritorno-n");
  await page.keyboard.press("Escape");
  await expect(counter).toHaveText("Indietro: 1");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Chiudi", exact: true }).first().click();
  await expect(counter).toHaveText("Indietro: 2");
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Chiudi il foglio" }).click();
  await expect(dialog).toBeHidden();
});
