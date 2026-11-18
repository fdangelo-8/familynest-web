import { expect, test, type Page } from "@playwright/test";
import {
  callsTo,
  createPasswordUser,
  expectNoMagicLink,
  mailField,
  mockAuth,
  modeVoice,
  newAddress,
  passwordField,
  recordAuth,
  removeByEmail,
  signInContext,
  statusWith,
  alertWith,
  submitButton,
} from "../fixtures/accesso-password";
import {
  SIZES,
  TEXT,
  appleButton,
  checkPosta,
  createGoogleOnlyUser,
  expectOrder,
  forgotLink,
  formState,
  googleButton,
  holdAuth,
  needKeys,
  needStack,
  openAccess,
  resendButton,
  retryButton,
  snapshot,
} from "../fixtures/accesso-principale";
import { sessionCookieNames } from "../fixtures/conferma-link";
import { waitHydrated } from "../fixtures/esplora";
import {
  inviteCookie,
  lauraInvite,
  setInviteCookie,
} from "../fixtures/invito-ingresso";
import { skipReason, usersConfigured } from "../fixtures/auth";

// `/accesso` is the page of mail and password; Apple and Google are below (#461,
// CA-1 ... CA-18). Where the criterion says «a 390 e a 1280 px» the test sets
// both widths itself, so it checks both on either Playwright project.
//
// Accounts: every test that signs in creates its own user and deletes it in a
// `finally` (users shared between the two parallel projects collide, see
// LEZIONI). A throwaway user with a Nest stands for «il seed A».

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PASSWORD_OK = "pw-di-prova-7931";
const SECRET = "segreto-che-non-deve-uscire-4815";

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

const INVALID_CREDENTIALS = {
  kind: "status",
  status: 400,
  body: {
    code: 400,
    error_code: "invalid_credentials",
    msg: "Invalid login credentials",
  },
} as const;

/** Fills the form once the page is hydrated and presses the submit button. */
async function fillAndSubmit(
  page: Page,
  input: { mode?: "Entra" | "Registrati"; email: string; password: string },
) {
  const mode = input.mode ?? "Entra";
  await modeVoice(page, mode).click();
  await mailField(page).fill(input.email);
  await passwordField(
    page,
    mode === "Entra" ? "Password" : "Scegli una password",
  ).fill(input.password);
  await submitButton(page).click({ noWaitAfter: true });
}

// ============================================================ la pagina

test.describe("/accesso: struttura e ordine", () => {
  test("CA-1: selettore, mail, password, «Password dimenticata?», «Entra», Apple e Google in questo ordine; niente «Usa la mail»", async ({
    page,
  }) => {
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/accesso");
      const group = page.getByRole("group", { name: "Hai già un account?" });
      await expect(
        group.getByRole("button", { name: "Entra", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expectOrder(page, [
        group,
        mailField(page),
        passwordField(page),
        forgotLink(page),
        submitButton(page),
        appleButton(page),
        googleButton(page),
      ]);
      await expect(submitButton(page)).toHaveText("Entra");
      await expect(page.getByRole("link", { name: "Usa la mail" })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("button", { name: "Usa la mail" }),
      ).toHaveCount(0);
    }
  });

  test("CA-2: un solo form con method, action e novalidate, un campo mail e uno password, nessun name, in Entra e in Registrati", async ({
    page,
  }) => {
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openAccess(page);
      for (const mode of ["Entra", "Registrati"] as const) {
        await modeVoice(page, mode).click();
        const form = page.locator("form");
        await expect(form).toHaveCount(1);
        await expect(form).toHaveAttribute("method", "post");
        await expect(form).toHaveAttribute("action", "/accesso/mail/invio");
        await expect(form).toHaveAttribute("novalidate", "");
        await expect(page.locator("input[type=email]")).toHaveCount(1);
        await expect(page.locator("input[type=password]")).toHaveCount(1);
        await expect(page.locator("input[type=email]")).toHaveAttribute(
          "autocomplete",
          "username",
        );
        await expect(page.locator("input[type=password]")).toHaveAttribute(
          "autocomplete",
          mode === "Entra" ? "current-password" : "new-password",
        );
        expect(
          await page
            .locator("form input")
            .evaluateAll((inputs) =>
              inputs.map((input) => input.getAttribute("name")),
            ),
        ).toEqual([null, null]);
      }
    }
  });
});

test.describe("/accesso: accesso", () => {
  test("CA-3: mail e password giuste mandano una sola richiesta a /auth/v1/token e portano a /oggi", async ({
    page,
  }) => {
    needKeys();
    const user = await createPasswordUser({ nest: true });
    try {
      const calls = recordAuth(page);
      await openAccess(page);
      await fillAndSubmit(page, user);
      await expect(page).toHaveURL(/\/oggi$/, { timeout: 15_000 });
      expect(callsTo(calls, "/token")).toHaveLength(1);
    } finally {
      await user.remove();
    }
  });

  test("CA-4: un account confermato senza Nest arriva a /onboarding", async ({
    page,
  }) => {
    needKeys();
    const user = await createPasswordUser();
    try {
      await openAccess(page);
      await fillAndSubmit(page, user);
      await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
    } finally {
      await user.remove();
    }
  });

  test("CA-4: con il cookie familynest_invito si arriva a /invito/colore e il cookie ha lo stesso valore", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    test.skip(!usersConfigured("A"), skipReason("A"));
    const laura = await lauraInvite();
    const user = await createPasswordUser();
    try {
      await setInviteCookie(page, baseURL as string, laura.token);
      await openAccess(page);
      await fillAndSubmit(page, user);
      await expect(page).toHaveURL(/\/invito\/colore$/, { timeout: 15_000 });
      expect((await inviteCookie(page))?.value).toBe(laura.token);
    } finally {
      await user.remove();
    }
  });

  test("CA-5: mail sconosciuta, password sbagliata, account solo Google e account non confermato danno lo stesso avviso e lo stesso DOM", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    const known = await createPasswordUser({ nest: true });
    const unconfirmed = await createPasswordUser({ confirmed: false });
    const google = await createGoogleOnlyUser();
    try {
      const cases = [
        { name: "password sbagliata", email: known.email },
        { name: "mail mai registrata", email: newAddress("sconosciuta") },
        { name: "solo Google", email: google.email },
        { name: "non confermato", email: unconfirmed.email },
      ];
      const seen: Array<{ name: string; dom: string; title: string }> = [];
      for (const item of cases) {
        const context = await browser.newContext({ baseURL });
        try {
          const tab = await context.newPage();
          await openAccess(tab);
          await fillAndSubmit(tab, {
            email: item.email,
            password: "password-sbagliata-1",
          });
          const alert = alertWith(tab, TEXT.credentials);
          await expect(alert).toBeVisible();
          await expect(alert).toHaveAttribute("role", "alert");
          await expect(tab).toHaveURL(/\/accesso$/);
          await expect(passwordField(tab)).toHaveValue("");
          await expect(passwordField(tab)).toBeFocused();
          expect(await sessionCookieNames(context)).toEqual([]);
          seen.push({
            name: item.name,
            dom: await snapshot(tab, item.email),
            title: await tab.title(),
          });
        } finally {
          await context.close();
        }
      }
      for (const item of seen.slice(1)) {
        expect(item.dom, item.name).toBe(seen[0]!.dom);
        expect(item.title, item.name).toBe(seen[0]!.title);
      }
    } finally {
      await known.remove();
      await unconfirmed.remove();
      await google.remove();
    }
  });

  test("CA-6: con i campi vuoti non parte nessuna richiesta a /auth/v1/, la mail ha l'errore, aria-invalid e il fuoco", async ({
    page,
  }) => {
    needSupabase();
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      const calls = recordAuth(page);
      await openAccess(page);
      await submitButton(page).click();
      await expect(page.getByText(TEXT.emptyMail)).toBeVisible();
      await expect(mailField(page)).toHaveAttribute("aria-invalid", "true");
      await expect(mailField(page)).toBeFocused();
      expect(calls).toEqual([]);
    }
  });

  test("CA-7: Registrati con una mail nuova manda un solo signup, mostra «Controlla la posta» con il fuoco sul titolo, senza Apple e Google", async ({
    page,
    baseURL,
  }) => {
    await needStack();
    const address = newAddress();
    const calls = recordAuth(page);
    try {
      await openAccess(page);
      await fillAndSubmit(page, {
        mode: "Registrati",
        email: address,
        password: "12345678",
      });
      await expect(checkPosta(page)).toBeVisible({ timeout: 10_000 });
      const signups = callsTo(calls, "/signup");
      expect(signups).toHaveLength(1);
      expect(signups[0]?.query.get("redirect_to")).toBe(
        `${new URL(baseURL as string).origin}/auth/callback?tipo=conferma`,
      );
      await expect(page).toHaveURL(/\/accesso$/);
      await expect(page.getByText(address)).toBeVisible();
      await expect(checkPosta(page)).toBeFocused();
      await expect(appleButton(page)).toBeHidden();
      await expect(googleButton(page)).toBeHidden();
    } finally {
      await removeByEmail(address);
    }
  });

  test("CA-8: «Indietro» da «Controlla la posta» riporta al modulo in «Entra» con Apple e Google, senza ricaricare il documento", async ({
    page,
  }) => {
    needSupabase();
    // «Indietro» is the arrow of the head: only below 1024 px.
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAuth(page, "/signup", { kind: "ok" });
    await openAccess(page);
    await fillAndSubmit(page, {
      mode: "Registrati",
      email: "marco@esempio.test",
      password: "12345678",
    });
    await expect(checkPosta(page)).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __senzaRicarica: boolean }).__senzaRicarica =
        true;
    });
    await page.getByRole("button", { name: "Indietro", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Entra", exact: true }).first(),
    ).toBeVisible();
    await expect(modeVoice(page, "Entra")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(appleButton(page)).toBeVisible();
    await expect(googleButton(page)).toBeVisible();
    await expect(page).toHaveURL(/\/accesso$/);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __senzaRicarica?: boolean }).__senzaRicarica,
      ),
    ).toBe(true);
  });

  test("CA-9: account non confermato con la password giusta: avviso «mail non confermata», «Rimanda la mail» manda un resend di tipo signup", async ({
    page,
  }) => {
    await needStack();
    const user = await createPasswordUser({ confirmed: false });
    try {
      const calls = recordAuth(page);
      await openAccess(page);
      await fillAndSubmit(page, user);
      await expect(statusWith(page, TEXT.unconfirmed)).toBeVisible();
      await resendButton(page).click();
      await expect.poll(() => callsTo(calls, "/resend").length).toBe(1);
      expect(callsTo(calls, "/resend")[0]?.body).toMatchObject({
        type: "signup",
      });
    } finally {
      await user.remove();
    }
  });

  test("CA-10: con /token trattenuto «Entra» mostra «Accesso in corso» con aria-busy e Apple e Google sono disabilitati", async ({
    page,
  }) => {
    needSupabase();
    const held = await holdAuth(page, supabaseUrl as string, "/token");
    try {
      await openAccess(page);
      await fillAndSubmit(page, {
        email: "marco@esempio.test",
        password: PASSWORD_OK,
      });
      await expect
        .poll(async () => {
          const state = await formState(page);
          return [
            state.submitText,
            state.submitBusy,
            ...state.providers.map((p) => p.disabled),
          ];
        })
        .toEqual(["Accesso in corso", "true", true, true]);
    } finally {
      held.release();
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("CA-10: con /authorize trattenuto dopo «Continua con Google» «Entra» è disabilitato e i campi sono in sola lettura", async ({
    page,
  }) => {
    needSupabase();
    // 204: the page stays where it is, so the loading state stays too.
    await page.route(`${supabaseUrl}/auth/v1/authorize*`, (route) =>
      route.fulfill({ status: 204 }),
    );
    try {
      await openAccess(page);
      await googleButton(page).click({ noWaitAfter: true });
      await expect
        .poll(async () => {
          const state = await formState(page);
          return [state.submitDisabled, ...state.inputsReadOnly];
        })
        .toEqual([true, true, true]);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("CA-11: errore di rete su /token: avviso con role=alert, «Riprova» rifà la stessa richiesta", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", { kind: "abort-once", then: {} });
    const calls = recordAuth(page);
    await openAccess(page);
    await fillAndSubmit(page, {
      email: "marco@esempio.test",
      password: PASSWORD_OK,
    });
    const notice = alertWith(page, TEXT.networkLogin);
    await expect(notice).toBeVisible();
    await retryButton(page).click();
    await expect.poll(() => callsTo(calls, "/token").length).toBe(2);
    const [first, second] = callsTo(calls, "/token");
    expect(second?.body).toEqual(first?.body);
  });

  test("CA-12: ?errore=google mostra l'avviso con il fuoco e «Riprova» avvia Google; ?account=eliminato mostra il testo", async ({
    page,
  }) => {
    needSupabase();
    const authorize: string[] = [];
    await page.route(`${supabaseUrl}/auth/v1/authorize*`, (route) => {
      authorize.push(route.request().url());
      return route.fulfill({ status: 204 });
    });
    try {
      await page.goto("/accesso?errore=google");
      await expect(page.getByText(TEXT.googleError)).toBeVisible();
      await expect(page.locator(":focus")).toContainText(TEXT.googleError);
      await waitHydrated(submitButton(page));
      await retryButton(page).click({ noWaitAfter: true });
      await expect.poll(() => authorize.length).toBe(1);
      expect(new URL(authorize[0]!).searchParams.get("provider")).toBe(
        "google",
      );

      await page.goto("/accesso?account=eliminato");
      await expect(page.getByText(TEXT.deleted)).toBeVisible();
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
  });

  test("CA-13: a 1280 px il fuoco è sul campo mail, a 390 px nessun campo ha il fuoco", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/accesso");
    await expect(mailField(page)).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/accesso");
    await waitHydrated(submitButton(page));
    await expect(mailField(page)).not.toBeFocused();
    await expect(passwordField(page)).not.toBeFocused();
  });

  test("CA-14: con una sessione /accesso e /accesso/mail portano a /oggi", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    const user = await createPasswordUser({ nest: true });
    try {
      await signInContext(page.context(), baseURL as string, user);
      await page.goto("/accesso");
      await expect(page).toHaveURL(/\/oggi$/);
      await page.goto("/accesso/mail");
      await expect(page).toHaveURL(/\/oggi$/);
    } finally {
      await user.remove();
    }
  });

  test("CA-15: senza sessione /accesso/mail porta a /accesso e un POST a /accesso/mail/invio risponde 303 verso /accesso", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    await expect(page).toHaveURL(/\/accesso$/);
    const response = await page.request.post("/accesso/mail/invio", {
      form: {},
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(new URL(response.headers()["location"]!, page.url()).pathname).toBe(
      "/accesso",
    );
  });

  test("CA-16: senza JavaScript il POST a /accesso/mail/invio non porta mail né password, si torna a /accesso senza sessione", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
    });
    try {
      const page = await context.newPage();
      await page.goto("/accesso");
      await mailField(page).fill("marco@esempio.test");
      await passwordField(page).fill(SECRET);
      const posted = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().endsWith("/accesso/mail/invio"),
      );
      await submitButton(page).click();
      const body = (await posted).postData() ?? "";
      expect(body).not.toContain("marco");
      expect(body).not.toContain(SECRET);
      await expect(page).toHaveURL(/\/accesso$/);
      expect(await sessionCookieNames(context)).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("CA-17: ricaricando i campi sono vuoti; mail e password non compaiono in URL, storage, console né negli avvisi", async ({
    page,
  }) => {
    needSupabase();
    const address = "marco@esempio.test";
    const lines: string[] = [];
    page.on("console", (message) => lines.push(message.text()));
    page.on("pageerror", (error) => lines.push(error.message));
    await mockAuth(page, "/token", INVALID_CREDENTIALS);
    await openAccess(page);
    await fillAndSubmit(page, { email: address, password: SECRET });
    await expect(alertWith(page, TEXT.credentials)).toBeVisible();
    const noticeTexts = await page
      .getByRole("alert")
      .or(page.getByRole("status"))
      .allInnerTexts();

    await mailField(page).fill(address);
    await passwordField(page).fill(SECRET);
    await page.reload();
    await expect(mailField(page)).toHaveValue("");
    await expect(passwordField(page)).toHaveValue("");

    const storage = await page.evaluate(() =>
      JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
    );
    const haystacks = [page.url(), storage, ...lines, ...noticeTexts];
    for (const haystack of haystacks) {
      expect(haystack).not.toContain(SECRET);
      expect(haystack).not.toContain(address);
      expect(haystack).not.toContain(encodeURIComponent(address));
    }
  });

  test("CA-18: accesso, registrazione, recupero e rinvio non chiamano mai /auth/v1/otp né magiclink", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", {
      kind: "status",
      status: 400,
      body: {
        code: 400,
        error_code: "email_not_confirmed",
        msg: "Email not confirmed",
      },
    });
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/recover", { kind: "ok" });
    await mockAuth(page, "/resend", { kind: "ok" });
    const calls = recordAuth(page);
    await openAccess(page);
    await fillAndSubmit(page, {
      email: "marco@esempio.test",
      password: PASSWORD_OK,
    });
    await expect(statusWith(page, TEXT.unconfirmed)).toBeVisible();
    await resendButton(page).click();
    await expect.poll(() => callsTo(calls, "/resend").length).toBe(1);

    await openAccess(page);
    await fillAndSubmit(page, {
      mode: "Registrati",
      email: "nuova@esempio.test",
      password: PASSWORD_OK,
    });
    await expect(checkPosta(page)).toBeVisible();

    await openAccess(page);
    await forgotLink(page).click();
    await expect(page).toHaveURL(/\/accesso\/password-dimenticata$/);
    // The page left stays in the DOM, hidden: only the visible field counts.
    await mailField(page).filter({ visible: true }).fill("marco@esempio.test");
    await submitButton(page).filter({ visible: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" }),
    ).toBeVisible();
    expect(callsTo(calls, "/signup")).toHaveLength(1);
    expect(callsTo(calls, "/recover")).toHaveLength(1);
    expectNoMagicLink(calls);
  });
});
