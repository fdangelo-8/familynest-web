import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// PasswordField in the gallery (#327): no serious or critical violation, and
// the focus ring is visible on the field and on the show/hide button.

const URL = "/design-system?campo-password=1";

test("nessuna violazione serious o critical", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("#campo-password")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include("#campo-password")
    .analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});

test("un solo h1 e nessuno scorrimento orizzontale a 390 px", async ({
  page,
}, testInfo) => {
  await page.goto(URL);
  await expect(page.locator("h1")).toHaveCount(1);
  if (testInfo.project.name === "mobile") {
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test("Tab raggiunge campo e bottone con un anello visibile", async ({
  page,
}) => {
  await page.goto(URL);
  const input = page.getByTestId("campo-password-regole");
  await input.focus();
  const inputShadow = await input.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );
  expect(inputShadow).not.toBe("none");
  await page.keyboard.press("Tab");
  const toggle = page
    .locator("#campo-password .campo")
    .first()
    .getByRole("button", { name: "Mostra la password" });
  await expect(toggle).toBeFocused();
  const ring = await toggle.evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  });
  expect(ring).toBe(true);
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toBeFocused();
});
