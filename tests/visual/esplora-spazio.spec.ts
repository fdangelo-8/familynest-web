import { expect, test, type Page } from "@playwright/test";
import {
  failRequests,
  FULL,
  holdRequests,
  PINNED_READ,
  toast,
  withNest,
} from "../fixtures/esplora";
import {
  busyArea,
  h1,
  INTEREST_ADD,
  INTEREST_READ,
  MEMBERS_READ,
  notifyButton,
  openSpace,
  SPACE_PATH,
} from "../fixtures/esplora-spazio-visivo";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Esplora · «In arrivo» (#29): one screenshot per state, at 390 and 1280 px
// (projects). Every state uses a throwaway Nest (deleted at the end) with
// fixed names and colours. The clock is fixed; the toast stays on screen
// because the clock is paused before the click. The references are generated
// in the CI container (workflow visual-baseline).

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

const NOW = new Date("2026-10-20T15:00:00+02:00");

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

test("normale: A tavola, fissato, avviso da chiedere", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.pinAll(["A tavola"]);
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "a-tavola", "A tavola");
    await expect(notifyButton(page)).toHaveText("Avvisami quando è pronto");
    await shoot(page, "normale.png");
  });
});

test("non fissato", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "a-tavola", "A tavola");
    await shoot(page, "non-fissato.png");
  });
});

test("conferma: avviso chiesto, con il toast", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.pinAll(["A tavola"]);
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "a-tavola", "A tavola");
    await page.clock.pauseAt(new Date(NOW.getTime() + 60_000));
    await notifyButton(page).click();
    await expect(notifyButton(page)).toHaveText("Ti avvisiamo appena è pronto");
    await expect(toast(page)).toContainText("Ti avvisiamo quando A tavola");
    await shoot(page, "conferma.png");
  });
});

test("avviso tolto, con il toast", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.pinAll(["A tavola"]);
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "a-tavola", "A tavola");
    await page.clock.pauseAt(new Date(NOW.getTime() + 60_000));
    await notifyButton(page).click();
    await expect(notifyButton(page)).toHaveText("Ti avvisiamo appena è pronto");
    await notifyButton(page).click();
    await expect(notifyButton(page)).toHaveText("Avvisami quando è pronto");
    await expect(toast(page)).toContainText("Non ti avvisiamo più per");
    await shoot(page, "avviso-tolto.png");
  });
});

test("avviso già chiesto, riaprendo la pagina", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    const { error } = await nest.user.client.rpc("add_space_interest", {
      p_space: "meals",
    });
    expect(error).toBeNull();
    await nest.pinAll(["A tavola"]);
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "a-tavola", "A tavola");
    await expect(notifyButton(page)).toHaveText("Ti avvisiamo appena è pronto");
    await shoot(page, "avviso-gia-chiesto.png");
  });
});

test("caricamento: testo visibile, scheletro al posto del bottone", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    const holdPins = await holdRequests(page, PINNED_READ);
    const holdInterest = await holdRequests(page, INTEREST_READ);
    try {
      await page.goto(SPACE_PATH("a-tavola"), { waitUntil: "commit" });
      await expect(h1(page)).toHaveText("A tavola");
      await expect(busyArea(page)).toHaveCount(1);
      await shoot(page, "caricamento.png");
    } finally {
      holdPins.release();
      holdInterest.release();
    }
  });
});

test("caricamento di Crescere: anche il paragrafo è uno scheletro", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    const holdPins = await holdRequests(page, PINNED_READ);
    const holdMembers = await holdRequests(page, MEMBERS_READ);
    try {
      await page.goto(SPACE_PATH("crescere"), { waitUntil: "commit" });
      await expect(h1(page)).toHaveText("Crescere");
      await expect(busyArea(page)).toHaveCount(1);
      await shoot(page, "caricamento-crescere.png");
    } finally {
      holdPins.release();
      holdMembers.release();
    }
  });
});

test("errore di lettura: avviso al posto del bottone", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await failRequests(page, INTEREST_READ);
    await page.goto(SPACE_PATH("a-tavola"));
    await expect(
      page.getByRole("alert").filter({ hasText: "Non riusciamo a caricare" }),
    ).toBeVisible({ timeout: 20_000 });
    await shoot(page, "errore-lettura.png");
  });
});

test("errore nel salvare l'avviso: toast", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "a-tavola", "A tavola");
    await failRequests(page, INTEREST_ADD);
    await page.clock.pauseAt(new Date(NOW.getTime() + 60_000));
    await notifyButton(page).click();
    await expect(toast(page)).toContainText(
      "Non siamo riusciti ad attivare l'avviso per A tavola",
    );
    await expect(notifyButton(page)).toHaveText("Avvisami quando è pronto");
    await shoot(page, "errore-salvataggio.png");
  });
});

test("altri spazi: senza lista, con i nomi (Crescere)", async ({
  page,
  baseURL,
}) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "crescere", "Crescere");
    await expect(page.getByText("Tutto su Anna, Bea e Carlo")).toBeVisible();
    await expect(page.locator("main ul.lista")).toHaveCount(0);
    await shoot(page, "crescere.png");
  });
});

test("nome lungo che va a capo: Tempo insieme", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await openSpace(page, "tempo-insieme", "Tempo insieme");
    await shoot(page, "tempo-insieme.png");
  });
});

test("spazio che non c'è", async ({ page, baseURL }) => {
  await withNest(FULL, async (nest) => {
    await nest.signIn(page, baseURL);
    await page.clock.install({ time: NOW });
    await page.goto(SPACE_PATH("non-esiste"));
    await expect(
      page.getByRole("heading", { name: /Questa pagina non c.è/ }),
    ).toBeVisible();
    await shoot(page, "non-trovata.png");
  });
});
