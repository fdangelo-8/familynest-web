import { expect, test, type Page } from "@playwright/test";
import {
  NEW_PASSWORD,
  RECOVERY_COOKIE,
  createPasswordUser,
  signInContext,
  type PasswordUser,
} from "../fixtures/accesso-password";
import {
  TEXT,
  consumeRecovery,
  needKeys,
  needStack,
  openRecovery,
  otherSession,
  postTo,
  pressRecovery,
  recoveryButton,
  recoveryForm,
  recoveryMailLink,
  recoveryPath,
  saveNewPassword,
  stayLink,
} from "../fixtures/accesso-principale";
import {
  CONFIRM_EXPIRED,
  FORBIDDEN_POSTS,
  expectNoSession,
  expectSessionOf,
  hasSession,
  originOf,
  tokenFor,
} from "../fixtures/conferma-link";
import { waitHydrated } from "../fixtures/esplora";

// The link of the new password asks for a button before it is used (#461,
// CA-22 ... CA-29, CA-39; it absorbs #442). Same shape as
// tests/e2e/conferma-link.spec.ts (#419). Links come from `generateLink` of
// type `recovery` made with the administrative key: no mail is sent, except in
// CA-29 where the browser that asked for the link opens it (PKCE).
//
// Every test creates its own users and deletes them in a `finally`.

const PASSWORD_EXPIRED = /\/accesso\/link-scaduto\?tipo=password$/;
const NEW_PASSWORD_URL = /\/accesso\/nuova-password$/;

async function withUser(
  options: { nest?: boolean },
  body: (user: PasswordUser) => Promise<void>,
) {
  const user = await createPasswordUser({ ...options, name: "Carla" });
  try {
    await body(user);
  } finally {
    await user.remove();
  }
}

/** «Per l'account <b>mail</b>.», and no `code` or `token_hash` in the address. */
async function expectAccountLine(page: Page, email: string) {
  const line = page.getByText(`Per l'account ${email}.`);
  await expect(line).toBeVisible();
  await expect(line.locator("b, strong")).toHaveText(email);
  expect(page.url()).not.toContain("code=");
  expect(page.url()).not.toContain("token_hash");
}

async function recoveryCookie(page: Page) {
  return (await page.context().cookies()).find(
    (cookie) => cookie.name === RECOVERY_COOKIE,
  );
}

// ---------------------------------------------------------------- the page

test.describe("pagina del bottone (GET /auth/confirm?type=recovery)", () => {
  test("CA-22: tre GET e una HEAD rispondono 200 con il bottone, senza cookie di sessione né di recupero, con no-store, same-origin e noindex", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await recoveryPath(user.email, { next: "/calendario" });
      for (let i = 0; i < 3; i += 1) {
        const response = await page.request.get(path, { maxRedirects: 0 });
        expect(response.status()).toBe(200);
        const headers = response.headers();
        expect(headers["cache-control"]).toContain("no-store");
        expect(headers["referrer-policy"]).toBe("same-origin");
        const html = await response.text();
        expect(html).toContain(TEXT.recoveryButton);
        expect(html).toMatch(
          /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/,
        );
      }
      const head = await page.request.head(path, { maxRedirects: 0 });
      expect(head.status()).toBe(200);
      await expectNoSession(page.context());

      await openRecovery(page, path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      await expectNoSession(page.context());
    });
  });

  test("CA-23: due clic mandano un solo POST a /auth/recupero, 303 a /accesso/nuova-password (non /calendario), sessione dell'account e cookie HttpOnly di 900 secondi", async ({
    page,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await recoveryPath(user.email, { next: "/calendario" });
      await openRecovery(page, path);
      await waitHydrated(recoveryForm(page).locator('button[type="submit"]'));
      let posts = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("/auth/recupero")
        ) {
          posts += 1;
        }
      });
      const answered = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/auth/recupero"),
      );
      await recoveryButton(page).dblclick({ noWaitAfter: true });
      const response = await answered;
      expect(response.status()).toBe(303);
      expect(response.headers()["location"]).toMatch(
        /\/accesso\/nuova-password$/,
      );
      await expect(page).toHaveURL(NEW_PASSWORD_URL);
      expect(posts).toBe(1);
      expect(await hasSession(page.context())).toBe(true);
      await expectAccountLine(page, user.email);
      const cookie = await recoveryCookie(page);
      expect(cookie?.httpOnly).toBe(true);
      const remaining = (cookie?.expires ?? 0) - Date.now() / 1000;
      expect(remaining).toBeGreaterThan(800);
      expect(remaining).toBeLessThanOrEqual(900);
    });
  });

  test("CA-24: senza JavaScript il risultato è lo stesso", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
      });
      try {
        const page = await context.newPage();
        await pressRecovery(
          page,
          (await recoveryPath(user.email, { next: "/calendario" })).path,
        );
        expect(await hasSession(context)).toBe(true);
        await expectAccountLine(page, user.email);
        const cookie = await recoveryCookie(page);
        expect(cookie?.httpOnly).toBe(true);
        const remaining = (cookie?.expires ?? 0) - Date.now() / 1000;
        expect(remaining).toBeGreaterThan(800);
        expect(remaining).toBeLessThanOrEqual(900);
      } finally {
        await context.close();
      }
    });
  });

  for (const forbidden of FORBIDDEN_POSTS) {
    test(`CA-25: POST a /auth/recupero con ${forbidden.name} → 403, nessuna sessione, il link resta usabile col bottone`, async ({
      page,
      browser,
      baseURL,
    }) => {
      needKeys();
      await withUser({}, async (user) => {
        const { token, path } = await recoveryPath(user.email);
        const { response, context } = await postTo(
          browser,
          baseURL as string,
          "/auth/recupero",
          { token_hash: token, type: "recovery" },
          forbidden.headers(originOf(baseURL)),
        );
        try {
          expect(response.status()).toBe(403);
          expect(response.headers()["location"]).toBeUndefined();
          await expectNoSession(context);
        } finally {
          await context.close();
        }

        // The same token still works with the button (CA-23).
        await pressRecovery(page, path);
        expect(await hasSession(page.context())).toBe(true);
        await expectAccountLine(page, user.email);
      });
    });
  }

  test("CA-26: con un token inventato il bottone porta a «link scaduto» senza sessione né cookie di recupero", async ({
    page,
  }) => {
    await openRecovery(
      page,
      "/auth/confirm?token_hash=token-inventato-0000&type=recovery",
    );
    await recoveryButton(page).click();
    await expect(page).toHaveURL(PASSWORD_EXPIRED);
    await expectNoSession(page.context());
  });

  test("CA-26: con un token già usato il bottone porta a «link scaduto» senza sessione né cookie di recupero", async ({
    page,
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const { path } = await recoveryPath(user.email);
      await consumeRecovery(browser, baseURL as string, path);
      await openRecovery(page, path);
      await recoveryButton(page).click();
      await expect(page).toHaveURL(PASSWORD_EXPIRED);
      await expectNoSession(page.context());
    });
  });
});

// ----------------------------------------------- with a session already open

test.describe("recupero con una sessione già aperta", () => {
  test("CA-27: avviso con la mail dell'account attuale in grassetto e «Resta con questo account»; la mail di Y non compare; «Resta» porta a /oggi con la sessione di prima", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    // X stands for the user of the seed A (a throwaway user with a Nest).
    await withUser({ nest: true }, async (x) => {
      await withUser({}, async (y) => {
        await signInContext(page.context(), baseURL as string, x);
        const { path } = await recoveryPath(y.email);
        await page.goto(path);
        await expect(
          page.locator("b, strong").filter({ hasText: x.email }),
        ).toBeVisible();
        await expect(stayLink(page)).toBeVisible();
        expect(await page.content()).not.toContain(y.email);
        await expectSessionOf(page.context(), x.email);

        await stayLink(page).click();
        await expect(page).toHaveURL(/\/oggi$/);
        await expectSessionOf(page.context(), x.email);
      });
    });
  });
});

// ------------------------------------------------------- the two routes apart

test.describe("le due rotte restano separate", () => {
  for (const type of ["email", "signup"] as const) {
    test(`CA-28: POST a /auth/recupero con type=${type} e un token di conferma valido porta a «link scaduto» (password), senza sessione`, async ({
      browser,
      baseURL,
    }) => {
      needKeys();
      await withUser({}, async (user) => {
        const token = await tokenFor(user.email);
        const { response, context } = await postTo(
          browser,
          baseURL as string,
          "/auth/recupero",
          { token_hash: token, type },
          { Origin: originOf(baseURL) },
        );
        try {
          expect(response.status()).toBe(303);
          expect(response.headers()["location"]).toMatch(PASSWORD_EXPIRED);
          await expectNoSession(context);
        } finally {
          await context.close();
        }
      });
    });
  }

  test("CA-28: POST a /auth/confirm con type=recovery e un token di recupero valido porta a «link scaduto» (conferma), senza sessione né cookie di recupero", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    await withUser({}, async (user) => {
      const token = await tokenFor(user.email, "recovery");
      const { response, context } = await postTo(
        browser,
        baseURL as string,
        "/auth/confirm",
        { token_hash: token, type: "recovery" },
        { Origin: originOf(baseURL) },
      );
      try {
        expect(response.status()).toBe(303);
        expect(response.headers()["location"]).toMatch(CONFIRM_EXPIRED);
        await expectNoSession(context);
      } finally {
        await context.close();
      }
    });
  });
});

// ------------------------------------------------------------ new password

test.describe("nuova password", () => {
  test("CA-29: /auth/callback?tipo=password con il code di un recupero chiesto nello stesso browser porta a /accesso/nuova-password con «Per l'account <mail>.»", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    await withUser({}, async (user) => {
      const link = await recoveryMailLink(page, user.email, baseURL as string);
      await page.goto(await link());
      await expect(page).toHaveURL(NEW_PASSWORD_URL);
      await expectAccountLine(page, user.email);
    });
  });

  // CA-38 (logout that answers 500, «Riprova» repeats only the closing) is the
  // test already in accesso-password-mail.spec.ts: one test per case.

  test("CA-39: arrivando dal bottone si vede «Per l'account <mail>.»; dopo il salvataggio una seconda sessione dello stesso account non si rinnova", async ({
    page,
  }) => {
    needKeys();
    await withUser({ nest: true }, async (user) => {
      const second = await otherSession(user);
      await pressRecovery(page, (await recoveryPath(user.email)).path);
      await expectAccountLine(page, user.email);

      await saveNewPassword(page, NEW_PASSWORD);
      await expect(page).toHaveURL(/\/oggi$/, { timeout: 15_000 });

      const refreshed = await second.client.auth.refreshSession({
        refresh_token: second.refreshToken,
      });
      expect(refreshed.error).not.toBeNull();
      expect(refreshed.data.session).toBeNull();
    });
  });
});
