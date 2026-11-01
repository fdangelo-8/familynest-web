import { expect, test, type Page } from "@playwright/test";
import {
  busy,
  cards,
  errorBox,
  failRequests,
  FULL,
  h1,
  holdRequests,
  openEsplora,
  PATH,
  PINNED_READ,
  pinFix,
  SOLO,
  toast,
  withNest,
} from "../fixtures/esplora";
import type { MemberSpec } from "../fixtures/casa";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Esplora (#28): one screenshot per state, at 390 and 1280 px (projects).
// Every state uses a throwaway Nest (deleted at the end), with fixed names and
// colours, so the shots do not depend on other suites. The clock is fixed and
// paused before the pin is touched: the toast stays on screen.
// The references are generated in the CI container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

const NOW = new Date("2026-10-20T15:00:00+02:00");

/** Two adults, nobody else: no Crescere and no Zampe (8 spaces). */
const COUPLE: MemberSpec[] = FULL.slice(0, 2);

const SIX = [
  "A tavola",
  "Noi due",
  "Stare bene",
  "Tempo insieme",
  "Passioni",
  "Casa in ordine",
];

/** The window as tall as the page: sticky bar and navigation sit at its ends. */
async function fit(page: Page) {
  const base = page.viewportSize()!;
  for (let i = 0; i < 2; i++) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({
      width: base.width,
      height: Math.max(base.height, height),
    });
  }
}

async function shoot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await fit(page);
  await expect(page).toHaveScreenshot(name);
}

/** Opens Esplora with a fixed clock, then stops it (the toast never closes). */
async function openFrozen(page: Page, count: number) {
  await page.clock.install({ time: NOW });
  await openEsplora(page, count);
  await page.clock.pauseAt(new Date(NOW.getTime() + 60_000));
}

test("normale: dieci spazi, due fissati", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.pinAll(["A tavola", "Stare bene"]);
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openEsplora(page, 10);
    await expect(
      page.getByRole("button", { name: "Togli A tavola da Oggi" }),
    ).toHaveAttribute("aria-pressed", "true");
    await shoot(page, "normale.png");
  });
});

test("caricamento", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    const hold = await holdRequests(page, PINNED_READ);
    try {
      await page.goto(PATH, { waitUntil: "commit" });
      await expect(h1(page)).toBeVisible();
      await expect(busy(page)).toHaveCount(1);
      await expect(busy(page).locator(".skeleton--scheda")).toHaveCount(6);
      await shoot(page, "caricamento.png");
    } finally {
      hold.release();
    }
  });
});

test("toast dopo aver fissato Zampe", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await openFrozen(page, 10);
    await pinFix(page, "Zampe").click();
    await expect(toast(page)).toContainText("Zampe fissato in fondo a Oggi.");
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();
    await shoot(page, "toast-fissato.png");
  });
});

test("limite di sei spazi fissati", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.pinAll(SIX);
    await nest.signIn(page, baseURL);
    await openFrozen(page, 10);
    await pinFix(page, "Progetti").click();
    await expect(toast(page)).toContainText(
      "Puoi fissare al massimo sei spazi: togline uno per fissare Progetti.",
    );
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toHaveCount(0);
    await shoot(page, "limite.png");
  });
});

test("errore di lettura", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await failRequests(page, PINNED_READ);
    await page.goto(PATH);
    await expect(errorBox(page)).toBeVisible({ timeout: 20_000 });
    await shoot(page, "errore.png");
  });
});

test("casa senza figli né animali: otto spazi", async ({ page, baseURL }) => {
  await withNest(COUPLE, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openEsplora(page, 8);
    await expect(cards(page)).toHaveCount(8);
    await shoot(page, "senza-figli-animali.png");
  });
});

test("solo io: sei spazi", async ({ page, baseURL }) => {
  await withNest(SOLO, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openEsplora(page, 6);
    await shoot(page, "solo-io.png");
  });
});
