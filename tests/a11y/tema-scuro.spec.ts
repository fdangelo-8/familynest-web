import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setAspetto } from "../fixtures/tema";

// #634, CA-24: the gallery and the sign-in page at night, at 390 and 1280 px
// (the two projects), have no serious or critical violation, colour contrast
// included. The theme is turned on with the attribute and, in a second run,
// with the system preference only.

const PAGES = ["/design-system", "/accesso"];

for (const path of PAGES) {
  for (const mode of ["attributo", "sistema"] as const) {
    test(`CA-24: ${path} al buio (${mode}) senza violazioni gravi`, async ({
      page,
    }) => {
      if (mode === "sistema") await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(path);
      await expect(page.locator("h1:visible").first()).toBeVisible();
      if (mode === "attributo") await setAspetto(page, "scuro");
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );
      expect(background).toBe("rgb(15, 24, 25)");
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(blocking).toEqual([]);
    });
  }
}
