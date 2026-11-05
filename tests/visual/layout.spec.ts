import { expect, test } from "@playwright/test";
import {
  NORMAL_DEADLINES,
  installScadenzeFake,
} from "../fixtures/scadenze-fake";
import { NORMAL_LIST, installSpesaFake } from "../fixtures/spesa-fake";
import { NORMAL_TODOS, installTodosFake } from "../fixtures/todos-fake";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { installOggiFake } from "../fixtures/oggi-visuale";
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
  // Since #30 the h1 of Oggi is the greeting (15:00: «Buon pomeriggio»).
  { route: "/oggi", file: "oggi", h1: /^Buon pomeriggio/ },
  { route: "/aggiungi", file: "aggiungi", h1: /^Buon pomeriggio/ },
  { route: "/calendario", file: "calendario", h1: "19 – 25 ottobre" },
  { route: "/casa/spesa", file: "casa-spesa", h1: "Casa" },
  { route: "/notifiche", file: "notifiche", h1: "Notifiche" },
  // Ricerca (#40): the search page at 390 px (h1 for screen readers only),
  // the palette over Oggi at 1280 px (h1 of Oggi).
  {
    route: "/ricerca",
    file: "ricerca",
    h1: "Cerca nel Nest",
    h1Desktop: "Oggi",
  },
  { route: "/profilo", file: "profilo", h1: "Marco D'Angelo" },
  {
    route: "/calendari-collegati",
    file: "calendari-collegati",
    h1: "Calendari collegati",
  },
  {
    route: "/impostazioni",
    file: "impostazioni",
    h1: "Casa D'Angelo",
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
  // The tablet test opens several pages with the same page: the fakes of the
  // one before (Oggi's events) must not answer for the next one (Calendario).
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // Casa · Spesa (#21) shows the shopping list: a fixed list, served by a fake,
  // so the reference does not depend on what other suites write in the Nest.
  const isSpesa = route === "/casa/spesa";
  if (isSpesa) {
    await installSpesaFake(page, { items: NORMAL_LIST });
    // Since #23 the Da fare column sits next to Spesa on desktop (and its count
    // is in the switcher): a fixed list, served by a fake.
    await installTodosFake(page, { todos: NORMAL_TODOS });
    // Same for the Scadenze column (#128).
    await installScadenzeFake(page, { deadlines: NORMAL_DEADLINES });
  }
  // Oggi (#30) reads its data in the browser: a fixed day, served by a fake,
  // so the reference does not depend on what other suites write in the Nest.
  // /aggiungi is Oggi under the sheet.
  const isOggi = route === "/oggi" || route === "/aggiungi";
  if (isOggi) await installOggiFake(page, { scenario: "normale" });
  await page.goto(route);
  await expect(page.getByRole("main")).toBeVisible();
  if (isOggi) {
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
      timeout: 20_000,
    });
  }
  if (isSpesa) await expect(page.getByTestId("spesa-riga")).toHaveCount(7);
  // The week of Calendario reads its events in the browser: wait for them.
  if (route === "/calendario")
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

for (const p of PAGES) {
  test(`cornice: ${p.route}`, async ({ page }, testInfo) => {
    await open(page, p.route);
    const h1 =
      testInfo.project.name === "desktop" && p.h1Desktop ? p.h1Desktop : p.h1;
    await expect(
      page.getByRole("heading", { level: 1, name: h1 }),
    ).toBeVisible();
    if (p.route === "/ricerca") {
      // The field has the focus when the page is ready (and so the ring).
      await expect(page.locator("input.campo-ricerca__input")).toBeFocused();
      await waitForAnimationsToEnd(page);
    }
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
