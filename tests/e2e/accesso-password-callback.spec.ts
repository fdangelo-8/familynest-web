import { expect, test, type Page } from "@playwright/test";
import {
  RECOVERY_COOKIE,
  cookieNames,
  createPasswordUser,
  defaultLink,
  keysConfigured,
  keysSkipReason,
  mailField,
  mailpitReachable,
  mailpitSkipReason,
  newAddress,
  removeByEmail,
  statusWith,
  submitButton,
  submitMailForm,
  untilHydrated,
  waitForMails,
} from "../fixtures/accesso-password";

// Mail links of Supabase's DEFAULT templates (#327): `{{ .ConfirmationURL }}`
// goes through Supabase and comes back on /auth/callback with `?code=` (PKCE).
// The code belongs to the browser that asked for the mail.

const PASSWORD_OK = "pw-di-prova-7931";

test.describe("/auth/callback e /auth/confirm: link delle mail non validi", () => {
  for (const [ca, path, expected] of [
    [
      "CA-4",
      "/auth/callback?tipo=conferma",
      /\/accesso\/link-scaduto\?tipo=conferma$/,
    ],
    [
      "CA-4",
      "/auth/callback?tipo=conferma&code=inventato",
      /\/accesso\/link-scaduto\?tipo=conferma$/,
    ],
    [
      "CA-29",
      "/auth/callback?tipo=password",
      /\/accesso\/link-scaduto\?tipo=password$/,
    ],
    [
      "CA-29",
      "/auth/callback?tipo=password&code=inventato",
      /\/accesso\/link-scaduto\?tipo=password$/,
    ],
    [
      "CA-36",
      "/auth/confirm?type=magiclink&token_hash=qualunque",
      /\/accesso\/link-scaduto\?tipo=conferma$/,
    ],
    [
      "CA-36",
      "/auth/confirm?token_hash=qualunque",
      /\/accesso\/link-scaduto\?tipo=conferma$/,
    ],
  ] as const) {
    test(`${ca}: ${path} porta a «link scaduto», senza sessione`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(expected);
      const names = await cookieNames(page.context());
      expect(names).not.toContain(RECOVERY_COOKIE);
      expect(names.filter((name) => name.startsWith("sb-"))).toEqual([]);
    });
  }

  test("CA-36: /auth/callback senza «tipo» e senza «code» resta il ritorno di Google e Apple", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/accesso\?errore=accesso$/);
  });

  test("CA-36: /auth/callback con un «code» e senza «tipo» resta il ritorno di Google e Apple", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=inventato");
    await expect(page).toHaveURL(/\/accesso\?errore=accesso$/);
  });

  test("CA-36: un valore di «tipo» sconosciuto non è un link di mail", async ({
    page,
  }) => {
    await page.goto("/auth/callback?tipo=altro&code=inventato");
    await expect(page).toHaveURL(/\/accesso\?errore=accesso$/);
  });
});

async function needStack() {
  test.skip(!keysConfigured(), keysSkipReason);
  test.skip(!(await mailpitReachable()), mailpitSkipReason);
}

const hasSession = async (page: Page) =>
  (await cookieNames(page.context())).some((name) => name.startsWith("sb-"));

/** Registers through the page and returns the default link of the mail. */
async function registerAndGetLink(page: Page, address: string, base: string) {
  await page.goto("/accesso/mail");
  await submitMailForm(
    page,
    { mode: "Registrati", email: address, password: PASSWORD_OK },
    () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
      ).toBeVisible({ timeout: 10_000 }),
  );
  const [mail] = await waitForMails(address);
  return defaultLink(mail!.html, "conferma", base);
}

/** Asks for the recovery link through the page and returns the default link. */
async function recoverAndGetLink(page: Page, address: string, base: string) {
  await page.goto("/accesso/password-dimenticata");
  await untilHydrated(
    async () => {
      await mailField(page).fill(address, { timeout: 2000 });
      await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
    },
    () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" }),
      ).toBeVisible({ timeout: 8000 }),
  );
  const [mail] = await waitForMails(address);
  return defaultLink(mail!.html, "password", base);
}

test.describe("[CI-stack] /auth/callback con il link predefinito di Supabase", () => {
  test("CA-3, CA-4: conferma nello stesso browser entra in /onboarding; il link già usato, in un contesto senza sessione, è «scaduto»", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const address = newAddress();
    try {
      const link = await registerAndGetLink(page, address, baseURL!);
      await page.goto(await link());
      await expect(page).toHaveURL(/\/onboarding$/);
      expect(page.url()).not.toContain("code=");
      expect(page.url()).not.toContain("tipo=");
      expect(await hasSession(page)).toBe(true);

      // The token is used once: the same link again leads to «link scaduto».
      // (In a new browser: someone already signed in never sees the page.)
      const again = await browser.newContext({ baseURL });
      try {
        const againPage = await again.newPage();
        await againPage.goto(await link());
        // Supabase adds the error to the address (after `#`).
        await expect(againPage).toHaveURL(
          /\/accesso\/link-scaduto\?tipo=conferma/,
        );
        expect(await hasSession(againPage)).toBe(false);
      } finally {
        await again.close();
      }
    } finally {
      await removeByEmail(address);
    }
  });

  test("CA-4: conferma aperta per la prima volta in un altro browser, «link scaduto» senza sessione e «Entra con la mail» porta a /accesso/mail", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const address = newAddress();
    const other = await browser.newContext({ baseURL });
    try {
      const link = await registerAndGetLink(page, address, baseURL!);
      const otherPage = await other.newPage();
      await otherPage.goto(await link());
      await expect(otherPage).toHaveURL(
        /\/accesso\/link-scaduto\?tipo=conferma$/,
      );
      expect(await hasSession(otherPage)).toBe(false);
      const action = otherPage.getByRole("link", { name: "Entra con la mail" });
      await expect(action).toHaveAttribute("href", "/accesso/mail");
      await action.click();
      await expect(otherPage).toHaveURL(/\/accesso\/mail$/);
    } finally {
      await other.close();
      await removeByEmail(address);
    }
  });

  test("CA-4, CA-16: dopo «link scaduto» (callback senza code) l'account non confermato, entrando, vede l'avviso con «Rimanda la mail»", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const address = newAddress();
    const other = await browser.newContext({ baseURL });
    try {
      await registerAndGetLink(page, address, baseURL!);
      const otherPage = await other.newPage();
      await otherPage.goto("/auth/callback?tipo=conferma");
      await expect(otherPage).toHaveURL(
        /\/accesso\/link-scaduto\?tipo=conferma$/,
      );
      await otherPage.getByRole("link", { name: "Entra con la mail" }).click();
      await expect(otherPage).toHaveURL(/\/accesso\/mail$/);
      await submitMailForm(
        otherPage,
        { mode: "Entra", email: address, password: PASSWORD_OK },
        () =>
          expect(
            statusWith(otherPage, "Questa mail non è ancora confermata."),
          ).toBeVisible({ timeout: 10_000 }),
      );
      await expect(
        otherPage.getByRole("button", { name: "Rimanda la mail" }),
      ).toBeVisible();
      expect(await hasSession(otherPage)).toBe(false);
    } finally {
      await other.close();
      await removeByEmail(address);
    }
  });

  test("CA-24: recupero nello stesso browser, cookie e «Nuova password»", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser();
    try {
      const link = await recoverAndGetLink(page, user.email, baseURL!);
      await page.goto(await link());
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      expect(page.url()).not.toContain("code=");
      expect(page.url()).not.toContain("tipo=");
      expect(await cookieNames(page.context())).toContain(RECOVERY_COOKIE);
    } finally {
      await user.remove();
    }
  });

  test("CA-24: con «next=/oggi» sull'indirizzo di ritorno si arriva comunque a /accesso/nuova-password", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    try {
      const link = await recoverAndGetLink(page, user.email, baseURL!);
      await page.goto(`${await link()}&next=%2Foggi`);
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      expect(page.url()).not.toContain("code=");
      expect(page.url()).not.toContain("tipo=");
      expect(await cookieNames(page.context())).toContain(RECOVERY_COOKIE);
    } finally {
      await user.remove();
    }
  });

  test("CA-29: recupero aperto per la prima volta in un altro browser, «link scaduto», senza cookie e senza sessione", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser();
    const other = await browser.newContext({ baseURL });
    try {
      const link = await recoverAndGetLink(page, user.email, baseURL!);
      const otherPage = await other.newPage();
      await otherPage.goto(await link());
      await expect(otherPage).toHaveURL(
        /\/accesso\/link-scaduto\?tipo=password$/,
      );
      expect(await cookieNames(other)).not.toContain(RECOVERY_COOKIE);
      expect(await hasSession(otherPage)).toBe(false);
      const action = otherPage.getByRole("link", {
        name: "Mandami un nuovo link",
      });
      await expect(action).toHaveAttribute(
        "href",
        "/accesso/password-dimenticata",
      );
    } finally {
      await other.close();
      await user.remove();
    }
  });
});
