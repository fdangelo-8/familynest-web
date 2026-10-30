import { expect, test } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { FAMILY, MORE, userWithNest } from "./persone-helpers";
import { openReady, readyUser, settle } from "./pronto-helpers";

// Onboarding step 4 "Pronto" (#15): one screenshot per state, at 390 and
// 1280 px (the two projects). Each test has its own throwaway user with a Nest
// written with the administrative key. Skipped when the keys are not set.

const START = new Date("2026-10-29T10:00:00+01:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

test.skip(!throwawayConfigured(), throwawaySkipReason);

test.describe("onboarding · pronto", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: START });
  });

  test("normale (invito a Laura)", async ({ page, baseURL }) => {
    const user = await readyUser("family_with_children", FAMILY, ["Laura"]);
    try {
      await openReady(page, user, baseURL);
      await expect(
        page.getByText("Invito condiviso con Laura").filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot("normale.png", { fullPage: true });
    } finally {
      await user.remove();
    }
  });

  test("vuoto (Solo io)", async ({ page, baseURL }) => {
    const user = await readyUser("single", []);
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      await expect(page).toHaveScreenshot("vuoto.png", { fullPage: true });
    } finally {
      await user.remove();
    }
  });

  test("dieci membri", async ({ page, baseURL }) => {
    const user = await readyUser(
      "family_with_children",
      [...FAMILY, ...MORE],
      ["Laura"],
    );
    try {
      await openReady(page, user, baseURL);
      await settle(page);
      await expect(page).toHaveScreenshot("dieci-membri.png", {
        fullPage: true,
      });
    } finally {
      await user.remove();
    }
  });

  test("inviti a due persone", async ({ page, baseURL }) => {
    const user = await readyUser(
      "family_with_children",
      [...FAMILY, MORE[0]!],
      ["Laura", "Nonna Rosa"],
    );
    try {
      await openReady(page, user, baseURL);
      await expect(
        page
          .getByText("Inviti condivisi con Laura e Nonna Rosa")
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot("inviti-due.png", {
        fullPage: true,
      });
    } finally {
      await user.remove();
    }
  });

  test("inviti a tre persone", async ({ page, baseURL }) => {
    const user = await readyUser(
      "family_with_children",
      [...FAMILY, MORE[0]!, MORE[1]!],
      ["Laura", "Nonna Rosa", "Zio Piero"],
    );
    try {
      await openReady(page, user, baseURL);
      await expect(
        page
          .getByText("Inviti condivisi con 3 persone")
          .filter({ visible: true }),
      ).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot("inviti-tre.png", {
        fullPage: true,
      });
    } finally {
      await user.remove();
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
        await page.goto("/onboarding/pronto");
        await expect(
          page.getByText("Stiamo preparando la casa").first(),
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
