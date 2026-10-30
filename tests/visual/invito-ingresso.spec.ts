import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  answerContinue,
  caseNest,
  caseVisitor,
  giuliaInOtherNest,
  holdProviderSignIn,
  openColor,
  openLink,
  removeShared,
  settle,
  shown,
  shownText,
  signIn,
  waitBusyButton,
  waitWelcome,
} from "./invito-ingresso-helpers";

// Invitation entry (#16): one screenshot per state of Benvenuto (/invito,
// mockup 07) and of Il tuo colore (/invito/colore, mockup 08), at 390 and
// 1280 px (the two projects). The Nests and users are made once per worker
// with the administrative key and removed when the file ends; the pages only
// read. The answers of the «Continua» server action are given by the test, so
// nothing ever joins a Nest. The whole-page technical error is the shared
// `OnboardingError` (it needs the auth server to fail) and is checked by
// hand, not here. Skipped when the keys are not set.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);
test.afterAll(removeShared);

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name, { fullPage: true });

const TAKEN_BY_PIETRO = [
  { color: "pomodoro", by: "Marco" },
  { color: "salvia", by: "Sofia" },
  { color: "cobalto", by: "Tommaso" },
  { color: "zafferano", by: "Biscotto" },
  { color: "peonia", by: "Pietro" },
];

const avviso = (page: Page) =>
  page.locator(".avviso").filter({ visible: true });

test.describe("invito · benvenuto (07)", () => {
  test("normale", async ({ page }) => {
    const nest = await caseNest("mockup");
    await openLink(page, nest.token);
    await waitWelcome(page);
    await settle(page);
    await shot(page, "07-normale.png");
  });

  test("senza messaggio", async ({ page }) => {
    const nest = await caseNest("senza-messaggio");
    await openLink(page, nest.token);
    await waitWelcome(page);
    await settle(page);
    await shot(page, "07-senza-messaggio.png");
  });

  test("molti membri: tre avatar e +N", async ({ page }) => {
    const nest = await caseNest("molti");
    await openLink(page, nest.token);
    await waitWelcome(page);
    await expect(
      page.getByRole("img", { name: "Marco e altri 8 nel Nest" }).first(),
    ).toBeAttached();
    await settle(page);
    await shot(page, "07-molti-membri.png");
  });

  test("nomi lunghi", async ({ page }) => {
    const nest = await caseNest("lunghi");
    await openLink(page, nest.token);
    await waitWelcome(page);
    await settle(page);
    await shot(page, "07-nomi-lunghi.png");
  });

  test("accesso in corso", async ({ page }) => {
    const nest = await caseNest("mockup");
    await holdProviderSignIn(page);
    await openLink(page, nest.token);
    await waitWelcome(page);
    await shown(page, "button", "Entra con Google").click({
      noWaitAfter: true,
    });
    await waitBusyButton(page, "Accesso con Google in corso");
    await settle(page);
    await shot(page, "07-accesso-in-corso.png");
  });

  test("invito scaduto", async ({ page }) => {
    // Any token that is not a live invitation gives the same page.
    await page.goto(`/invito/${"a1".repeat(32)}`);
    await expect(page).toHaveURL(/\/invito$/);
    await page.locator("h1:visible").first().waitFor();
    await expect(
      page.getByText("Chiedi a chi ti ha invitato", { exact: false }).first(),
    ).toBeAttached();
    await settle(page);
    await shot(page, "07-invito-scaduto.png");
  });

  test("già in un altro Nest", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    const giulia = await giuliaInOtherNest();
    await signIn(page, baseURL, giulia);
    await page.goto(`/invito/${nest.token}`);
    await expect(page).toHaveURL(/stato=altro-nest/);
    await page.locator("h1:visible").first().waitFor();
    await settle(page);
    await shot(page, "07-altro-nest.png");
  });

  test("accesso non riuscito", async ({ page }) => {
    const nest = await caseNest("mockup");
    await openLink(page, nest.token);
    await page.goto("/invito?errore=google");
    await expect(shownText(page, "alert", /non riuscito/)).toBeVisible();
    await settle(page);
    await shot(page, "07-accesso-non-riuscito.png");
  });

  test("accesso annullato", async ({ page }) => {
    const nest = await caseNest("mockup");
    await openLink(page, nest.token);
    await page.goto("/invito?errore=google&annullato=1");
    await expect(shownText(page, "status", /annullato/)).toBeVisible();
    await settle(page);
    await shot(page, "07-accesso-annullato.png");
  });

  test.describe("caricamento della pagina", () => {
    // The shell of the page (with the skeleton) comes first and the content
    // streams in after it. Without scripts the content never replaces the
    // skeleton, so the skeleton stays on screen to be photographed.
    test.use({ javaScriptEnabled: false });

    test("scheletro", async ({ page }) => {
      await page.goto("/invito");
      await expect(
        page.getByText("Caricamento in corso").first(),
      ).toBeAttached();
      await page.mouse.move(0, 0);
      await shot(page, "07-scheletro.png");
    });
  });
});

test.describe("invito · il tuo colore (08)", () => {
  test("normale", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await settle(page);
    await shot(page, "08-normale.png");
  });

  test("altro colore scelto", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await shown(page, "radio", "Peonia").click();
    await expect(shown(page, "radio", "Peonia")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await settle(page);
    await shot(page, "08-altro-colore.png");
  });

  test("dieci colori, con molti membri", async ({ page, baseURL }) => {
    // Nine others take nine colours: only the one of the invited is free.
    const nest = await caseNest("molti");
    await openColor(page, baseURL, await caseVisitor("molti"), nest.token);
    await settle(page);
    await shot(page, "08-molti-membri.png");
  });

  test("continua in corso", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    await answerContinue(page, "hold");
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await shown(page, "button", "Continua").click();
    await waitBusyButton(page, "Continua");
    await settle(page);
    await shot(page, "08-continua-in-corso.png");
  });

  test("colore preso nel frattempo", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    await answerContinue(page, { status: "taken", taken: TAKEN_BY_PIETRO });
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await shown(page, "radio", "Peonia").click();
    await shown(page, "button", "Continua").click();
    await expect(
      shownText(
        page,
        "alert",
        "Pietro ha appena preso la peonia. Scegli un altro colore.",
      ),
    ).toBeVisible();
    await settle(page);
    await shot(page, "08-colore-preso.png");
  });

  test("nessun colore scelto", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    // The colour the inviter gave is taken too: no colour is left chosen.
    await answerContinue(page, {
      status: "taken",
      taken: [...TAKEN_BY_PIETRO, { color: "glicine", by: "Pietro" }],
    });
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await shown(page, "button", "Continua").click();
    await expect(avviso(page)).toBeVisible();
    await shown(page, "button", "Continua").click();
    await expect(
      page.getByText("Scegli un colore per continuare.").filter({
        visible: true,
      }),
    ).toBeVisible();
    await settle(page);
    await shot(page, "08-nessun-colore.png");
  });

  for (const kind of ["network", "server"] as const) {
    test(`errore: ${kind === "network" ? "rete" : "server"}`, async ({
      page,
      baseURL,
    }) => {
      const nest = await caseNest("mockup");
      await answerContinue(page, { status: "error", kind });
      await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
      await shown(page, "button", "Continua").click();
      await expect(avviso(page)).toBeVisible();
      await settle(page);
      await shot(
        page,
        kind === "network" ? "08-errore-rete.png" : "08-errore-server.png",
      );
    });
  }

  test("Nest al completo", async ({ page, baseURL }) => {
    const nest = await caseNest("mockup");
    await answerContinue(page, { status: "full" });
    await openColor(page, baseURL, await caseVisitor("mockup"), nest.token);
    await shown(page, "button", "Continua").click();
    await expect(
      shownText(
        page,
        "alert",
        "Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.",
      ),
    ).toBeVisible();
    await settle(page);
    await shot(page, "08-nest-al-completo.png");
  });

  test.describe("caricamento della pagina", () => {
    test.use({ javaScriptEnabled: false });

    test("scheletro", async ({ page, baseURL }) => {
      // Signed in, with the invitation: no redirect after the shell is sent.
      const nest = await caseNest("mockup");
      await signIn(page, baseURL, await caseVisitor("mockup"));
      await page.goto(`/invito/${nest.token}`);
      await page.goto("/invito/colore");
      await expect(
        page.getByText("Caricamento in corso").first(),
      ).toBeAttached();
      await page.mouse.move(0, 0);
      await shot(page, "08-scheletro.png");
    });
  });
});
