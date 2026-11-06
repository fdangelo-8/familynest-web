import { expect, test, type Page } from "@playwright/test";
import {
  RATE_LIMIT,
  alertWith,
  callsTo,
  expectNoMagicLink,
  h1,
  mailField,
  mockAuth,
  modeGroup,
  modeVoice,
  passwordField,
  recordAuth,
  statusWith,
  submitButton,
  submitMailForm,
  untilHydrated,
} from "../fixtures/accesso-password";
import { COOKIE, setInviteCookie } from "../fixtures/invito-ingresso";

// Pages of the sign-in with mail and password (#327), with Supabase simulated:
// the requests of the browser to the Auth API are intercepted, so these tests
// check the interface, the checks before sending and what the page sends. The
// flows with the real stack and the mails are in accesso-password-mail.spec.ts.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MAIL = "marco@esempio.test";
const PASSWORD_OK = "12345678";
const INVITE_TOKEN = "a1".repeat(32);

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

const checkPosta = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Controlla la posta" });
const resendButton = (page: Page) =>
  page.getByRole("button", { name: "Rimanda la mail", exact: true });
const forgotMail = (page: Page) => page.getByLabel("La tua mail");

/** Registers (with the answer of Supabase already simulated) and waits for «Controlla la posta». */
async function reachCheckMail(page: Page, address = MAIL) {
  await page.goto("/accesso/mail");
  await submitMailForm(
    page,
    { mode: "Registrati", email: address, password: PASSWORD_OK },
    () => expect(checkPosta(page)).toBeVisible({ timeout: 3000 }),
  );
}

test.describe("/accesso/mail: Entra e Registrati", () => {
  test("«Usa la mail» porta al modulo, «Entra» è la voce predefinita", async ({
    page,
  }) => {
    await page.goto("/accesso");
    await page.getByRole("link", { name: "Usa la mail" }).click();
    await expect(page).toHaveURL(/\/accesso\/mail$/);
    await expect(h1(page)).toHaveText("Entra con la mail");
    await expect(modeVoice(page, "Entra")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(modeVoice(page, "Registrati")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(
      page.getByText("Scrivi la mail e la password del tuo account."),
    ).toBeVisible();
    await expect(submitButton(page)).toHaveText("Entra");
  });

  test("CA-19: un solo modulo, un solo campo per tipo, attributi dei campi", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.locator("input[type=password]")).toHaveCount(1);
    await expect(page.locator("input[type=email]")).toHaveCount(1);
    const form = page.locator("form");
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/accesso/mail/invio");
    await expect(form).toHaveAttribute("novalidate", "");
    // No field has a `name`: a native submit would put the values in the URL.
    expect(
      await page
        .locator("form input")
        .evaluateAll((inputs) =>
          inputs.map((input) => input.getAttribute("name")),
        ),
    ).toEqual([null, null]);
    await expect(mailField(page)).toHaveAttribute("autocomplete", "username");
    await expect(mailField(page)).toHaveAttribute("inputmode", "email");
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await expect(passwordField(page)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await modeVoice(page, "Registrati").click();
    await expect(passwordField(page, "Scegli una password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.locator("input[type=password]")).toHaveCount(1);
  });

  test("passare a «Registrati»: la mail resta, la password si svuota e torna nascosta", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    // Hydrated when the voice answers; then back to «Entra».
    await untilHydrated(
      () => modeVoice(page, "Registrati").click({ timeout: 2000 }),
      () =>
        expect(h1(page)).toHaveText("Crea il tuo account", { timeout: 1000 }),
    );
    await modeVoice(page, "Entra").click();
    // A wrong submit, to have an error to see disappear.
    await mailField(page).fill("");
    await submitButton(page).click();
    await expect(
      page.getByText("Scrivi la tua mail per entrare."),
    ).toBeVisible();
    await mailField(page).fill(MAIL);
    await passwordField(page).fill("qualcosa");
    await page.getByRole("button", { name: "Mostra la password" }).click();
    await expect(passwordField(page)).toHaveAttribute("type", "text");

    await modeVoice(page, "Registrati").click();
    await expect(h1(page)).toHaveText("Crea il tuo account");
    await expect(
      page.getByText("Poi ti mandiamo una mail per confermare l'indirizzo."),
    ).toBeVisible();
    await expect(submitButton(page)).toHaveText("Crea l'account");
    await expect(mailField(page)).toHaveValue(MAIL);
    const secret = passwordField(page, "Scegli una password");
    await expect(secret).toHaveValue("");
    await expect(secret).toHaveAttribute("type", "password");
    await expect(page.getByText("Scrivi la tua mail per entrare.")).toHaveCount(
      0,
    );
    await expect(modeVoice(page, "Registrati")).toBeFocused();
    await expect(
      page.getByText("Password dimenticata?", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Da 8 a 72 caratteri")).toBeVisible();
    await expect(modeGroup(page)).toBeVisible();
  });

  test("CA-20: «Password dimenticata?» porta a /accesso/password-dimenticata", async ({
    page,
  }) => {
    await page.goto("/accesso/mail");
    await page.getByRole("link", { name: "Password dimenticata?" }).click();
    await expect(page).toHaveURL(/\/accesso\/password-dimenticata$/);
    await expect(h1(page)).toHaveText("Hai dimenticato la password?");
  });
});

test.describe("Registrati: controlli prima dell'invio", () => {
  async function submitRegister(
    page: Page,
    address: string,
    password: string,
    done: () => Promise<void>,
  ) {
    await submitMailForm(
      page,
      { mode: "Registrati", email: address, password },
      done,
    );
  }

  test("CA-5: mail e password vuote, nessuna richiesta, il focus va sulla mail", async ({
    page,
  }) => {
    needSupabase();
    const calls = recordAuth(page);
    await page.goto("/accesso/mail");
    await untilHydrated(
      async () => {
        await modeVoice(page, "Registrati").click({ timeout: 2000 });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () =>
        expect(
          page.getByText("Scrivi la tua mail per registrarti."),
        ).toBeVisible({ timeout: 1000 }),
    );
    await expect(
      page.getByText("Scegli una password per registrarti."),
    ).toBeVisible();
    await expect(mailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(passwordField(page, "Scegli una password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(mailField(page)).toBeFocused();
    expect(calls).toEqual([]);
  });

  for (const [length, text] of [
    [7, "La password è troppo corta: servono almeno 8 caratteri."],
    [73, "La password è troppo lunga: al massimo 72 caratteri."],
  ] as const) {
    test(`CA-6: password di ${length} caratteri, nessuna richiesta`, async ({
      page,
    }) => {
      needSupabase();
      const calls = recordAuth(page);
      await page.goto("/accesso/mail");
      await submitRegister(page, MAIL, "a".repeat(length), () =>
        expect(page.getByText(text)).toBeVisible({ timeout: 1000 }),
      );
      await expect(passwordField(page, "Scegli una password")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(passwordField(page, "Scegli una password")).toBeFocused();
      expect(calls).toEqual([]);
    });
  }

  for (const address of ["nome@esempio", "nome @esempio.it"]) {
    test(`CA-7: «${address}», nessuna richiesta`, async ({ page }) => {
      needSupabase();
      const calls = recordAuth(page);
      await page.goto("/accesso/mail");
      await submitRegister(page, address, PASSWORD_OK, () =>
        expect(
          page.getByText(
            "Controlla la mail: dovrebbe essere come nome@esempio.it.",
          ),
        ).toBeVisible({ timeout: 1000 }),
      );
      await expect(mailField(page)).toHaveAttribute("aria-invalid", "true");
      expect(calls).toEqual([]);
    });
  }

  test("la password non si modifica: gli spazi restano (8 spazi sono validi)", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    const calls = recordAuth(page);
    await page.goto("/accesso/mail");
    await submitRegister(page, `  ${MAIL}  `, "        ", () =>
      expect(checkPosta(page)).toBeVisible({ timeout: 3000 }),
    );
    const [signup] = callsTo(calls, "/signup");
    expect(signup?.body).toMatchObject({ email: MAIL, password: "        " });
  });
});

test.describe("Registrati: esiti di Supabase", () => {
  test("CA-1 (parte dell'interfaccia): una richiesta con redirect_to, poi «Controlla la posta» col focus sul titolo", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    const calls = recordAuth(page);
    await reachCheckMail(page);
    const signups = callsTo(calls, "/signup");
    expect(signups).toHaveLength(1);
    expect(signups[0]?.query.get("redirect_to")).toBe(
      `${new URL(baseURL!).origin}/auth/confirm`,
    );
    expect(signups[0]?.body).toMatchObject({ email: MAIL });
    await expect(checkPosta(page)).toBeFocused();
    await expect(
      page.getByText(
        `Se è un indirizzo nuovo, ti abbiamo mandato una mail a ${MAIL}. Aprila e tocca «Conferma l'indirizzo»: entri subito in FamilyNest.`,
      ),
    ).toBeVisible();
    expectNoMagicLink(calls);
  });

  test("«Controlla la posta»: righe, nessuna riga dell'invito senza il cookie", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await reachCheckMail(page);
    for (const title of [
      "Vale un'ora",
      "Non la trovi?",
      "Hai già un account con questa mail?",
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByText("Apri il link su questo dispositivo"),
    ).toHaveCount(0);
    await expect(
      page.getByText("Registrazione", { exact: true }),
    ).toBeVisible();
  });

  test("D4: con il cookie d'invito compare la riga, e il token non è nella pagina", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await setInviteCookie(page, baseURL!, INVITE_TOKEN);
    await mockAuth(page, "/signup", { kind: "ok" });
    await reachCheckMail(page);
    await expect(
      page.getByText("Apri il link su questo dispositivo"),
    ).toBeVisible();
    await expect(
      page.getByText("Così entri subito nel Nest che ti ha invitato."),
    ).toBeVisible();
    expect(await page.content()).not.toContain(INVITE_TOKEN);
    const cookie = (await page.context().cookies()).find(
      (c) => c.name === COOKIE,
    );
    expect(cookie?.value).toBe(INVITE_TOKEN);
  });

  test("CA-9: 429 su signup, avviso informativo con role=status e senza testo tecnico", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", RATE_LIMIT);
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD_OK },
      () =>
        expect(
          statusWith(
            page,
            "Ti abbiamo appena mandato una mail. Cercala nella posta, oppure riprova tra un minuto.",
          ),
        ).toBeVisible({ timeout: 3000 }),
    );
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/429|over_|rate limit|error/i);
    await expect(mailField(page)).toHaveValue(MAIL);
  });

  test("CA-10: errore di rete con role=alert, «Riprova» rifà la stessa richiesta", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "abort-once" });
    const calls = recordAuth(page);
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD_OK },
      () =>
        expect(
          alertWith(
            page,
            "Non siamo riusciti a creare l'account. Controlla la connessione e riprova.",
          ),
        ).toBeVisible({ timeout: 3000 }),
    );
    await page.getByRole("button", { name: "Riprova" }).click();
    await expect(checkPosta(page)).toBeVisible();
    const signups = callsTo(calls, "/signup");
    expect(signups).toHaveLength(2);
    expect(signups[1]?.body).toMatchObject({
      email: MAIL,
      password: PASSWORD_OK,
    });
  });

  test("password troppo debole: errore sul campo, la password resta", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", {
      kind: "status",
      status: 422,
      body: { code: 422, error_code: "weak_password", msg: "weak" },
    });
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD_OK },
      () =>
        expect(
          page.getByText(
            "Questa password è troppo facile da indovinare: scegline una più lunga.",
          ),
        ).toBeVisible({ timeout: 3000 }),
    );
    await expect(passwordField(page, "Scegli una password")).toHaveValue(
      PASSWORD_OK,
    );
  });

  test("CA-11: «Rimanda la mail» aspetta 60 secondi, poi manda un resend e riparte", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/resend", { kind: "ok" });
    const calls = recordAuth(page);
    await page.clock.install({ time: new Date("2026-11-06T10:00:00Z") });
    await page.goto("/accesso/mail");
    await page.clock.pauseAt(new Date("2026-11-06T10:00:05Z"));
    await submitMailForm(
      page,
      { mode: "Registrati", email: MAIL, password: PASSWORD_OK },
      () => expect(checkPosta(page)).toBeVisible({ timeout: 3000 }),
    );
    await expect(resendButton(page)).toBeDisabled();
    await expect(
      page.getByText("Puoi rimandarla tra 60 secondi."),
    ).toBeVisible();
    await page.clock.runFor(59_000);
    await expect(resendButton(page)).toBeDisabled();
    await expect(
      page.getByText("Puoi rimandarla tra 1 secondo."),
    ).toBeVisible();
    await page.clock.runFor(1_000);
    await expect(resendButton(page)).toBeEnabled();
    await resendButton(page).click();
    await expect.poll(() => callsTo(calls, "/resend").length).toBe(1);
    const [resend] = callsTo(calls, "/resend");
    expect(resend?.body).toMatchObject({ type: "signup", email: MAIL });
    expect(resend?.query.get("redirect_to")).toMatch(/\/auth\/confirm$/);
    await expect(
      page.getByText("Mail rimandata: usa quella più recente."),
    ).toBeVisible();
    await expect(resendButton(page)).toBeDisabled();
    await expect(
      page.getByText("Puoi rimandarla tra 60 secondi."),
    ).toBeVisible();
  });

  test("«Rimanda la mail» con 429: avviso informativo e l'attesa riparte", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/resend", RATE_LIMIT);
    await page.clock.install({ time: new Date("2026-11-06T10:00:00Z") });
    await page.goto("/accesso/mail");
    await page.clock.pauseAt(new Date("2026-11-06T10:00:05Z"));
    await reachCheckMail(page);
    await page.clock.runFor(60_000);
    await resendButton(page).click();
    await expect(
      statusWith(
        page,
        "La mail di prima è appena partita. Puoi rimandarla tra un minuto.",
      ),
    ).toBeVisible();
    await expect(resendButton(page)).toBeDisabled();
  });

  test("«Rimanda la mail» senza rete: avviso con «Riprova»", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/resend", { kind: "abort-once" });
    await page.clock.install({ time: new Date("2026-11-06T10:00:00Z") });
    await page.goto("/accesso/mail");
    await page.clock.pauseAt(new Date("2026-11-06T10:00:05Z"));
    await reachCheckMail(page);
    await page.clock.runFor(60_000);
    await resendButton(page).click();
    await expect(
      alertWith(
        page,
        "Non siamo riusciti a mandare la mail. Controlla la connessione e riprova.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Riprova" }).click();
    await expect(
      page.getByText("Mail rimandata: usa quella più recente."),
    ).toBeVisible();
  });

  test("CA-12: ricaricando il modulo è vuoto e nulla è nell'indirizzo né negli archivi", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await reachCheckMail(page);
    expect(page.url()).not.toContain("marco");
    await page.reload();
    await expect(h1(page)).toHaveText("Entra con la mail");
    await expect(mailField(page)).toHaveValue("");
    await expect(passwordField(page)).toHaveValue("");
    const stored = await page.evaluate(() =>
      JSON.stringify([
        Object.entries(localStorage),
        Object.entries(sessionStorage),
      ]),
    );
    expect(stored).not.toContain("marco@esempio");
    expect(stored).not.toContain(PASSWORD_OK);
  });

  test("«Usa un'altra mail» e «Entra con la password» riportano la mail nel campo", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await reachCheckMail(page);
    await page.getByRole("button", { name: "Usa un'altra mail" }).click();
    await expect(h1(page)).toHaveText("Crea il tuo account");
    await expect(mailField(page)).toHaveValue(MAIL);
    await expect(passwordField(page, "Scegli una password")).toHaveValue("");
    await submitButton(page).click();
    await expect(
      page.getByText("Scegli una password per registrarti."),
    ).toBeVisible();
    await mailField(page).fill(MAIL);
    await passwordField(page, "Scegli una password").fill(PASSWORD_OK);
    await submitButton(page).click();
    await expect(checkPosta(page)).toBeVisible();
    await page.getByRole("button", { name: "Entra con la password" }).click();
    await expect(h1(page)).toHaveText("Entra con la mail");
    await expect(mailField(page)).toHaveValue(MAIL);
  });
});

test.describe("Entra: esiti di Supabase", () => {
  async function submitLogin(page: Page, done: () => Promise<void>) {
    await page.goto("/accesso/mail");
    await submitMailForm(
      page,
      { mode: "Entra", email: MAIL, password: "una-password" },
      done,
    );
  }

  test("mail e password vuote: errori dei campi, nessuna richiesta", async ({
    page,
  }) => {
    needSupabase();
    const calls = recordAuth(page);
    await page.goto("/accesso/mail");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(page.getByText("Scrivi la tua mail per entrare.")).toBeVisible({
          timeout: 1000,
        }),
    );
    await expect(
      page.getByText("Scrivi la password per entrare."),
    ).toBeVisible();
    await expect(mailField(page)).toBeFocused();
    expect(calls).toEqual([]);
  });

  test("CA-17: 429 su token, avviso informativo", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/token", RATE_LIMIT);
    await submitLogin(page, () =>
      expect(
        statusWith(
          page,
          "Troppi tentativi di fila. Aspetta qualche minuto e riprova.",
        ),
      ).toBeVisible({ timeout: 3000 }),
    );
  });

  test("errore di rete: avviso con «Riprova» che rifà la richiesta", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", { kind: "abort-once", then: {} });
    const calls = recordAuth(page);
    await submitLogin(page, () =>
      expect(
        alertWith(
          page,
          "Non siamo riusciti a farti entrare. Controlla la connessione e riprova.",
        ),
      ).toBeVisible({ timeout: 3000 }),
    );
    await page.getByRole("button", { name: "Riprova" }).click();
    await expect.poll(() => callsTo(calls, "/token").length).toBe(2);
    expect(callsTo(calls, "/token")[1]?.body).toMatchObject({
      email: MAIL,
      password: "una-password",
    });
  });

  test("password o mail sbagliate: un solo avviso, password vuota col focus, la mail resta", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/token", {
      kind: "status",
      status: 400,
      body: {
        code: 400,
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      },
    });
    await submitLogin(page, () =>
      expect(
        alertWith(
          page,
          "La mail e la password non corrispondono. Se finora entravi con il link nella mail, la password non ce l'hai ancora: scegline una.",
        ),
      ).toBeVisible({ timeout: 3000 }),
    );
    await expect(passwordField(page)).toHaveValue("");
    await expect(passwordField(page)).toBeFocused();
    await expect(mailField(page)).toHaveValue(MAIL);
    // No field turns red: the notice is the only message.
    await expect(mailField(page)).not.toHaveAttribute("aria-invalid", "true");
    await page.getByRole("link", { name: "Scegli una password" }).click();
    await expect(page).toHaveURL(/\/accesso\/password-dimenticata$/);
  });

  test("CA-16 (interfaccia): mail non confermata, «Rimanda la mail» manda un resend e apre «Controlla la posta»", async ({
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
    await mockAuth(page, "/resend", { kind: "ok" });
    const calls = recordAuth(page);
    await submitLogin(page, () =>
      expect(
        statusWith(
          page,
          "Questa mail non è ancora confermata. Apri la mail «Conferma il tuo indirizzo» che ti abbiamo mandato, oppure fattene mandare un'altra.",
        ),
      ).toBeVisible({ timeout: 3000 }),
    );
    await page.getByRole("button", { name: "Rimanda la mail" }).click();
    await expect(checkPosta(page)).toBeVisible();
    const [resend] = callsTo(calls, "/resend");
    expect(resend?.body).toMatchObject({ type: "signup", email: MAIL });
    // The wait has already started.
    await expect(resendButton(page)).toBeDisabled();
    await expect(
      page.getByText("Accesso con la mail", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("/accesso/password-dimenticata", () => {
  async function submitForgot(
    page: Page,
    address: string,
    done: () => Promise<void>,
  ) {
    await page.goto("/accesso/password-dimenticata");
    await untilHydrated(async () => {
      await forgotMail(page).fill(address, { timeout: 2000 });
      await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
    }, done);
  }
  const sentTitle = (page: Page) =>
    page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" });

  test("testi e campo: un solo modulo, mail con autocomplete username, nessun name", async ({
    page,
  }) => {
    await page.goto("/accesso/password-dimenticata");
    await expect(h1(page)).toHaveText("Hai dimenticato la password?");
    await expect(
      page.getByText(
        "Scrivi la mail del tuo account: ti mandiamo un link per sceglierne una nuova.",
      ),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.locator("form")).toHaveAttribute(
      "action",
      "/accesso/password-dimenticata/invio",
    );
    await expect(forgotMail(page)).toHaveAttribute("autocomplete", "username");
    await expect(forgotMail(page)).not.toHaveAttribute("name", /.*/);
    await expect(submitButton(page)).toHaveText("Mandami il link");
    await expect(page.locator("input[type=password]")).toHaveCount(0);
  });

  test("mail vuota o non valida: errore, nessuna richiesta", async ({
    page,
  }) => {
    needSupabase();
    const calls = recordAuth(page);
    await page.goto("/accesso/password-dimenticata");
    await untilHydrated(
      () => submitButton(page).click({ timeout: 2000, noWaitAfter: true }),
      () =>
        expect(
          page.getByText("Scrivi la tua mail per ricevere il link."),
        ).toBeVisible({ timeout: 1000 }),
    );
    await expect(forgotMail(page)).toBeFocused();
    await forgotMail(page).fill("nome@");
    await submitButton(page).click();
    await expect(
      page.getByText(
        "Controlla la mail: dovrebbe essere come nome@esempio.it.",
      ),
    ).toBeVisible();
    expect(calls).toEqual([]);
  });

  test("CA-21 (interfaccia): una richiesta a recover con redirect_to, poi «Ti abbiamo scritto»", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "ok" });
    const calls = recordAuth(page);
    await submitForgot(page, `  ${MAIL}  `, () =>
      expect(sentTitle(page)).toBeVisible({ timeout: 3000 }),
    );
    const recovers = callsTo(calls, "/recover");
    expect(recovers).toHaveLength(1);
    expect(recovers[0]?.query.get("redirect_to")).toBe(
      `${new URL(baseURL!).origin}/auth/confirm`,
    );
    expect(recovers[0]?.body).toMatchObject({ email: MAIL });
    await expect(sentTitle(page)).toBeFocused();
    await expect(
      page.getByText(
        `Se ${MAIL} è la mail di un account FamilyNest, ti è arrivato un link. Aprilo e tocca «Scegli una nuova password».`,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Password dimenticata", { exact: true }),
    ).toBeVisible();
    expectNoMagicLink(calls);
  });

  test("CA-22: con 429 si vede lo stesso «Ti abbiamo scritto»", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/recover", RATE_LIMIT);
    await submitForgot(page, MAIL, () =>
      expect(sentTitle(page)).toBeVisible({ timeout: 3000 }),
    );
    await expect(
      page.getByText(
        `Se ${MAIL} è la mail di un account FamilyNest, ti è arrivato un link. Aprilo e tocca «Scegli una nuova password».`,
      ),
    ).toBeVisible();
    await expect(page.getByText(/troppi|limite|429/i)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(
      0,
    );
  });

  test("errore di rete: avviso con «Riprova»", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "abort-once" });
    await submitForgot(page, MAIL, () =>
      expect(
        alertWith(
          page,
          "Non siamo riusciti a mandare il link. Controlla la connessione e riprova.",
        ),
      ).toBeVisible({ timeout: 3000 }),
    );
    await page.getByRole("button", { name: "Riprova" }).click();
    await expect(sentTitle(page)).toBeVisible();
  });

  test("CA-23: il rinvio aspetta 60 secondi, poi chiama recover e mostra il toast", async ({
    page,
  }) => {
    needSupabase();
    await mockAuth(page, "/recover", RATE_LIMIT);
    const calls = recordAuth(page);
    await page.clock.install({ time: new Date("2026-11-06T10:00:00Z") });
    await page.goto("/accesso/password-dimenticata");
    await page.clock.pauseAt(new Date("2026-11-06T10:00:05Z"));
    await untilHydrated(
      async () => {
        await forgotMail(page).fill(MAIL, { timeout: 2000 });
        await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
      },
      () => expect(sentTitle(page)).toBeVisible({ timeout: 3000 }),
    );
    const again = page.getByRole("button", { name: "Mandami un altro link" });
    await expect(again).toBeDisabled();
    await expect(
      page.getByText("Puoi chiederne un altro tra 60 secondi."),
    ).toBeVisible();
    await page.clock.runFor(59_000);
    await expect(again).toBeDisabled();
    await page.clock.runFor(1_000);
    await expect(again).toBeEnabled();
    await again.click();
    await expect.poll(() => callsTo(calls, "/recover").length).toBe(2);
    // The 429 is shown as a success.
    await expect(
      page.getByText("Nuovo link mandato: usa quello più recente."),
    ).toBeVisible();
    await expect(again).toBeDisabled();
  });

  test("«Usa un'altra mail» riporta la mail nel campo", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/recover", { kind: "ok" });
    await submitForgot(page, MAIL, () =>
      expect(sentTitle(page)).toBeVisible({ timeout: 3000 }),
    );
    await page.getByRole("button", { name: "Usa un'altra mail" }).click();
    await expect(h1(page)).toHaveText("Hai dimenticato la password?");
    await expect(forgotMail(page)).toHaveValue(MAIL);
  });
});

test.describe("CA-18: senza JavaScript i moduli non mandano nulla al sito", () => {
  const forms = [
    {
      page: "/accesso/mail",
      action: "/accesso/mail/invio",
      fill: async (page: Page) => {
        await mailField(page).fill(MAIL);
        await passwordField(page).fill(PASSWORD_OK);
      },
    },
    {
      page: "/accesso/password-dimenticata",
      action: "/accesso/password-dimenticata/invio",
      fill: async (page: Page) => {
        await mailField(page).fill(MAIL);
      },
    },
  ];
  for (const form of forms) {
    test(`${form.page}: POST a ${form.action}, risposta 303 alla stessa pagina`, async ({
      page,
    }) => {
      // The page is served but never hydrated: the form submits natively.
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
      await page.goto(form.page);
      await form.fill(page);
      await submitButton(page).click();
      await page.waitForLoadState("load");
      await expect.poll(() => answers.length).toBe(1);
      const [answer] = answers;
      expect(new URL(answer!.url).pathname).toBe(form.action);
      expect(answer!.status).toBe(303);
      expect(new URL(answer!.location, page.url()).pathname).toBe(form.page);
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toBe("");
      const everything = `${page.url()}\n${answer!.location}\n${posts[0]?.url}`;
      expect(decodeURIComponent(everything)).not.toContain("marco");
      expect(decodeURIComponent(everything)).not.toContain(PASSWORD_OK);
      expect(new URL(page.url()).search).toBe("");
      await expect(h1(page)).toBeVisible();
    });
  }

  for (const route of [
    "/accesso/mail/invio",
    "/accesso/password-dimenticata/invio",
    "/accesso/nuova-password/invio",
  ]) {
    test(`${route}: POST diretto, 303 senza leggere il corpo; GET rifiutata`, async ({
      request,
    }) => {
      const response = await request.post(route, {
        form: { email: MAIL, password: PASSWORD_OK },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      const location = response.headers()["location"] ?? "";
      expect(new URL(location, "http://localhost").pathname).toBe(
        route.replace("/invio", ""),
      );
      expect(location).not.toContain("marco");
      expect(location).not.toContain(PASSWORD_OK);
      expect(await response.text()).not.toContain(MAIL);
      expect((await request.get(route, { maxRedirects: 0 })).status()).toBe(
        405,
      );
    });
  }
});

test.describe("/accesso/link-scaduto", () => {
  test("tipo=conferma e tipo assente o sconosciuto: testo e azione di conferma", async ({
    page,
  }) => {
    for (const query of [
      "?tipo=conferma",
      "",
      "?tipo=altro",
      "?tipo=magiclink",
    ]) {
      await page.goto(`/accesso/link-scaduto${query}`);
      await expect(
        page.locator("p.citazione").filter({ visible: true }),
      ).toHaveText(
        "I link nelle nostre mail valgono un'ora e si usano una volta sola. Se avevi già confermato l'indirizzo, entra con mail e password.",
      );
      await expect(
        page.getByRole("link", { name: "Entra con la mail" }),
      ).toHaveAttribute("href", "/accesso/mail");
    }
  });

  test("tipo=password: testo e azione per chiedere un nuovo link", async ({
    page,
  }) => {
    await page.goto("/accesso/link-scaduto?tipo=password");
    await expect(
      page.locator("p.citazione").filter({ visible: true }),
    ).toHaveText(
      "Il link per scegliere una nuova password vale un'ora e si usa una volta sola. Chiedine uno nuovo.",
    );
    await expect(
      page.getByRole("link", { name: "Mandami un nuovo link" }),
    ).toHaveAttribute("href", "/accesso/password-dimenticata");
    await expect(
      page.getByRole("link", { name: "Torna all'accesso" }),
    ).toHaveAttribute("href", "/accesso");
  });
});

test.describe("nessun link magico", () => {
  test("CA-35: il modulo non chiama mai otp né magiclink", async ({ page }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    await mockAuth(page, "/token", { kind: "abort" });
    const calls = recordAuth(page);
    await reachCheckMail(page);
    await page.getByRole("button", { name: "Entra con la password" }).click();
    await submitMailForm(
      page,
      { mode: "Entra", email: MAIL, password: "una-password" },
      () => expect(alertWith(page, /Non siamo riusciti/)).toBeVisible(),
    );
    expectNoMagicLink(calls);
  });

  test("CA-37: nulla va al nostro sito né alla console", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await mockAuth(page, "/signup", { kind: "ok" });
    const origin = new URL(baseURL!).origin;
    const own: string[] = [];
    const logs: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(origin)) {
        own.push(request.url(), request.postData() ?? "");
      }
    });
    page.on("framenavigated", (frame) => own.push(frame.url()));
    page.on("console", (message) => logs.push(message.text()));
    await reachCheckMail(page);
    const joined = [...own, ...logs].join("\n");
    for (const secret of [MAIL, encodeURIComponent(MAIL), PASSWORD_OK]) {
      expect(joined).not.toContain(secret);
    }
    expect(
      await page.evaluate(() => document.documentElement.outerHTML),
    ).not.toContain(PASSWORD_OK);
  });
});
