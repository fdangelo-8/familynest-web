import { expect, test } from "@playwright/test";
import {
  RECOVERY_COOKIE,
  cookieNames,
  createPasswordUser,
  keysConfigured,
  keysSkipReason,
  linksIn,
  mailField,
  mailpitReachable,
  mailpitSkipReason,
  newAddress,
  removeByEmail,
  submitButton,
  submitMailForm,
  untilHydrated,
  waitForMails,
} from "../fixtures/accesso-password";

// Mail links of Supabase's DEFAULT templates (#327): `{{ .ConfirmationURL }}`
// goes through Supabase and comes back on /auth/callback with `?code=` (PKCE).
// The code belongs to the browser that asked for the mail.

const PASSWORD_OK = "pw-di-prova-7931";

test.describe("/auth/callback: link delle mail non validi", () => {
  for (const [path, expected] of [
    ["/auth/callback?tipo=conferma", /\/accesso\/link-scaduto\?tipo=conferma$/],
    [
      "/auth/callback?tipo=conferma&code=inventato",
      /\/accesso\/link-scaduto\?tipo=conferma$/,
    ],
    ["/auth/callback?tipo=password", /\/accesso\/link-scaduto\?tipo=password$/],
    [
      "/auth/callback?tipo=password&code=inventato",
      /\/accesso\/link-scaduto\?tipo=password$/,
    ],
  ] as const) {
    test(`${path} porta a «link scaduto»`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(expected);
      expect(await cookieNames(page.context())).not.toContain(RECOVERY_COOKIE);
    });
  }

  test("senza «tipo» resta il ritorno di Google e Apple", async ({ page }) => {
    await page.goto("/auth/callback?code=inventato");
    await expect(page).toHaveURL(/\/accesso\?errore=accesso$/);
  });

  test("un valore di «tipo» sconosciuto non è un link di mail", async ({
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

/** The Supabase link of a default mail; null when the template is custom. */
function defaultLink(html: string): string | null {
  return linksIn(html).find((href) => href.includes("/auth/v1/verify")) ?? null;
}

test.describe("[CI-stack] /auth/callback con le mail predefinite", () => {
  test("conferma: stesso browser entra, altro browser va a «link scaduto»", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const address = newAddress();
    try {
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
      const link = defaultLink(mail!.html);
      test.skip(
        !link,
        "Il Supabase locale usa i modelli personalizzati di config.toml (token_hash)",
      );

      // Another browser has no PKCE verifier: expired link.
      const other = await browser.newContext({ baseURL });
      try {
        const otherPage = await other.newPage();
        await otherPage.goto(link!);
        await expect(otherPage).toHaveURL(
          /\/accesso\/link-scaduto\?tipo=conferma$/,
        );
      } finally {
        await other.close();
      }

      // The browser that asked: confirmed and in.
      await page.goto(link!);
      await expect(page).toHaveURL(/\/onboarding$/);
      expect(page.url()).not.toContain("code=");
      expect(
        (await cookieNames(page.context())).some((n) => n.startsWith("sb-")),
      ).toBe(true);
    } finally {
      await removeByEmail(address);
    }
  });

  test("recupero: cookie e pagina «Nuova password» nello stesso browser", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser();
    try {
      await page.goto("/accesso/password-dimenticata");
      await untilHydrated(
        async () => {
          await mailField(page).fill(user.email, { timeout: 2000 });
          await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
        },
        () =>
          expect(
            page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" }),
          ).toBeVisible({ timeout: 8000 }),
      );
      const [mail] = await waitForMails(user.email);
      const link = defaultLink(mail!.html);
      test.skip(
        !link,
        "Il Supabase locale usa i modelli personalizzati di config.toml (token_hash)",
      );
      expect(baseURL).toBeTruthy();
      await page.goto(link!);
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      expect(await cookieNames(page.context())).toContain(RECOVERY_COOKIE);
    } finally {
      await user.remove();
    }
  });
});
