import { expect, test } from "@playwright/test";
import {
  SEARCH_NOW,
  isDesktop,
  openSearch,
  searchAndWait,
  searchField,
  shot,
} from "../fixtures/ricerca-open";
import { installRicercaFake, seedRecents } from "../fixtures/ricerca-fake";
import { signInAsCached } from "../fixtures/visual-login-cached";
import { hasTestUser } from "../fixtures/visual-login";

// Ricerca (#40) at 390 px (page) and 1280 px (palette), in every state of the
// graphic specification: initial, with recent searches, results, all four
// kinds, nothing found, nothing in the chosen filter, loading, error, offline
// with the sections under the notice, and the period-only search with an
// «Occupato» row. The results come from a fake of `search_household`
// (tests/fixtures/ricerca-fake.ts): one reference per example, never the data
// other suites write. The clock is fixed to Tuesday 20 October 2026, 15:52.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip(!hasTestUser("A"), "TEST_USER_A_* non impostati");
  await page.clock.setFixedTime(SEARCH_NOW);
  const signedIn = await signInAsCached(context, baseURL!, "A");
  test.skip(!signedIn, "utente di test A non ancora creato (#55)");
});

test("ricerca: stato iniziale", async ({ page }, testInfo) => {
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await shot(page, testInfo, "iniziale.png");
});

test("ricerca: stato iniziale con ricerche recenti", async ({
  page,
  context,
}, testInfo) => {
  await installRicercaFake(page);
  await seedRecents(page, context, ["nuoto", "bollo auto", "questo weekend"]);
  await openSearch(page, testInfo);
  await expect(page.getByTestId("ricerca-recenti")).toBeVisible();
  await shot(page, testInfo, "iniziale-recenti.png");
});

test("ricerca: risultati per «nuoto»", async ({ page }, testInfo) => {
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await searchAndWait(page, "nuoto");
  await expect(page.getByTestId("ricerca-riga")).toHaveCount(5);
  await shot(page, testInfo, "risultati-nuoto.png");
});

test("ricerca: risultati di tutti i tipi per «auto»", async ({
  page,
}, testInfo) => {
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await searchAndWait(page, "auto");
  await expect(page.getByTestId("ricerca-riga")).toHaveCount(5);
  await shot(page, testInfo, "risultati-auto.png");
});

test("ricerca: filtro scelto con risultati (Impegni)", async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), "i filtri sono solo su telefono");
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await searchAndWait(page, "nuoto");
  await page.getByRole("button", { name: /^Impegni/ }).click();
  await expect(page.getByTestId("ricerca-riga")).toHaveCount(3);
  await shot(page, testInfo, "filtro-impegni.png");
});

test("ricerca: nessun risultato", async ({ page }, testInfo) => {
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await searchAndWait(page, "piscina olimpica");
  await expect(page.getByTestId("ricerca-vuoto")).toBeVisible();
  await shot(page, testInfo, "vuoto.png");
});

test("ricerca: nessun risultato nel filtro scelto", async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), "i filtri sono solo su telefono");
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await page.getByRole("button", { name: "Spesa", exact: true }).click();
  await searchAndWait(page, "nuoto");
  await expect(page.getByTestId("ricerca-vuoto")).toBeVisible();
  await shot(page, testInfo, "vuoto-filtro.png");
});

test("ricerca: caricamento", async ({ page }, testInfo) => {
  await installRicercaFake(page, { mode: "slow" });
  await openSearch(page, testInfo);
  await searchField(page).fill("nuoto");
  await expect(page.getByTestId("ricerca-caricamento")).toBeVisible();
  await shot(page, testInfo, "caricamento.png");
});

test("ricerca: errore", async ({ page }, testInfo) => {
  await installRicercaFake(page, { mode: "error" });
  await openSearch(page, testInfo);
  await searchField(page).fill("nuoto");
  await expect(page.getByTestId("ricerca-errore")).toBeVisible();
  await shot(page, testInfo, "errore.png");
});

test("ricerca: offline, con le sezioni sotto l'avviso", async ({
  page,
  context,
}, testInfo) => {
  await installRicercaFake(page);
  await seedRecents(page, context, ["nuoto", "bollo auto"]);
  await openSearch(page, testInfo);
  try {
    await context.setOffline(true);
    await searchField(page).fill("nuoto");
    await expect(page.getByTestId("ricerca-offline")).toBeVisible();
    await expect(page.getByTestId("ricerca-recenti")).toBeVisible();
    await expect(page.getByTestId("ricerca-esempi")).toBeVisible();
    await shot(page, testInfo, "offline.png");
  } finally {
    await context.setOffline(false);
  }
});

test("ricerca: solo periodo, con una riga «Occupato»", async ({
  page,
}, testInfo) => {
  await installRicercaFake(page);
  await openSearch(page, testInfo);
  await searchAndWait(page, "questo weekend");
  await expect(page.getByTestId("ricerca-riga")).toHaveCount(2);
  await shot(page, testInfo, "weekend.png");
});
