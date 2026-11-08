import { expect, test, type Page } from "@playwright/test";
import {
  RECOVERY_COOKIE,
  SITE_URL,
  cookieNames,
  createPasswordUser,
  keysConfigured,
  keysSkipReason,
  linksIn,
  mailField,
  mailpitReachable,
  mailpitSkipReason,
  newAddress,
  onBase,
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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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

/**
 * The link of Supabase's default template, rebuilt from the local mail: the
 * local templates carry the same `TokenHash` in `/auth/confirm?token_hash=`,
 * and `{{ .ConfirmationURL }}` is `<API>/auth/v1/verify?token=<TokenHash>&
 * type=signup|recovery&redirect_to=<redirect_to>`.
 */
function defaultLink(
  html: string,
  kind: "conferma" | "password",
  baseURL: string,
): () => Promise<string> {
  const confirm = linksIn(html).find((href) => href.includes("token_hash="));
  expect(confirm).toBeTruthy();
  const tokenHash = new URL(confirm as string).searchParams.get("token_hash");
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash as string);
  url.searchParams.set("type", kind === "conferma" ? "signup" : "recovery");
  // Supabase accepts a `redirect_to` with a query only on the host of
  // `site_url` (the list of exact URLs does not match a query). The browser of
  // the tests is on localhost, so the link is followed by hand: Supabase
  // checks the token and answers with the address of the callback, which is
  // then opened on the host of `baseURL` (as for the other mail links).
  url.searchParams.set("redirect_to", `${SITE_URL}/auth/callback?tipo=${kind}`);
  return async () => {
    const response = await fetch(url, { redirect: "manual" });
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    return onBase(location as string, baseURL);
  };
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
  test("conferma, stesso browser: entra in /onboarding; il link riaperto è «scaduto»", async ({
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
      } finally {
        await again.close();
      }
    } finally {
      await removeByEmail(address);
    }
  });

  test("conferma, altro browser: «link scaduto», nessuna sessione", async ({
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
    } finally {
      await other.close();
      await removeByEmail(address);
    }
  });

  test("recupero, stesso browser: cookie e «Nuova password»", async ({
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
      expect(await cookieNames(page.context())).toContain(RECOVERY_COOKIE);
    } finally {
      await user.remove();
    }
  });

  test("recupero, altro browser: «link scaduto», senza cookie", async ({
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
    } finally {
      await other.close();
      await user.remove();
    }
  });
});
