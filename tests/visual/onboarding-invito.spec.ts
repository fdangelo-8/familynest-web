import { expect, test, type Page } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { FAMILY, userWithNest } from "./persone-helpers";
import {
  breakClipboard,
  CARLA,
  failInvite,
  FRESH_NOTE,
  LONG_NAMES,
  openInvite,
  settle,
  shown,
} from "./invito-helpers";

// Onboarding step 4 "Invito" (#14, without QR): one screenshot per state, at
// 390 and 1280 px (the two projects). Each test has its own throwaway user
// with a Nest written with the administrative key; the page creates the
// invitations. The whole-page error is the shared `OnboardingError` (it needs
// the auth server to fail) and is checked by hand, not here. Skipped when the
// keys are not set.

const START = new Date("2026-10-29T10:00:00+01:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
  permissions: ["clipboard-read", "clipboard-write"],
});

test.skip(!throwawayConfigured(), throwawaySkipReason);

/** The still clock keeps the toast on screen until the screenshot. */
async function freezeClock(page: Page) {
  await page.clock.pauseAt(new Date("2026-10-29T10:01:00+01:00"));
}

async function copyLink(page: Page) {
  await expect(async () => {
    await shown(page, "button", "Copia il link").click();
    await expect(
      page.getByRole("status").filter({ hasText: "Link copiato" }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test.describe("onboarding · invito", () => {
  test("normale", async ({ page, baseURL }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await openInvite(page, user, baseURL);
      await expect(
        page.getByText(FRESH_NOTE).filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot("normale.png", { fullPage: true });
    } finally {
      await user.remove();
    }
  });

  test("link copiato", async ({ page, baseURL }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await page.clock.install({ time: START });
      await openInvite(page, user, baseURL);
      await freezeClock(page);
      await copyLink(page);
      await settle(page);
      await expect(page).toHaveScreenshot("link-copiato.png", {
        fullPage: true,
      });
    } finally {
      await user.remove();
    }
  });

  test("copia non riuscita", async ({ page, baseURL }) => {
    const user = await userWithNest("family_with_children", FAMILY);
    try {
      await breakClipboard(page);
      await openInvite(page, user, baseURL);
      await expect(async () => {
        await shown(page, "button", "Copia il link").click();
        await expect(
          page.getByRole("alert").filter({ hasText: "Non siamo riusciti" }),
        ).toBeVisible({ timeout: 1000 });
      }).toPass();
      await settle(page);
      await expect(page).toHaveScreenshot("copia-non-riuscita.png", {
        fullPage: true,
      });
    } finally {
      await user.remove();
    }
  });

  test.describe("più adulti", () => {
    test("primo di due", async ({ page, baseURL }) => {
      const user = await userWithNest("family_with_children", [
        ...FAMILY,
        CARLA,
      ]);
      try {
        await openInvite(page, user, baseURL);
        await expect(
          page
            .getByText("Ultimo passo · invito 1 di 2")
            .filter({ visible: true }),
        ).toBeVisible();
        await settle(page);
        await expect(page).toHaveScreenshot("invito-1-di-2.png", {
          fullPage: true,
        });
      } finally {
        await user.remove();
      }
    });

    test("secondo di due", async ({ page, baseURL }) => {
      const user = await userWithNest("family_with_children", [
        ...FAMILY,
        CARLA,
      ]);
      try {
        await openInvite(page, user, baseURL);
        await expect(async () => {
          await shown(page, "button", "Ora invita Carla").click();
          await expect(page).toHaveURL(/persona=2/, { timeout: 1000 });
        }).toPass();
        await expect(shown(page, "heading", "Invita Carla")).toBeVisible();
        await expect(
          page
            .getByText("Ultimo passo · invito 2 di 2")
            .filter({ visible: true }),
        ).toBeVisible();
        await settle(page);
        await expect(page).toHaveScreenshot("invito-2-di-2.png", {
          fullPage: true,
        });
      } finally {
        await user.remove();
      }
    });
  });

  test.describe("nomi lunghi", () => {
    test("primo, bottoni accorciati", async ({ page, baseURL }) => {
      const user = await userWithNest("family_with_children", LONG_NAMES);
      try {
        await openInvite(page, user, baseURL);
        await expect(shown(page, "button", "Manda il link")).toBeVisible();
        await expect(shown(page, "button", "Invita il prossimo")).toBeVisible();
        await settle(page);
        await expect(page).toHaveScreenshot("nomi-lunghi-primo.png", {
          fullPage: true,
        });
      } finally {
        await user.remove();
      }
    });

    test("ultimo, con il toast", async ({ page, baseURL }) => {
      const user = await userWithNest("family_with_children", LONG_NAMES);
      try {
        await page.clock.install({ time: START });
        await openInvite(page, user, baseURL);
        await expect(async () => {
          await shown(page, "button", "Invita il prossimo").click();
          await expect(page).toHaveURL(/persona=2/, { timeout: 1000 });
        }).toPass();
        await expect(
          page
            .getByText("Ultimo passo · invito 2 di 2")
            .filter({ visible: true }),
        ).toBeVisible();
        await freezeClock(page);
        await copyLink(page);
        await settle(page);
        await expect(page).toHaveScreenshot("nomi-lunghi-ultimo-copiato.png", {
          fullPage: true,
        });
      } finally {
        await user.remove();
      }
    });
  });

  test.describe("invito non preparato", () => {
    for (const failure of ["server", "network"] as const) {
      test(
        failure === "server" ? "errore del server" : "senza rete",
        async ({ page, baseURL }) => {
          const user = await userWithNest("family_with_children", [
            ...FAMILY,
            CARLA,
          ]);
          try {
            await openInvite(page, user, baseURL);
            await failInvite(page, failure);
            await expect(async () => {
              await shown(page, "button", "Ora invita Carla").click();
              await expect(page.getByRole("alert")).toBeVisible({
                timeout: 2000,
              });
            }).toPass();
            await expect(shown(page, "button", "Riprova")).toBeVisible();
            await settle(page);
            await expect(page).toHaveScreenshot(
              failure === "server"
                ? "non-preparato-server.png"
                : "non-preparato-rete.png",
              { fullPage: true },
            );
          } finally {
            await user.remove();
          }
        },
      );
    }
  });

  test.describe("caricamento", () => {
    // The shell of the page (with the skeleton) comes first and the content
    // streams in after it. Without scripts the content never replaces the
    // skeleton, so the skeleton stays on screen to be photographed.
    test.use({ javaScriptEnabled: false });

    test("scheletro", async ({ page, baseURL }) => {
      const user = await userWithNest("family_with_children", FAMILY);
      try {
        await user.signInContext(page.context(), baseURL as string);
        await page.goto("/onboarding/invito");
        await expect(
          page.getByText("Caricamento in corso").first(),
        ).toBeAttached();
        // No scripts, so no page.evaluate: just take the pointer away.
        await page.mouse.move(0, 0);
        await expect(page).toHaveScreenshot("caricamento.png", {
          fullPage: true,
        });
      } finally {
        await user.remove();
      }
    });
  });
});
