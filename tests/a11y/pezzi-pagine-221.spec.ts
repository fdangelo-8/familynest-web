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
