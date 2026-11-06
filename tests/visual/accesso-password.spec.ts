import { expect, test, type Page } from "@playwright/test";
import {
  RATE_LIMIT,
  alertWith,
  createPasswordUser,
  keysConfigured,
  keysSkipReason,
  mailField,
  mockAuth,
  modeVoice,
  passwordField,
  recoveryLink,
  statusWith,
  submitButton,
  submitMailForm,
  untilHydrated,
} from "../fixtures/accesso-password";
import { setInviteCookie } from "../fixtures/invito-ingresso";

// Pages of the sign-in with mail and password (#327), one screenshot per state
// of the graphic specification (docs/specifiche/327-accesso-mail-grafica.md),
// at 390 and 1280 px (the two projects). Supabase is simulated, except for
// «Nuova password» that needs a real recovery session. Clock fixed, motion
// reduced, countdowns frozen. The last block repeats the main states with the
// text enlarged to 200% (mobile only).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MAIL = "marco.dangelo@example.com";
const PASSWORD = "una-password-di-prova";
const START = new Date("2026-10-23T10:00:00+02:00");

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Take the pointer out of the picture.
  await page.mouse.move(0, 0);
}

const badRequest = (error_code: string) =>
  ({
    kind: "status",
    status: 400,
    body: { code: 400, error_code, msg: "no" },
  }) as const;

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name });

/** Opens /accesso/mail and presses «Entra» with the given fields. */
async function enter(
  page: Page,
  done: () => Promise<void>,
  fields: { email: string; password: string } = {
    email: MAIL,
    password: PASSWORD,
  },
) {
  await page.goto("/accesso/mail");
  await submitMailForm(page, { mode: "Entra", ...fields }, done);
}

/** Registers with a good password until «Controlla la posta» is on screen. */
async function reachCheckMail(page: Page) {
  await mockAuth(page, "/signup", { kind: "ok" });
  await page.goto("/accesso/mail");
  await submitMailForm(
    page,
    { mode: "Registrati", email: MAIL, password: PASSWORD },
    () => expect(heading(page, "Controlla la posta")).toBeVisible(),
  );
}

async function sendForgot(page: Page, done: () => Promise<void>) {
  await page.goto("/accesso/password-dimenticata");
  await untilHydrated(async () => {
    await mailField(page).fill(MAIL, { timeout: 2000 });
    await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
  }, done);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

test.describe("accesso con mail e password", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: START });
  });

  // ------------------------------------------------------------------ Entra

  test("entra: campi vuoti", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    await expect(mailField(page)).toBeFocused();
    await shot(page, "entra-campi-vuoti.png");
  });

  test("entra: mail non valida", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await mailField(page).fill("marco@", { timeout: 2000 });
        await passwordField(page).fill(PASSWORD, { timeout: 2000 });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    await expect(mailField(page)).toBeFocused();
    await shot(page, "entra-mail-non-valida.png");
  });

  test("entra: password mostrata", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await passwordField(page).fill(PASSWORD, { timeout: 2000 });
        await page
          .getByRole("button", { name: "Mostra la password" })
          .click({ timeout: 2000 });
      },
      () => expect(passwordField(page)).toHaveAttribute("type", "text"),
    );
    await shot(page, "entra-password-mostrata.png");
  });

  test("entra: in attesa dell'invio", async ({ page }) => {
    needSupabase();
    // The request never answers: the loading state stays.
    await page.route(`${supabaseUrl}/auth/v1/token*`, () => undefined);
    await enter(page, () =>
      expect(submitButton(page)).toHaveAttribute("aria-busy", "true", {
        timeout: 1000,
      }),
    );
    await shot(page, "entra-invio.png");
  });

  test("entra: mail e password non corrispondono", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/token", badRequest("invalid_credentials"));
    await enter(page, () =>
      expect(
        alertWith(page, "La mail e la password non corrispondono."),
      ).toBeVisible({ timeout: 3000 }),
    );
    await expect(passwordField(page)).toBeFocused();
    await shot(page, "entra-credenziali.png");
  });

  test("entra: mail non confermata", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/token", badRequest("email_not_confirmed"));
    await enter(page, () =>
      expect(
        statusWith(page, "Questa mail non è ancora confermata."),
      ).toBeVisible({ timeout: 3000 }),
    );
    await shot(page, "entra-non-confermata.png");
  });

  test("entra: troppi tentativi", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/token", RATE_LIMIT);
    await enter(page, () =>
      expect(statusWith(page, "Troppi tentativi di fila.")).toBeVisible({
        timeout: 3000,
      }),
    );
    await shot(page, "entra-limite.png");
  });

  test("entra: senza connessione", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/token", { kind: "abort" });
    await enter(page, () =>
      expect(
        alertWith(page, "Non siamo riusciti a farti entrare."),
      ).toBeVisible({ timeout: 3000 }),
    );
    await shot(page, "entra-rete.png");
  });

  // ------------------------------------------------------------- Registrati

  test("registrati: stato normale", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => modeVoice(page, "Registrati").click({ timeout: 2000 }),
      () =>
        expect(heading(page, "Crea il tuo account")).toBeVisible({
          timeout: 1000,
        }),
    );
    await shot(page, "registrati.png");
  });

  test("registrati: regola rispettata e password mostrata", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await modeVoice(page, "Registrati").click({ timeout: 2000 });
        await mailField(page).fill(MAIL, { timeout: 2000 });
        await passwordField(page, "Scegli una password").fill(PASSWORD, {
          timeout: 2000,
        });
        await page
          .getByRole("button", { name: "Mostra la password" })
          .click({ timeout: 2000 });
      },
      async () => {
        await expect(
          page.locator(".regole-password__regola--rispettata"),
        ).toBeVisible({ timeout: 1000 });
        await expect(
          passwordField(page, "Scegli una password"),
        ).toHaveAttribute("type", "text");
      },
    );
    await shot(page, "registrati-regola-rispettata.png");
  });

  test("registrati: campi vuoti", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await modeVoice(page, "Registrati").click({ timeout: 2000 });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    await shot(page, "registrati-campi-vuoti.png");
  });

  test("registrati: password troppo corta", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await modeVoice(page, "Registrati").click({ timeout: 2000 });
        await mailField(page).fill(MAIL, { timeout: 2000 });
        await passwordField(page, "Scegli una password").fill("1234567", {
          timeout: 2000,
        });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () =>
        expect(passwordField(page, "Scegli una password")).toHaveAttribute(
          "aria-invalid",
          "true",
          { timeout: 1000 },
        ),
    );
    await shot(page, "registrati-password-corta.png");
  });

  test("registrati: password troppo facile", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/signup", {
      kind: "status",
      status: 422,
      body: { code: 422, error_code: "weak_password", msg: "weak" },
    });
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: "password1234" },
      () =>
        expect(
          page.getByText("Questa password è troppo facile da indovinare"),
        ).toBeVisible({ timeout: 3000 }),
    );
    await shot(page, "registrati-password-debole.png");
  });

  test("registrati: troppe richieste", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/signup", RATE_LIMIT);
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD },
      () =>
        expect(
          statusWith(page, "Ti abbiamo appena mandato una mail."),
        ).toBeVisible({ timeout: 3000 }),
    );
    await shot(page, "registrati-limite.png");
  });

  test("registrati: senza connessione", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "abort" });
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD },
      () =>
        expect(
          alertWith(page, "Non siamo riusciti a creare l'account."),
        ).toBeVisible({ timeout: 3000 }),
    );
    await shot(page, "registrati-rete.png");
  });

  // ---------------------------------------------------- Controlla la posta

  test("controlla la posta: con il cookie d'invito", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await setInviteCookie(page, baseURL!, "a1".repeat(32));
    await reachCheckMail(page);
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await expect(
      page.getByText("Apri il link su questo dispositivo"),
    ).toBeVisible();
    await shot(page, "controlla-la-posta-invito.png");
  });

  test("controlla la posta: la mail non parte", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/resend", { kind: "abort" });
    await reachCheckMail(page);
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await page.clock.runFor(60_000);
    await page.getByRole("button", { name: "Rimanda la mail" }).click();
    await expect(
      alertWith(page, "Non siamo riusciti a mandare la mail."),
    ).toBeVisible();
    await shot(page, "controlla-la-posta-rete.png");
  });

  test("controlla la posta: troppe richieste", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/resend", RATE_LIMIT);
    await reachCheckMail(page);
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await page.clock.runFor(60_000);
    await page.getByRole("button", { name: "Rimanda la mail" }).click();
    await expect(
      statusWith(page, "La mail di prima è appena partita."),
    ).toBeVisible();
    await shot(page, "controlla-la-posta-limite.png");
  });

  test("controlla la posta: mail rimandata", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/resend", { kind: "ok" });
    await reachCheckMail(page);
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await page.clock.runFor(60_000);
    await page.getByRole("button", { name: "Rimanda la mail" }).click();
    await expect(
      page.getByText("Mail rimandata: usa quella più recente."),
    ).toBeVisible();
    await shot(page, "controlla-la-posta-rimandata.png");
  });

  // ---------------------------------------------------- Password dimenticata

  test("password dimenticata: stato normale", async ({ page }) => {
    await page.goto("/accesso/password-dimenticata");
    await expect(heading(page, "Hai dimenticato la password?")).toBeVisible();
    await shot(page, "password-dimenticata.png");
  });

  test("password dimenticata: mail vuota", async ({ page }) => {
    await page.goto("/accesso/password-dimenticata");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    await shot(page, "password-dimenticata-mail-vuota.png");
  });

  test("password dimenticata: senza connessione", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "abort" });
    await sendForgot(page, () =>
      expect(
        alertWith(page, "Non siamo riusciti a mandare il link."),
      ).toBeVisible({ timeout: 3000 }),
    );
    await shot(page, "password-dimenticata-rete.png");
  });

  test("ti abbiamo scritto", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "ok" });
    await sendForgot(page, () =>
      expect(heading(page, "Ti abbiamo scritto")).toBeVisible({
        timeout: 3000,
      }),
    );
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await shot(page, "ti-abbiamo-scritto.png");
  });

  // ----------------------------------------------------------- Link scaduto

  test("link scaduto: scegliere una nuova password", async ({ page }) => {
    await page.goto("/accesso/link-scaduto?tipo=password");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await shot(page, "link-scaduto-password.png");
  });
});

// ------------------------------------------------------------ Nuova password
// No fixed clock here: the recovery session of the real stack must not look
// expired. The page shows no date.

test.describe("accesso con mail e password: nuova password", () => {
  test("nuova password: stato normale e errore", async ({ page }) => {
    test.skip(!keysConfigured(), keysSkipReason);
    const user = await createPasswordUser({ nest: true });
    try {
      await page.goto(await recoveryLink(user.email));
      await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
      await expect(heading(page, "Scegli una nuova password")).toBeVisible();
      await shot(page, "nuova-password.png");

      const field = passwordField(page, "Nuova password");
      await untilHydrated(
        async () => {
          await field.fill("1234567", { timeout: 2000 });
          await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
        },
        () =>
          expect(field).toHaveAttribute("aria-invalid", "true", {
            timeout: 1000,
          }),
      );
      await shot(page, "nuova-password-corta.png");
    } finally {
      await user.remove();
    }
  });
});

// ------------------------------------------------------- Testo ingrandito

// Browser font size at 32 px (200%), set with CDP BEFORE the navigation, as in
// the validation spec of the screens (#308). Mobile only: 390 px is where the
// enlarged text puts the layout under pressure.
test.describe("accesso con mail e password: testo al 200%", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "solo a 390 px");
    await page.clock.install({ time: START });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  });

  test("entra con il testo al 200%", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(mailField(page)).toHaveAttribute("aria-invalid", "true", {
          timeout: 1000,
        }),
    );
    await shot(page, "testo-200-entra-errori.png");
  });

  test("registrati con il testo al 200%", async ({ page }) => {
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await modeVoice(page, "Registrati").click({ timeout: 2000 });
        await passwordField(page, "Scegli una password").fill(PASSWORD, {
          timeout: 2000,
        });
      },
      () =>
        expect(
          page.locator(".regole-password__regola--rispettata"),
        ).toBeVisible({
          timeout: 1000,
        }),
    );
    await shot(page, "testo-200-registrati.png");
  });

  test("controlla la posta con il testo al 200%", async ({ page }) => {
    needSupabase();
    await reachCheckMail(page);
    await page.clock.pauseAt(new Date(START.getTime() + 2000));
    await shot(page, "testo-200-controlla-la-posta.png");
  });

  test("password dimenticata con il testo al 200%", async ({ page }) => {
    await page.goto("/accesso/password-dimenticata");
    await expect(heading(page, "Hai dimenticato la password?")).toBeVisible();
    await shot(page, "testo-200-password-dimenticata.png");
  });

  test("link scaduto con il testo al 200%", async ({ page }) => {
    await page.goto("/accesso/link-scaduto?tipo=password");
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await shot(page, "testo-200-link-scaduto.png");
  });
});
