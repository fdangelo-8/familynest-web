import { expect, test } from "@playwright/test";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import { hasTestUser, signInAs } from "../fixtures/visual-login";

// Layout and navigation (#10): the app frame in every section, at 390 and
// 1280 px (projects) and at 800 px (tablet, desktop project only).
// They need test user A (Casa D'Angelo); without TEST_USER_A_* they are
// skipped. The references are generated after #55, in the CI container.
// /nest has its own file, nest.spec.ts (#17): the old placeholder is gone.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

const PAGES = [
  { route: "/oggi", file: "oggi", h1: "Oggi" },
  { route: "/aggiungi", file: "aggiungi", h1: "Aggiungi" },
  { route: "/calendario", file: "calendario", h1: "Calendario" },
  { route: "/casa/spesa", file: "casa-spesa", h1: "Casa" },
  { route: "/notifiche", file: "notifiche", h1: "Notifiche" },
  { route: "/ricerca", file: "ricerca", h1: "Ricerca" },
  { route: "/profilo", file: "profilo", h1: "Il tuo profilo" },
  {
    route: "/calendari-collegati",
    file: "calendari-collegati",
    h1: "Calendari collegati",
  },
  {
    route: "/impostazioni",
    file: "impostazioni",
    h1: "Impostazioni della casa",
  },
  { route: "/membri", file: "membri", h1: "Chi c’è" },
];

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  await page.clock.setFixedTime(new Date("2026-10-20T15:00:00+02:00"));
  const signedIn = await signInAs(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

async function open(page: import("@playwright/test").Page, route: string) {
  // Casa · Spesa (#21) shows the shopping list: a fixed list, served by a fake,
  // so the reference does not depend on what other suites write in the Nest.
  const isSpesa = route === "/casa/spesa";
  if (isSpesa) await installSpesaFake(page, { items: NORMAL_LIST });
  await page.goto(route);
  await expect(page.getByRole("main")).toBeVisible();
  if (isSpesa) await expect(page.getByTestId("spesa-riga")).toHaveCount(7);
  await page.evaluate(() => document.fonts.ready);
}

for (const p of PAGES) {
  test(`cornice: ${p.route}`, async ({ page }) => {
    await open(page, p.route);
    await expect(
      page.getByRole("heading", { level: 1, name: p.h1 }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(`${p.file}.png`);
  });
}

test("cornice: lente su «Nest» in Oggi", async ({ page }) => {
  await open(page, "/oggi");
  const lens = page.getByRole("group", {
    name: "Punto di vista: solo tu o tutto il Nest",
  });
  const nest = lens.getByRole("button", { name: /Nest$/ });
  await nest.click();
  await expect(nest).toHaveAttribute("aria-pressed", "true");
  // Move the pointer away: the screenshot must show the resting state, not hover.
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("oggi-lente-nest.png");
});

test("cornice: indirizzo inesistente dentro la cornice", async ({ page }) => {
  await open(page, "/pippo");
  await expect(
    page.getByRole("heading", { level: 1, name: /Questa pagina non c.è/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("non-trovata.png");
});

test("cornice a 800 px (tablet): colonna centrata", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una sola volta");
  await page.setViewportSize({ width: 800, height: 900 });
  for (const p of PAGES.filter((x) =>
    ["oggi", "calendario", "casa-spesa"].includes(x.file),
  )) {
    await open(page, p.route);
    await expect(page).toHaveScreenshot(`tablet-${p.file}.png`);
  }
});
