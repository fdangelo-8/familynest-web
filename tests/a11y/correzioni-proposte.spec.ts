import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Accessibility of corrections 6-13 (#67, CA-34). The signed-in part needs
// the test users: skipped in CI until they exist, verified locally.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test.describe("CA-34: cornice con Vai al contenuto", () => {
  for (const route of ["/oggi", "/calendario", "/casa/spesa", "/nest"]) {
    test(`CA-34: axe su ${route}, link senza e con il focus`, async ({
      page,
      context,
      baseURL,
    }) => {
      test.skip(!usersConfigured("A"), skipReason("A"));
      await signInAs(context, baseURL!, "A");
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expectNoBlocking(page);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Vai al contenuto" }),
      ).toBeFocused();
      await expectNoBlocking(page);
    });
  }
});

test.describe("CA-34: pagine senza utente", () => {
  for (const route of [
    "/accesso?errore=google&annullato=1",
    "/design-system",
  ]) {
    test(`CA-34: axe su ${route}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.locator("h1:visible").first()).toBeVisible();
      await expectNoBlocking(page);
    });
  }

  test("CA-34: l'avviso neutro ha contrasto almeno 4,5:1", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/accesso?errore=google&annullato=1");
    const notice = page.locator(".avviso--info:visible");
    await expect(notice).toHaveCount(1);
    const ratio = await notice.evaluate((el) => {
      type Rgba = [number, number, number, number];
      const parse = (value: string): Rgba => {
        const m = value.match(/[\d.]+/g)!.map(Number);
        return [m[0]!, m[1]!, m[2]!, m[3] ?? 1];
      };
      // Composite the element's background over its ancestors, then white.
      let base: [number, number, number] = [255, 255, 255];
      const layers: Rgba[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
      }
      for (const layer of layers.reverse()) {
        base = [0, 1, 2].map(
          (i) => layer[i]! * layer[3] + base[i]! * (1 - layer[3]),
        ) as [number, number, number];
      }
      const fg = parse(getComputedStyle(el).color);
      const text: [number, number, number] = [0, 1, 2].map(
        (i) => fg[i]! * fg[3] + base[i]! * (1 - fg[3]),
      ) as [number, number, number];
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const [hi, lo] = [lum(text), lum(base)].sort((a, b) => b - a);
      return (hi! + 0.05) / (lo! + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
