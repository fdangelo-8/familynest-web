import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  RATE_LIMIT,
  admin,
  alertWith,
  callsTo,
  createPasswordUser,
  expectMailCount,
  mailField,
  mockAuth,
  modeVoice,
  newAddress,
  passwordField,
  recordAuth,
  removeByEmail,
  signInContext,
  statusWith,
  submitButton,
  untilHydrated,
} from "../fixtures/accesso-password";
import {
  SIZES,
  TECHNICAL,
  TEXT,
  againButton,
  checkPosta,
  needKeys,
  needStack,
  openAccess,
  resendButton,
  seedCredentials,
  sentTitle,
  snapshot,
} from "../fixtures/accesso-principale";
import { sessionCookieNames } from "../fixtures/conferma-link";
import { SEED_HOME_A } from "../fixtures/invito";
import { skipReason, usersConfigured } from "../fixtures/auth";

// Neutral messages, limits and who the calls go to (#461, CA-30 ... CA-37):
// nothing visible tells whether a mail has an account. «Seed A/B» is stood for
// by throwaway users where the identity of the seed does not matter; CA-30
// uses the real seed B because it looks for the id of the Nest of seed A.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PASSWORD_OK = "pw-di-prova-7931";
const OTHER_PASSWORD = "un-altra-pw-5522";
const NOT_CONFIRMED = {
  kind: "status",
  status: 400,
  body: {
    code: 400,
    error_code: "email_not_confirmed",
    msg: "Email not confirmed",
  },
} as const;

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

async function submitRegister(page: Page, email: string, password: string) {
  await modeVoice(page, "Registrati").click();
  await mailField(page).fill(email);
  await passwordField(page, "Scegli una password").fill(password);
  await submitButton(page).click({ noWaitAfter: true });
}

async function submitLogin(page: Page, email: string, password: string) {
  await modeVoice(page, "Entra").click();
  await mailField(page).fill(email);
  await passwordField(page).fill(password);
  await submitButton(page).click({ noWaitAfter: true });
}

type Outcome = { dom: string; url: string; title: string; toast?: string };

async function outcomeOf(
  page: Page,
  address: string,
  toast?: string,
): Promise<Outcome> {
  return {
    dom: await snapshot(page, address),
    url: new URL(page.url()).pathname,
    title: await page.title(),
    toast,
  };
}

function expectSame(outcomes: Array<{ name: string; outcome: Outcome }>) {
  const [first, ...others] = outcomes;
  for (const other of others) {
    expect(other.outcome, `${other.name} come ${first!.name}`).toEqual(
      first!.outcome,
    );
  }
}

// ------------------------------------------------------------- isolamento

test.describe("isolamento tra nuclei", () => {
  test("CA-30: l'utente del seed B entra da /accesso e nessuna risposta contiene SEED_HOME_A o la mail di un utente del Nest A", async ({
    page,
  }) => {
    needKeys();
    test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
    const seedB = seedCredentials("B");
    const emailA = process.env.TEST_USER_A_EMAIL as string;
    const bodies: Promise<string>[] = [];
    page.on("response", (response) => {
      const type = response.request().resourceType();
      if (!["document", "fetch", "xhr"].includes(type)) return;
      bodies.push(response.text().catch(() => ""));
    });
    await openAccess(page);
    await submitLogin(page, seedB.email, seedB.password);
    await expect(page).toHaveURL(/\/oggi$/, { timeout: 15_000 });
    const all = await Promise.all(bodies);
    expect(all.length).toBeGreaterThan(0);
    for (const body of all) {
      expect(body).not.toContain(SEED_HOME_A);
      expect(body).not.toContain(emailA);
    }
  });
});

// ------------------------------------------------------- messaggi neutri

test.describe("messaggi neutri", () => {
  test("CA-31: Registrati con una mail già registrata mostra «Controlla la posta» come per una mail nuova, senza sessione né mail, e la vecchia password funziona ancora", async ({
    browser,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser({ nest: true });
    const fresh = newAddress("nuova");
    try {
      const outcomes: Array<{ name: string; outcome: Outcome }> = [];
      for (const [name, address] of [
        ["mail nuova", fresh],
        ["mail già registrata", user.email],
      ] as const) {
        const context = await browser.newContext({ baseURL });
        try {
          const page = await context.newPage();
          await openAccess(page);
          await submitRegister(page, address, OTHER_PASSWORD);
          await expect(checkPosta(page)).toBeVisible({ timeout: 10_000 });
          expect(await sessionCookieNames(context)).toEqual([]);
          outcomes.push({ name, outcome: await outcomeOf(page, address) });
        } finally {
          await context.close();
        }
      }
      expectSame(outcomes);
      await expectMailCount(user.email, 0);

      const check = await browser.newContext({ baseURL });
      try {
        await signInContext(check, baseURL as string, user);
        expect((await sessionCookieNames(check)).length).toBeGreaterThan(0);
      } finally {
        await check.close();
      }
    } finally {
      await user.remove();
      await removeByEmail(fresh);
    }
  });

  test("CA-32: «Password dimenticata» ha lo stesso esito per una mail registrata, una mai registrata e con /recover a 429, anche dopo 60 s con «Mandami un altro link»", async ({
    browser,
    baseURL,
  }) => {
    await needStack();
    const user = await createPasswordUser();
    try {
      const outcomes: Array<{ name: string; outcome: Outcome }> = [];
      const cases = [
        { name: "mail registrata", address: user.email, limited: false },
        {
          name: "mail mai registrata",
          address: newAddress("x"),
          limited: false,
        },
        { name: "429", address: newAddress("limite"), limited: true },
      ];
      for (const item of cases) {
        const context = await browser.newContext({ baseURL });
        try {
          const page = await context.newPage();
          if (item.limited) await mockAuth(page, "/recover", RATE_LIMIT);
          await page.clock.install({ time: new Date("2026-11-18T10:00:00Z") });
          await page.goto("/accesso/password-dimenticata");
          await page.clock.pauseAt(new Date("2026-11-18T10:00:05Z"));
          await untilHydrated(
            async () => {
              await mailField(page).fill(item.address, { timeout: 2000 });
              await submitButton(page).click({
                timeout: 2000,
                noWaitAfter: true,
              });
            },
            () => expect(sentTitle(page)).toBeVisible({ timeout: 8000 }),
          );
          const first = await outcomeOf(page, item.address);
          await expect(againButton(page)).toBeDisabled();
          await page.clock.runFor(60_000);
          await againButton(page).click();
          await expect(page.getByText(TEXT.recoverResent)).toBeVisible();
          const second = await outcomeOf(
            page,
            item.address,
            await page.getByText(TEXT.recoverResent).innerText(),
          );
          outcomes.push({
            name: `${item.name}, primo invio`,
            outcome: first,
          });
          outcomes.push({
            name: `${item.name}, secondo invio`,
            outcome: second,
          });
        } finally {
          await context.close();
        }
      }
      const firsts = outcomes.filter((o) => o.name.endsWith("primo invio"));
      const seconds = outcomes.filter((o) => o.name.endsWith("secondo invio"));
      expectSame(firsts);
      expectSame(seconds);
    } finally {
      await user.remove();
    }
  });

  test("CA-33: «Rimanda la mail» ha lo stesso esito visibile per un account non confermato, uno confermato e una mail mai registrata, da «Controlla la posta» e dall'avviso", async ({
    browser,
    baseURL,
  }) => {
    await needStack();
    const unconfirmed = await createPasswordUser({ confirmed: false });
    const confirmed = await createPasswordUser();
    const never = newAddress("mai");
    const registered = newAddress("registrata");
    try {
      // From «Controlla la posta» (after the 60 s of waiting).
      const fromCheck: Array<{ name: string; outcome: Outcome }> = [];
      for (const item of [
        { name: "non confermato", address: registered, mockSignup: false },
        { name: "confermato", address: confirmed.email, mockSignup: false },
        { name: "mai registrata", address: never, mockSignup: true },
      ]) {
        const context = await browser.newContext({ baseURL });
        try {
          const page = await context.newPage();
          if (item.mockSignup) await mockAuth(page, "/signup", { kind: "ok" });
          await page.clock.install({ time: new Date("2026-11-18T10:00:00Z") });
          await page.goto("/accesso");
          await page.clock.pauseAt(new Date("2026-11-18T10:00:05Z"));
          await untilHydrated(
            async () => {
              await modeVoice(page, "Registrati").click({ timeout: 2000 });
              await mailField(page).fill(item.address, { timeout: 2000 });
              await passwordField(page, "Scegli una password").fill(
                PASSWORD_OK,
                { timeout: 2000 },
              );
              await submitButton(page).click({
                timeout: 2000,
                noWaitAfter: true,
              });
            },
            () => expect(checkPosta(page)).toBeVisible({ timeout: 8000 }),
          );
          await page.clock.runFor(60_000);
          await resendButton(page).click();
          await expect(page.getByText(TEXT.resent)).toBeVisible();
          fromCheck.push({
            name: item.name,
            outcome: await outcomeOf(page, item.address, TEXT.resent),
          });
        } finally {
          await context.close();
        }
      }
      expectSame(fromCheck);

      // From the notice «mail non confermata».
      const fromNotice: Array<{ name: string; outcome: Outcome }> = [];
      for (const item of [
        { name: "non confermato", address: unconfirmed.email, real: true },
        { name: "confermato", address: confirmed.email, real: false },
        { name: "mai registrata", address: never, real: false },
      ]) {
        const context = await browser.newContext({ baseURL });
        try {
          const page = await context.newPage();
          // Only the unconfirmed account really gets to the notice; for the
          // others the answer of /token is simulated to reach the same button.
          if (!item.real) await mockAuth(page, "/token", NOT_CONFIRMED);
          await openAccess(page);
          await submitLogin(page, item.address, PASSWORD_OK);
          await expect(statusWith(page, TEXT.unconfirmed)).toBeVisible();
          await resendButton(page).click();
          await expect(page.getByText(TEXT.resent)).toBeVisible();
          fromNotice.push({
            name: item.name,
            outcome: await outcomeOf(page, item.address, TEXT.resent),
          });
        } finally {
          await context.close();
        }
      }
      expectSame(fromNotice);
    } finally {
      await unconfirmed.remove();
      await confirmed.remove();
      await removeByEmail(registered);
      await removeByEmail(never);
    }
  });

  for (const size of SIZES) {
    test(`CA-34: con 429 su token, signup, recover e resend l'avviso è informativo e senza testo tecnico (${size.name} px)`, async ({
      page,
    }) => {
      needSupabase();
      await page.setViewportSize({ width: size.width, height: size.height });
      const noTechnical = async () => {
        const texts = await page.getByRole("status").allInnerTexts();
        expect(texts.join(" ")).not.toMatch(TECHNICAL);
      };

      // token
      await mockAuth(page, "/token", RATE_LIMIT);
      await openAccess(page);
      await submitLogin(page, "marco@esempio.test", PASSWORD_OK);
      await expect(statusWith(page, TEXT.limitLogin)).toBeVisible();
      await noTechnical();
      await page.unrouteAll({ behavior: "ignoreErrors" });

      // signup
      await mockAuth(page, "/signup", RATE_LIMIT);
      await openAccess(page);
      await submitRegister(page, "nuova@esempio.test", PASSWORD_OK);
      await expect(
        statusWith(page, /Ti abbiamo appena mandato una mail/),
      ).toBeVisible();
      await noTechnical();
      await page.unrouteAll({ behavior: "ignoreErrors" });

      // resend, from the notice «mail non confermata»
      await mockAuth(page, "/token", NOT_CONFIRMED);
      await mockAuth(page, "/resend", RATE_LIMIT);
      await openAccess(page);
      await submitLogin(page, "marco@esempio.test", PASSWORD_OK);
      await expect(statusWith(page, TEXT.unconfirmed)).toBeVisible();
      await resendButton(page).click();
      await expect(
        statusWith(page, /La mail di prima è appena partita/),
      ).toBeVisible();
      await noTechnical();
      await page.unrouteAll({ behavior: "ignoreErrors" });

      // recover: the 429 looks like a success (CA-32), and shows nothing technical
      await mockAuth(page, "/recover", RATE_LIMIT);
      await page.goto("/accesso/password-dimenticata");
      await untilHydrated(
        async () => {
          await mailField(page).fill("marco@esempio.test", { timeout: 2000 });
          await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
        },
        () => expect(sentTitle(page)).toBeVisible({ timeout: 8000 }),
      );
      await noTechnical();
      expect(await page.getByRole("main").innerText()).not.toMatch(TECHNICAL);
    });
  }

  test("CA-35: mail e password vanno solo a <Supabase>/auth/v1/, mai all'origine dell'app (corpi compresi)", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    const address = "marco@esempio.test";
    const secret = "pw-segreta-per-CA35";
    const seen: Array<{ url: string; body: string }> = [];
    page.on("request", (request) =>
      seen.push({ url: request.url(), body: request.postData() ?? "" }),
    );
    await mockAuth(page, "/token", NOT_CONFIRMED);
    await mockAuth(page, "/resend", { kind: "ok" });
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/recover", { kind: "ok" });
    const calls = recordAuth(page);

    await openAccess(page);
    await submitLogin(page, address, secret);
    await expect(statusWith(page, TEXT.unconfirmed)).toBeVisible();
    await resendButton(page).click();
    await expect.poll(() => callsTo(calls, "/resend").length).toBe(1);
    await openAccess(page);
    await submitRegister(page, address, secret);
    await expect(checkPosta(page)).toBeVisible();
    await page.goto("/accesso/password-dimenticata");
    await untilHydrated(
      async () => {
        await mailField(page).fill(address, { timeout: 2000 });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () => expect(sentTitle(page)).toBeVisible({ timeout: 8000 }),
    );

    const mentions = (text: string) =>
      [address, encodeURIComponent(address), secret].some((value) =>
        text.includes(value),
      );
    const carrying = seen.filter((r) => mentions(r.url) || mentions(r.body));
    expect(carrying.length).toBeGreaterThan(0);
    for (const request of carrying) {
      expect(request.url.startsWith(`${supabaseUrl}/auth/v1/`)).toBe(true);
    }
    const origin = new URL(baseURL as string).origin;
    for (const request of seen.filter((r) => r.url.startsWith(origin))) {
      expect(mentions(request.url), request.url).toBe(false);
      expect(mentions(request.body), request.url).toBe(false);
    }
  });

  test("CA-36: la password con spazio iniziale e finale arriva a signup identica; con 73 caratteri non parte nessuna richiesta e compare l'errore", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    const calls = recordAuth(page);
    await openAccess(page);
    await submitRegister(page, "nuova@esempio.test", " abcdefg ");
    await expect(checkPosta(page)).toBeVisible();
    const [signup] = callsTo(calls, "/signup");
    expect(signup?.body["password"]).toBe(" abcdefg ");

    await openAccess(page);
    await submitRegister(page, "nuova@esempio.test", "a".repeat(73));
    await expect(page.getByText(TEXT.tooLong)).toBeVisible();
    expect(callsTo(calls, "/signup")).toHaveLength(1);
  });

  test("CA-37: dopo l'accesso con Google sulla stessa mail, mail e password dell'account non confermato danno l'avviso «credenziali», senza sessione", async ({
    browser,
    baseURL,
  }) => {
    needKeys();
    const user = await createPasswordUser({ confirmed: false });
    try {
      // The local stack has no Google: the effect of the sign-in with the same
      // mail (mail confirmed by the provider, the password of the unconfirmed
      // registration gone) is simulated with the administrative key.
      const { error } = await admin().auth.admin.updateUserById(user.id, {
        email_confirm: true,
        password: randomUUID(),
        app_metadata: {
          provider: "google",
          providers: ["email", "google"],
          familynest_test_user: true,
        },
      });
      expect(error).toBeNull();

      const context = await browser.newContext({ baseURL });
      try {
        const tab = await context.newPage();
        await openAccess(tab);
        await submitLogin(tab, user.email, user.password);
        await expect(alertWith(tab, TEXT.credentials)).toBeVisible();
        expect(await sessionCookieNames(context)).toEqual([]);
      } finally {
        await context.close();
      }
    } finally {
      await user.remove();
    }
  });
});
