import { expect, test } from "@playwright/test";
import {
  createPasswordUser,
  mailField,
  passwordField,
  submitButton,
} from "../fixtures/accesso-password";
import { skipReason, usersConfigured } from "../fixtures/auth";
import {
  forgotLink,
  needKeys,
  openAccess,
} from "../fixtures/accesso-principale";
import { originOf } from "../fixtures/conferma-link";
import { waitHydrated } from "../fixtures/esplora";
import { inviteCookie, lauraInvite, linkOf } from "../fixtures/invito-ingresso";

// Links that now point to `/accesso` (#461, CA-19 ... CA-21).

test.describe("collegamenti verso /accesso", () => {
  test("CA-19: «Password dimenticata?» porta a /accesso/password-dimenticata con il campo vuoto; «Indietro» (390) e «Torna all'accesso» (1280) portano a /accesso", async ({
    page,
  }) => {
    for (const [width, height, name] of [
      [390, 844, "Indietro"],
      [1280, 800, "Torna all'accesso"],
    ] as const) {
      await page.setViewportSize({ width, height });
      await openAccess(page);
      await mailField(page).fill("marco@esempio.test");
      await forgotLink(page).click();
      await expect(page).toHaveURL(/\/accesso\/password-dimenticata$/);
      // The page left stays in the DOM, hidden: only the visible field counts.
      await expect(mailField(page).filter({ visible: true })).toHaveValue("");
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(/\/accesso$/);
    }
  });

  test("CA-20: l'azione principale di /accesso/link-scaduto?tipo=conferma porta a /accesso", async ({
    page,
  }) => {
    await page.goto("/accesso/link-scaduto?tipo=conferma");
    // [D] text of the designer (section 7 of the graphic specification).
    await page
      .getByRole("link", { name: "Entra con la password", exact: true })
      .click();
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-21: «Usa la mail» di /invito porta a /accesso con il cookie d'invito invariato; entrando senza Nest si arriva a /invito/colore", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    test.skip(!usersConfigured("A"), skipReason("A"));
    const laura = await lauraInvite();
    const user = await createPasswordUser();
    try {
      await page.goto(linkOf(originOf(baseURL), laura.token));
      const before = await inviteCookie(page);
      expect(before?.value).toBe(laura.token);
      await page
        .getByRole("link", { name: "Usa la mail", exact: true })
        .click();
      await expect(page).toHaveURL(/\/accesso$/);
      expect((await inviteCookie(page))?.value).toBe(before?.value);

      await expect(submitButton(page)).toBeVisible();
      await waitHydrated(submitButton(page));
      await mailField(page).fill(user.email);
      await passwordField(page).fill(user.password);
      await submitButton(page).click({ noWaitAfter: true });
      await expect(page).toHaveURL(/\/invito\/colore$/, { timeout: 15_000 });
    } finally {
      await user.remove();
    }
  });
});
