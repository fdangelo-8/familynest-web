import { expect, test, type Page } from "@playwright/test";
import {
  STANDARD_FAKE_ACCOUNT,
  fakeCalendar,
  fakeCalendarConfigured,
  fakeCalendarSkipReason,
} from "../fixtures/calendar-fake";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { userWithNest } from "./persone-helpers";
import {
  OUTLOOK_ACCOUNT,
  PATH,
  collega,
  forget,
  holdSubmit,
  leaveResult,
  linkAccount,
  openStep,
  settle,
  withRole,
} from "./calendario-helpers";

// Onboarding step 3 "Porta qui il tuo calendario" (#37): one screenshot per
// state, at 390 and 1280 px (the two projects), and the first line of Pronto.
// Each test has its own throwaway user with a Nest written with the
// administrative key; accounts come from the fake provider and the notices
// from the short cookie the route leaves. The technical error of the whole
// step is the shared `OnboardingError` (it needs the database to fail) and is
// checked by hand, not here. There is no iCloud row (decision of Francesco).
// Skipped when the keys are not set.

const START = new Date("2026-10-29T10:00:00+01:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);
test.skip(!fakeCalendarConfigured(), fakeCalendarSkipReason);

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: START });
});

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });

test.describe("onboarding · calendario", () => {
  test("iniziale (amministratore, passo 3 di 4)", async ({ page, baseURL }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 4" }).filter({
          visible: true,
        }),
      ).toBeVisible();
      await settle(page);
      await shot(page, "iniziale-amministratore");
    });
  });

  test("iniziale (Nest da solo, passo 3 di 3)", async ({ page, baseURL }) => {
    await withRole("single", async (user) => {
      await openStep(page, user, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 3 di 3" }).filter({
          visible: true,
        }),
      ).toBeVisible();
      await settle(page);
      await shot(page, "iniziale-da-solo");
    });
  });

  test("iniziale (invitato, passo 2 di 3, senza freccia)", async ({
    page,
    baseURL,
  }) => {
    await withRole("invited", async (user) => {
      await openStep(page, user, baseURL);
      await expect(
        page.getByRole("progressbar", { name: "Passo 2 di 3" }).filter({
          visible: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Indietro" })).toHaveCount(0);
      await settle(page);
      await shot(page, "iniziale-invitato");
    });
  });

  test("collegamento in corso", async ({ page, baseURL }) => {
    await withRole("couple", async (user) => {
      try {
        await fakeCalendar(baseURL as string).setup({
          userId: user.id,
          ...STANDARD_FAKE_ACCOUNT,
        });
        await openStep(page, user, baseURL);
        await holdSubmit(page);
        await collega(page, "Google").click();
        await expect(
          page.getByText("Collegamento", { exact: true }).filter({
            visible: true,
          }),
        ).toBeVisible();
        await settle(page);
        await shot(page, "collegamento-in-corso");
      } finally {
        await forget(user, baseURL);
      }
    });
  });

  test("collegato (Outlook, 2 calendari)", async ({ page, baseURL }) => {
    await withRole("couple", async (user) => {
      try {
        await openStep(page, user, baseURL);
        await linkAccount(page, user, baseURL, "outlook", OUTLOOK_ACCOUNT);
        await expect(
          page.getByText("marco@studio.it · 2 calendari").filter({
            visible: true,
          }),
        ).toBeVisible();
        await settle(page);
        await shot(page, "collegato");
      } finally {
        await forget(user, baseURL);
      }
    });
  });

  test("errore generico (wifi-off)", async ({ page, baseURL }) => {
    await withRole("couple", async (user) => {
      await leaveResult(page, baseURL, "google", "failed");
      await openStep(page, user, baseURL);
      await expect(
        page
          .getByText(
            "Non siamo riusciti a collegare Google. Riprova o salta questo passo.",
          )
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await shot(page, "errore-generico");
    });
  });

  test("permesso del calendario mancante (circle-alert)", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      await leaveResult(page, baseURL, "google", "no_calendar_permission");
      await openStep(page, user, baseURL);
      await expect(
        page
          .getByText("Google ci ha dato l'accesso all'account", {
            exact: false,
          })
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await shot(page, "permesso-mancante");
    });
  });

  test("approvazione dell'amministratore (circle-alert)", async ({
    page,
    baseURL,
  }) => {
    await withRole("couple", async (user) => {
      await leaveResult(page, baseURL, "outlook", "admin_approval");
      await openStep(page, user, baseURL);
      await expect(
        page
          .getByText("Il tuo account di lavoro non permette", { exact: false })
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await shot(page, "approvazione-amministratore");
    });
  });

  test("offline", async ({ page, baseURL }) => {
    await withRole("couple", async (user) => {
      await openStep(page, user, baseURL);
      await page.context().setOffline(true);
      await expect(
        page
          .getByText("Sei offline: per collegare un calendario serve", {
            exact: false,
          })
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(collega(page, "Google")).toBeDisabled();
      await settle(page);
      await shot(page, "offline");
    });
  });

  test.describe("caricamento", () => {
    // The shell of the page (with the skeleton) comes first and the content
    // streams in after it. Without scripts the content never replaces the
    // skeleton, so the skeleton stays on screen to be photographed.
    test.use({ javaScriptEnabled: false });

    test("scheletro", async ({ page, baseURL }) => {
      const user = await userWithNest("couple", []);
      try {
        await user.signInContext(page.context(), baseURL as string);
        await page.goto(PATH);
        await expect(
          page.getByText("Caricamento in corso").first(),
        ).toBeAttached();
        await page.mouse.move(0, 0);
        await shot(page, "caricamento");
      } finally {
        await user.remove();
      }
    });
  });

  test("Pronto: «N impegni arrivati da Google»", async ({ page, baseURL }) => {
    await withRole("single", async (user) => {
      const fake = fakeCalendar(baseURL as string);
      try {
        await openStep(page, user, baseURL);
        await linkAccount(page, user, baseURL, "google", STANDARD_FAKE_ACCOUNT);
        await fake.setEvents({
          userId: user.id,
          email: STANDARD_FAKE_ACCOUNT.email,
          calendarId: "personale",
          events: Array.from({ length: 12 }, (_, i) => {
            const start = new Date(Date.now() + (i + 1) * 86_400_000);
            return {
              id: `evento-${i}`,
              title: `Impegno ${i}`,
              startsAt: start.toISOString(),
              endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
            };
          }),
        });
        await fake.sync(user.id);
        await page.goto("/onboarding/pronto");
        await expect(
          page.getByText("12 impegni arrivati da Google").filter({
            visible: true,
          }),
        ).toBeVisible();
        await settle(page);
        await shot(page, "pronto-impegni");
      } finally {
        await forget(user, baseURL);
      }
    });
  });
});
