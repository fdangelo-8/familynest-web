import { expect, test, type Locator } from "@playwright/test";

// #461 / PR #484: example of the sign-in page in the gallery
// (`/design-system?pezzi-pagine=1#pezzi-accesso`). One reference per size, and
// a parity check: the example has the same texts, placeholders and links as
// `/accesso` (LEZIONI, Design: «esempio di galleria diverso dall'uso della
// pagina»).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

/** What a person reads and can use in a part of the page, in order. */
async function summary(root: Locator) {
  return root.evaluate((el) => {
    const clean = (text: string | null) =>
      (text ?? "").replace(/\s+/g, " ").trim();
    return {
      labels: Array.from(el.querySelectorAll("label")).map((e) =>
        clean(e.textContent),
      ),
      placeholders: Array.from(el.querySelectorAll("input")).map((e) =>
        e.getAttribute("placeholder"),
      ),
      controls: Array.from(
        el.querySelectorAll("a[href], button, [role='radio'], [role='tab']"),
      )
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map(
          (e) =>
            `${e.tagName.toLowerCase()}: ${clean(e.getAttribute("aria-label") ?? e.textContent)}`,
        ),
      text: clean(
        Array.from(el.querySelectorAll("p, h1, h3, label"))
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => e.textContent)
          .join(" "),
      ),
    };
  });
}

test("#461: l'esempio della galleria ha gli stessi testi e comandi della pagina", async ({
  page,
}) => {
  await page.goto("/accesso");
  await expect(page.locator("h1:visible")).toHaveText("Entra in FamilyNest");
  const real = await summary(page.locator("main"));

  await page.goto("/design-system?pezzi-pagine=1");
  await expect(page.locator("#pezzi-accesso")).toBeVisible();
  const example = await summary(page.getByTestId("accesso-pezzi"));

  expect(example.labels).toEqual(real.labels);
  expect(example.placeholders).toEqual(real.placeholders);
  expect(example.controls).toEqual(real.controls);
  expect(example.text).toEqual(real.text);
});

test("#461: esempio dell'accesso", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  await page.goto("/design-system?pezzi-pagine=1");
  await page.evaluate(() => document.fonts.ready);
  const example = page.getByTestId("accesso-pezzi");
  await expect(example).toBeVisible();
  await example.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(example).toHaveScreenshot("esempio-accesso-pezzi.png");
});
