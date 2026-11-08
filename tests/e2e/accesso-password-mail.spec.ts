import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  NEW_PASSWORD,
  RECOVERY_COOKIE,
  admin,
  alertWith,
  callsText,
  callsTo,
  cookieNames,
  createPasswordUser,
  defaultLink,
  expectMailCount,
  expectNoMagicLink,
  h1,
  keysConfigured,
  keysSkipReason,
  mailField,
  mailpitReachable,
  mailpitSkipReason,
  newAddress,
  passwordField,
  recordAuth,
  recordOwnRequests,
  removeByEmail,
  signInContext,
  statusWith,
  submitButton,
  submitMailForm,
  tokenHashIn,
  untilHydrated,
  waitForMails,
  type PasswordUser,
} from "../fixtures/accesso-password";
import {
  inviteCookie,
  lauraInvite,
  setInviteCookie,
} from "../fixtures/invito-ingresso";
import { SEED_HOME_A, SEED_HOME_B } from "../fixtures/invito";

// Sign-in with mail and password on the real local stack (#327): real
// accounts, real mails read from Mailpit, real links. Every test creates its
// own users and deletes them (and their mails) in a `finally`.
//
// [CI-stack] needs the Supabase keys and Mailpit; [CI-utenti] also needs the
// seed users. Both are skipped on the remote project.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PASSWORD_OK = "pw-di-prova-7931";

async function needStack() {
  test.skip(!keysConfigured(), keysSkipReason);
  test.skip(!(await mailpitReachable()), mailpitSkipReason);
}

function seedA() {
  const email = process.env.TEST_USER_A_EMAIL;
  const password = process.env.TEST_USER_A_PASSWORD;
  test.skip(!email || !password, "Utente di prova A non configurato");
  return { email: email as string, password: password as string };
}

const checkPosta = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Controlla la posta" });
const sentTitle = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" });

const hasSession = async (context: BrowserContext) =>
  (await cookieNames(context)).some((name) => name.startsWith("sb-"));

/** Logs in through the page; resolves when `done` holds. */
async function loginThroughPage(
  page: Page,
  email: string,
  password: string,
  done: () => Promise<void>,
) {
  await page.goto("/accesso/mail");
  await submitMailForm(page, { mode: "Entra", email, password }, done);
}

/** Asks for the recovery link through the page and returns the link of the mail. */
async function askRecovery(page: Page, address: string) {
  await page.goto("/accesso/password-dimenticata");
  await untilHydrated(
    async () => {
      await mailField(page).fill(address, { timeout: 2000 });
      await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
    },
    () => expect(sentTitle(page)).toBeVisible({ timeout: 8000 }),
  );
}

/**
 * Asks for the recovery through the page and returns the default link rebuilt
 * from the mail. The page is the browser that must open it (PKCE).
 */
async function recoveryLinkFor(page: Page, address: string, baseURL: string) {
  await askRecovery(page, address);
  const [mail] = await waitForMails(address);
  return defaultLink(mail!.html, "password", baseURL);
}

// ===================================================== registrazione e conferma

test.describe("[CI-stack] registrazione e conferma", () => {
  test("CA-1, CA-2, CA-3, CA-35, CA-37: registrarsi, leggere la mail, aprire il link", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const address = newAddress();
    const calls = recordAuth(page);
    const own = recordOwnRequests(page);
    const logs: string[] = [];
    page.on("console", (message) => logs.push(message.text()));
    const origin = new URL(baseURL!).origin;
    try {
      await page.goto("/accesso/mail");
      await submitMailForm(
        page,
        { mode: "Registrati", email: address, password: PASSWORD_OK },
        () => expect(checkPosta(page)).toBeVisible({ timeout: 10_000 }),
      );
      // CA-1
      const signups = callsTo(calls, "/signup");
      expect(signups).toHaveLength(1);
      expect(signups[0]?.query.get("redirect_to")).toBe(
        `${origin}/auth/callback?tipo=conferma`,
      );
      await expect(checkPosta(page)).toBeFocused();
      await expect(page.getByText(address)).toBeVisible();

      // CA-2: one mail with a token_hash; the default link is rebuilt from it
      const [mail] = await waitForMails(address);
      expect(mail?.subject).toBe("Conferma il tuo indirizzo per FamilyNest");
      expect(tokenHashIn(mail!.html).length).toBeGreaterThan(10);
      expect(mail?.html).toContain("Conferma il tuo indirizzo");
      expect(mail?.html).not.toMatch(/<img|src=/i);
      const link = defaultLink(mail!.html, "conferma", baseURL!);

      // CA-3: the link, opened in the same context, gives a session and
      // /onboarding, with neither `code` nor `tipo` in the address
      await page.goto(await link());
      await expect(page).toHaveURL(/\/onboarding$/);
      expect(page.url()).not.toContain("code=");
      expect(page.url()).not.toContain("tipo=");
      expect(await hasSession(page.context())).toBe(true);

      // CA-35 and CA-37
      expectNoMagicLink(calls);
      const joined = [...own.map((r) => `${r.url}\n${r.body}`), ...logs].join(
        "\n",
      );
      for (const secret of [
        address,
        encodeURIComponent(address),
        PASSWORD_OK,
      ]) {
        expect(joined).not.toContain(secret);
      }
    } finally {
      await removeByEmail(address);
    }
  });

  test("CA-8: la mail di un account già confermato dà lo stesso «Controlla la posta», nessuna sessione e nessuna mail", async ({
    page,
  }) => {
    await needStack();
    const user = await createPasswordUser();
    const fresh = createClient(
      supabaseUrl as string,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    try {
      await page.goto("/accesso/mail");
      await submitMailForm(
        page,
        {
          mode: "Registrati",
          email: user.email,
          password: "un-altra-password",
        },
        () => expect(checkPosta(page)).toBeVisible({ timeout: 10_000 }),
      );
      await expect(
        page.getByText(
          `Se è un indirizzo nuovo, ti abbiamo mandato una mail a ${user.email}. Apri il link che contiene: entri subito in FamilyNest.`,
        ),
      ).toBeVisible();
      await expect(
        page.getByText("Hai già un account con questa mail?"),
      ).toBeVisible();
      expect(await hasSession(page.context())).toBe(false);
      await expectMailCount(user.email, 0);
      // The old password still works, the new one does not.
      const old = await fresh.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      expect(old.error).toBeNull();
      const wrong = await fresh.auth.signInWithPassword({
        email: user.email,
        password: "un-altra-password",
      });
      expect(wrong.error?.code).toBe("invalid_credentials");
    } finally {
      await user.remove();
    }
  });

  test("CA-16: account non confermato, avviso e «Rimanda la mail» con una mail nuova", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ confirmed: false });
    const calls = recordAuth(page);
    try {
      await loginThroughPage(page, user.email, user.password, () =>
        expect(
          statusWith(
            page,
            "Questa mail non è ancora confermata. Apri su questo browser il link della mail che ti abbiamo mandato, oppure fattene mandare un'altra.",
          ),
        ).toBeVisible({ timeout: 10_000 }),
      );
      expect(await hasSession(page.context())).toBe(false);
      await expectMailCount(user.email, 0);
      await page.getByRole("button", { name: "Rimanda la mail" }).click();
      await expect(checkPosta(page)).toBeVisible();
      const resends = callsTo(calls, "/resend");
      expect(resends).toHaveLength(1);
      expect(resends[0]?.body).toMatchObject({
        type: "signup",
        email: user.email,
      });
      expect(resends[0]?.query.get("redirect_to")).toBe(
        `${new URL(baseURL!).origin}/auth/callback?tipo=conferma`,
      );
      // Mailpit receives a new confirmation mail with a new token_hash.
      const [mail] = await waitForMails(user.email);
      expect(mail?.subject).toBe("Conferma il tuo indirizzo per FamilyNest");
      expect(tokenHashIn(mail!.html).length).toBeGreaterThan(10);
      expectNoMagicLink(calls);
    } finally {
      await user.remove();
    }
  });
});

// ============================================================ accesso con password

test.describe("[CI-stack] accesso", () => {
  test("CA-13, CA-38: A (SEED_HOME_A) entra con mail e password e arriva a /oggi, senza dati di B", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const { email, password } = seedA();
    const calls = recordAuth(page);
    const origin = new URL(baseURL!).origin;
    const bodies: string[] = [];
    page.on("response", async (response) => {
      const type = response.request().resourceType();
      if (
        response.url().startsWith(origin) &&
        (type === "document" || type === "fetch" || type === "xhr")
      ) {
        bodies.push(await response.text().catch(() => ""));
      }
    });
    await loginThroughPage(page, email, password, () =>
      expect(page).toHaveURL(/\/oggi$/, { timeout: 15_000 }),
    );
    const tokens = callsTo(calls, "/token");
    expect(tokens.length).toBeGreaterThanOrEqual(1);
    expect(tokens[0]?.query.get("grant_type")).toBe("password");
    await expect(h1(page)).toBeVisible();
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toContain(SEED_HOME_B);
    }
    expectNoMagicLink(calls);
  });

  test("CA-14, CA-15: senza Nest va a /onboarding; password o mail sbagliate danno lo stesso avviso", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser();
    const other = await browser.newContext({ baseURL });
    try {
      const wrong = newAddress("nessuno");
      const texts: string[] = [];
      const roles: Array<string | null> = [];
      for (const [email, password] of [
        [user.email, "una-password-sbagliata"],
        [wrong, "una-password-sbagliata"],
      ] as const) {
        const tab = await other.newPage();
        await loginThroughPage(tab, email, password, () =>
          expect(
            alertWith(tab, "La mail e la password non corrispondono."),
          ).toBeVisible({ timeout: 10_000 }),
        );
        const alert = alertWith(
          tab,
          "La mail e la password non corrispondono.",
        );
        texts.push((await alert.innerText()).trim());
        roles.push(await alert.getAttribute("role"));
        await expect(passwordField(tab)).toHaveValue("");
        await expect(mailField(tab)).toHaveValue(email);
        await tab.close();
      }
      expect(texts[0]).toBe(texts[1]);
      expect(roles).toEqual(["alert", "alert"]);

      await loginThroughPage(page, user.email, user.password, () =>
        expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 }),
      );
    } finally {
      await other.close();
      await user.remove();
    }
  });

  test("CA-32: con il cookie d'invito e senza Nest si va a /invito/colore", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    seedA();
    const invite = await lauraInvite();
    const user = await createPasswordUser();
    const calls = recordAuth(page);
    try {
      await setInviteCookie(page, baseURL!, invite.token);
      await loginThroughPage(page, user.email, user.password, () =>
        expect(page).toHaveURL(/\/invito\/colore$/, { timeout: 15_000 }),
      );
      expect(page.url()).not.toContain(invite.token);
      expect((await inviteCookie(page))?.value).toBe(invite.token);
      // CA-34: the invite token is in no request to Supabase
      expect(callsText(calls)).not.toContain(invite.token);
    } finally {
      await user.remove();
    }
  });

  test("CA-30: con una sessione valida le pagine dell'accesso portano alla destinazione", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    try {
      await signInContext(page.context(), baseURL!, user);
      for (const route of [
        "/accesso/mail",
        "/accesso/password-dimenticata",
        "/accesso/link-scaduto",
        "/accesso/link-scaduto?tipo=password",
      ]) {
        await page.goto(route);
        await expect(page, route).toHaveURL(/\/oggi$/);
      }
    } finally {
      await user.remove();
    }
  });
});

// ================================================== password dimenticata e nuova password

test.describe("[CI-stack] password dimenticata e nuova password", () => {
  test("CA-22: una mail non registrata dà lo stesso «Ti abbiamo scritto» e nessuna mail", async ({
    page,
  }) => {
    await needStack();
    const address = newAddress("nessuno");
    const calls = recordAuth(page);
    try {
      await askRecovery(page, address);
      await expect(
        page.getByText(
          `Se ${address} è la mail di un account FamilyNest, ti è arrivato un link per scegliere una nuova password.`,
        ),
      ).toBeVisible();
      expect(callsTo(calls, "/recover")).toHaveLength(1);
      await expectMailCount(address, 0);
    } finally {
      await removeByEmail(address);
    }
  });

  test("CA-21, CA-24, CA-25, CA-26, CA-28, CA-37: recupero completo", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    const origin = new URL(baseURL!).origin;
    const extra: BrowserContext[] = [];
    try {
      // A second browser is already signed in as the same person (CA-26).
      const second = await browser.newContext({ baseURL });
      extra.push(second);
      await signInContext(second, baseURL!, user);
      const secondPage = await second.newPage();
      await secondPage.goto("/oggi");
      await expect(secondPage).toHaveURL(/\/oggi$/);

      // CA-21: the request, the screen, the mail (the browser that asks is the
      // one that opens the link: PKCE)
      const recovery = await browser.newContext({ baseURL });
      extra.push(recovery);
      const target = await recovery.newPage();
      const own = recordOwnRequests(target);
      const logs: string[] = [];
      target.on("console", (message) => logs.push(message.text()));
      const targetCalls = recordAuth(target);
      await askRecovery(target, user.email);
      const recovers = callsTo(targetCalls, "/recover");
      expect(recovers).toHaveLength(1);
      expect(recovers[0]?.query.get("redirect_to")).toBe(
        `${origin}/auth/callback?tipo=password`,
      );
      const [mail] = await waitForMails(user.email);
      expect(mail?.subject).toBe("Scegli una nuova password per FamilyNest");
      expect(tokenHashIn(mail!.html).length).toBeGreaterThan(10);
      expect(mail?.html).not.toMatch(/<img|src=/i);
      const link = defaultLink(mail!.html, "password", baseURL!);

      // CA-24: the link lands on the new-password page, with a session
      await target.goto(await link());
      await expect(target).toHaveURL(/\/accesso\/nuova-password$/);
      expect(target.url()).not.toContain("code=");
      expect(target.url()).not.toContain("tipo=");
      expect(await hasSession(recovery)).toBe(true);
      const cookie = (await recovery.cookies()).find(
        (c) => c.name === RECOVERY_COOKIE,
      );
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("Lax");
      const remaining = (cookie?.expires ?? 0) - Date.now() / 1000;
      expect(remaining).toBeGreaterThan(800);
      expect(remaining).toBeLessThanOrEqual(900);
      await expect(h1(target)).toHaveText("Scegli una nuova password");
      await expect(
        target.getByText(`Per l'account ${user.email}.`),
      ).toBeVisible();

      // CA-19: the new-password form has one password field, no `name`
      const field = passwordField(target, "Nuova password");
      await expect(field).toHaveAttribute("type", "password");
      await expect(field).toHaveAttribute("autocomplete", "new-password");
      await expect(target.locator("main form input[name]")).toHaveCount(0);

      // CA-28: too short, nothing is sent; the current password is refused
      await untilHydrated(
        async () => {
          await field.fill("1234567", { timeout: 2000 });
          await submitButton(target).click({
            timeout: 2000,
            noWaitAfter: true,
          });
        },
        () =>
          expect(
            target.getByText(
              "La password è troppo corta: servono almeno 8 caratteri.",
            ),
          ).toBeVisible({ timeout: 1000 }),
      );
      expect(
        callsTo(targetCalls, "/user").filter((call) => call.method === "PUT"),
      ).toHaveLength(0);
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await field.fill(user.password);
      await submitButton(target).click();
      await expect(
        target.getByText("È la password che usavi già: scegline una diversa."),
      ).toBeVisible();
      await expect(target).toHaveURL(/\/accesso\/nuova-password$/);

      // CA-25: the new password is saved and the person goes to /oggi
      await field.fill(NEW_PASSWORD);
      await submitButton(target).click();
      await expect(target).toHaveURL(/\/oggi$/, { timeout: 15_000 });
      const puts = callsTo(targetCalls, "/user").filter(
        (call) => call.method === "PUT",
      );
      expect(puts.length).toBeGreaterThanOrEqual(2);
      await expect(target.getByText("Nuova password salvata.")).toBeVisible();
      expect(await cookieNames(recovery)).not.toContain(RECOVERY_COOKIE);
      // CA-37: the password never went through our own site or the console
      const joined = [...own.map((r) => `${r.url}\n${r.body}`), ...logs].join(
        "\n",
      );
      for (const secret of [NEW_PASSWORD, user.password, user.email]) {
        expect(joined).not.toContain(secret);
      }

      // CA-25: the old password no longer works, the new one does
      const check = await browser.newContext({ baseURL });
      extra.push(check);
      const checkPage = await check.newPage();
      await loginThroughPage(checkPage, user.email, user.password, () =>
        expect(
          alertWith(checkPage, "La mail e la password non corrispondono."),
        ).toBeVisible({ timeout: 10_000 }),
      );
      await checkPage
        .getByLabel("Password", { exact: true })
        .fill(NEW_PASSWORD);
      await submitButton(checkPage).click();
      await expect(checkPage).toHaveURL(/\/oggi$/, { timeout: 15_000 });

      // CA-26: the other session was closed, the current one stays
      await secondPage.goto("/oggi");
      await expect(secondPage).toHaveURL(/\/accesso$/);
      await target.goto("/oggi");
      await expect(target).toHaveURL(/\/oggi$/);
    } finally {
      for (const context of extra) await context.close();
      await user.remove();
    }
  });

  test("CA-27, CA-29: senza sessione o senza cookie di recupero, o con un link già usato, si va a «link scaduto»", async ({
    page,
    browser,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    const extra: BrowserContext[] = [];
    try {
      // No session
      await page.goto("/accesso/nuova-password");
      await expect(page).toHaveURL(/\/accesso\/link-scaduto\?tipo=password$/);
      const action = page.getByRole("link", { name: "Mandami un nuovo link" });
      await expect(action).toHaveAttribute(
        "href",
        "/accesso/password-dimenticata",
      );
      await action.click();
      await expect(page).toHaveURL(/\/accesso\/password-dimenticata$/);

      // A normal session without the recovery cookie
      const signedIn = await browser.newContext({ baseURL });
      extra.push(signedIn);
      await signInContext(signedIn, baseURL!, user);
      const normal = await signedIn.newPage();
      await normal.goto("/accesso/nuova-password");
      await expect(normal).toHaveURL(/\/accesso\/link-scaduto\?tipo=password$/);
      // …and the session is untouched
      // (the page that redirected may still be finishing: retry the visit)
      await expect(async () => {
        await normal.goto("/oggi");
        await expect(normal).toHaveURL(/\/oggi$/, { timeout: 3000 });
      }).toPass({ timeout: 15_000 });

      // CA-29: a recovery link already used
      const first = await browser.newContext({ baseURL });
      extra.push(first);
      const firstPage = await first.newPage();
      const link = await recoveryLinkFor(firstPage, user.email, baseURL!);
      await firstPage.goto(await link());
      await expect(firstPage).toHaveURL(/\/accesso\/nuova-password$/);
      const used = await browser.newContext({ baseURL });
      extra.push(used);
      const usedPage = await used.newPage();
      await usedPage.goto(await link());
      await expect(usedPage).toHaveURL(
        /\/accesso\/link-scaduto\?tipo=password$/,
      );
      expect(await hasSession(used)).toBe(false);
      expect(await cookieNames(used)).not.toContain(RECOVERY_COOKIE);
    } finally {
      for (const context of extra) await context.close();
      await user.remove();
    }
  });

  test("CA-18: senza JavaScript «Nuova password» manda un POST a /invio e riceve un 303", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    try {
      // The link is asked with JavaScript (same browser), then it is switched off.
      const link = await recoveryLinkFor(page, user.email, baseURL!);
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
      const answers: Array<{ url: string; status: number; location: string }> =
        [];
      page.on("response", (response) => {
        if (response.url().includes("/invio")) {
          answers.push({
            url: response.url(),
            status: response.status(),
            location: response.headers()["location"] ?? "",
          });
        }
      });
      const posts: Array<{ url: string; body: string }> = [];
      page.on("request", (request) => {
        if (request.method() === "POST") {
          posts.push({ url: request.url(), body: request.postData() ?? "" });
        }
      });
      await page.goto(await link());
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      await passwordField(page, "Nuova password").fill(NEW_PASSWORD);
      await submitButton(page).click();
      await page.waitForLoadState("load");
      await expect.poll(() => answers.length).toBe(1);
      expect(new URL(answers[0]!.url).pathname).toBe(
        "/accesso/nuova-password/invio",
      );
      expect(answers[0]!.status).toBe(303);
      expect(new URL(answers[0]!.location, page.url()).pathname).toBe(
        "/accesso/nuova-password",
      );
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toBe("");
      const everything = decodeURIComponent(
        `${page.url()}\n${answers[0]!.location}\n${posts[0]?.url}`,
      );
      expect(everything).not.toContain(NEW_PASSWORD);
      // Nothing was saved: the old password still works.
      const fresh = createClient(
        supabaseUrl as string,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const old = await fresh.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      expect(old.error).toBeNull();
    } finally {
      await user.remove();
    }
  });
});

// ============================================================================ invito

test.describe("[CI-utenti] invito", () => {
  test("CA-31, CA-34: dall'invito, «Usa la mail», registrazione e conferma nello stesso contesto portano a /invito/colore", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    seedA();
    const invite = await lauraInvite();
    const address = newAddress();
    const calls = recordAuth(page);
    try {
      await page.goto(`/invito/${invite.token}`);
      await expect(
        page.getByRole("link", { name: "Usa la mail" }),
      ).toBeVisible();
      expect((await inviteCookie(page))?.value).toBe(invite.token);
      // From here on the token must not appear in any address.
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));
      page.on("framenavigated", (frame) => urls.push(frame.url()));
      await page.getByRole("link", { name: "Usa la mail" }).click();
      await expect(page).toHaveURL(/\/accesso\/mail$/);
      await submitMailForm(
        page,
        { mode: "Registrati", email: address, password: PASSWORD_OK },
        () => expect(checkPosta(page)).toBeVisible({ timeout: 10_000 }),
      );
      await expect(
        page.getByText("Apri il link su questo browser", { exact: true }),
      ).toBeVisible();
      const [mail] = await waitForMails(address);
      const link = await defaultLink(mail!.html, "conferma", baseURL!)();
      await page.goto(link);
      await expect(page).toHaveURL(/\/invito\/colore$/);
      expect((await inviteCookie(page))?.value).toBe(invite.token);

      // CA-34: not in an address, not in a request to Supabase (query
      // included, so `redirect_to` too), not in the mail
      expect(urls.join("\n")).not.toContain(invite.token);
      expect(callsText(calls)).not.toContain(invite.token);
      expect(`${mail?.html}\n${mail?.text}`).not.toContain(invite.token);
      expect(link).not.toContain(invite.token);
    } finally {
      await removeByEmail(address);
    }
  });

  test("CA-33: con il cookie d'invito, dopo la nuova password si va a /invito/colore", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    seedA();
    const invite = await lauraInvite();
    const user = await createPasswordUser();
    const calls = recordAuth(page);
    try {
      await setInviteCookie(page, baseURL!, invite.token);
      await askRecovery(page, user.email);
      const [mail] = await waitForMails(user.email);
      await page.goto(await defaultLink(mail!.html, "password", baseURL!)());
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      const field = passwordField(page, "Nuova password");
      await untilHydrated(
        async () => {
          await field.fill(NEW_PASSWORD, { timeout: 2000 });
          await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
        },
        () => expect(page).toHaveURL(/\/invito\/colore$/, { timeout: 15_000 }),
      );
      expect(page.url()).not.toContain(invite.token);
      expect((await inviteCookie(page))?.value).toBe(invite.token);
      expect(await cookieNames(page.context())).not.toContain(RECOVERY_COOKIE);

      // CA-34: the invite token is in no Supabase request nor in the mail
      expect(callsText(calls)).not.toContain(invite.token);
      expect(`${mail?.html}\n${mail?.text}`).not.toContain(invite.token);
    } finally {
      await user.remove();
    }
  });
});

// ================================================================== isolamento

test.describe("[CI-stack] isolamento", () => {
  test("CA-38: chi reimposta la password di un Nest non vede i dati di SEED_HOME_A", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const user: PasswordUser = await createPasswordUser({ nest: true });
    const origin = new URL(baseURL!).origin;
    const bodies: string[] = [];
    page.on("response", async (response) => {
      const type = response.request().resourceType();
      if (
        response.url().startsWith(origin) &&
        (type === "document" || type === "fetch" || type === "xhr")
      ) {
        bodies.push(await response.text().catch(() => ""));
      }
    });
    try {
      const link = await recoveryLinkFor(page, user.email, baseURL!);
      await page.goto(await link());
      const field = passwordField(page, "Nuova password");
      await untilHydrated(
        async () => {
          await field.fill(NEW_PASSWORD, { timeout: 2000 });
          await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
        },
        () => expect(page).toHaveURL(/\/oggi$/, { timeout: 15_000 }),
      );
      await expect(h1(page)).toBeVisible();
      for (const body of bodies) {
        expect(body).not.toContain(SEED_HOME_A);
      }
      // The new Nest is the only one the person can read.
      const { data } = await admin()
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id);
      expect((data ?? []).map((row) => row.household_id)).not.toContain(
        SEED_HOME_A,
      );
    } finally {
      await user.remove();
    }
  });
});
