import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { safeNextPath } from "../../src/lib/auth/safe-next";
import {
  skipReason,
  usersConfigured,
  type TestUserKey,
} from "../fixtures/auth";

// Login and session (#11). [CI] tests intercept the browser requests to
// Supabase (no real provider, no real mail). [CI-utenti] tests need the test
// users (#55) and the secret key: they are skipped when those are missing.
// [Manuale] criteria (CA-39 ... CA-43) are listed in the PR.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const GOOGLE_ERROR =
  "Accesso con Google non riuscito. Controlla la connessione e riprova.";
const APPLE_ERROR =
  "Accesso con Apple non riuscito. Controlla la connessione e riprova.";
const MAIL = "marco@example.com";

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

/** The error notice (the Next.js route announcer is also a role=alert). */
function alertWith(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

/** Keeps clicking until the page is hydrated and `done` is true. */
async function clickUntil(target: Locator, done: () => Promise<void> | void) {
  await expect(async () => {
    await target.click({ timeout: 2000, noWaitAfter: true });
    await done();
  }).toPass({ timeout: 15_000 });
}

/**
 * Visible buttons of the page, read straight from the DOM. While the browser
 * is being sent to the provider, locators wait for that navigation, so the
 * loading state is read with page.evaluate.
 */
async function visibleButtons(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>("main button")]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({
        text: (b.textContent ?? "").trim(),
        busy: b.getAttribute("aria-busy"),
        disabled: b.disabled,
      })),
  );
}

async function clickVisibleButton(page: Page, text: string) {
  await page.evaluate((label) => {
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>("main button"),
    ]
      .filter((b) => b.offsetParent !== null)
      .find((b) => (b.textContent ?? "").trim() === label);
    button?.click();
  }, text);
}

/** Intercepts the Supabase authorize request; `hold` never answers. */
async function interceptAuthorize(page: Page, hold = false) {
  const urls: string[] = [];
  const held: Route[] = [];
  await page.route(`${supabaseUrl}/auth/v1/authorize*`, async (route) => {
    urls.push(route.request().url());
    if (hold) {
      // 204: the browser stays on the page, so the loading state stays too
      // (a document navigation that never answers would block the locators).
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>provider</body></html>",
      });
    }
  });
  return { urls, release: () => held.forEach((r) => void r.abort()) };
}

type OtpMode = "ok" | "rate" | "hold" | "abort-then-ok";

async function interceptOtp(page: Page, mode: OtpMode) {
  const bodies: Array<Record<string, unknown>> = [];
  const held: Route[] = [];
  let calls = 0;
  await page.route(`${supabaseUrl}/auth/v1/otp*`, async (route) => {
    calls += 1;
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    if (mode === "hold") {
      held.push(route);
    } else if (mode === "rate") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          code: 429,
          error_code: "over_email_send_rate_limit",
          msg: "rate limit",
        }),
      });
    } else if (mode === "abort-then-ok" && calls === 1) {
      await route.abort("failed");
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    }
  });
  return { bodies, release: () => held.forEach((r) => void r.abort()) };
}

function mailInput(page: Page) {
  return page.getByRole("textbox", { name: "La tua mail" });
}

function sendButton(page: Page) {
  return page.getByRole("button", { name: "Mandami il link" });
}

/** Fills the address and submits until the page is hydrated and `done` holds. */
async function submitMail(
  page: Page,
  value: string,
  done: () => Promise<void> | void,
) {
  await expect(async () => {
    await mailInput(page).fill(value, { timeout: 2000 });
    await sendButton(page).click({ timeout: 2000, noWaitAfter: true });
    await done();
  }).toPass({ timeout: 15_000 });
}

test.describe("pagina /accesso", () => {
  test("CA-1: 390 px, un solo h1 e i controlli", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "solo mobile");
    await page.goto("/accesso");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /La casa,\s*in un posto solo\./,
    );
    await expectAccessControls(page);
  });

  test("CA-2: 1280 px, un solo h1 e i controlli", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "solo desktop");
    await page.goto("/accesso");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Entra in FamilyNest" }),
    ).toBeVisible();
    await expectAccessControls(page);
  });

  test("CA-3: nessuna password nelle tre pagine", async ({ page }) => {
    for (const route of [
      "/accesso",
      "/accesso/mail",
      "/accesso/link-scaduto",
    ]) {
      await page.goto(route);
      await expect(page.locator("input[type=password]")).toHaveCount(0);
      // The designer's intro of the mail page says "senza password" (it tells
      // that no password is needed): it is the only allowed occurrence.
      const text = (await page.locator("main").innerText())
        .toLowerCase()
        .replaceAll("senza password", "");
      expect(text).not.toContain("password");
    }
  });

  test("CA-4: nessun link «Ho un invito»", async ({ page }) => {
    await page.goto("/accesso");
    await expect(page.getByText("Ho un invito")).toHaveCount(0);
  });

  test("CA-5: senza sessione le pagine dell'app portano a /accesso", async ({
    page,
  }) => {
    for (const route of [
      "/",
      "/oggi",
      "/calendario",
      "/profilo",
      "/onboarding",
    ]) {
      await page.goto(route);
      // The redirect of a streamed page may arrive after the load event.
      await expect(page).toHaveURL(/\/accesso$/);
      expect(new URL(page.url()).search).toBe("");
    }
  });
});

async function expectAccessControls(page: Page) {
  await expect(
    page.getByRole("button", { name: "Continua con Apple" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continua con Google" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Usa la mail" })).toBeVisible();
  await expect(
    page
      .getByText(
        "Continuando accetti i Termini d'uso e l'Informativa sulla privacy.",
      )
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Termini d'uso" }),
  ).toHaveAttribute("href", "/termini");
  await expect(
    page.getByRole("link", { name: "Informativa sulla privacy" }),
  ).toHaveAttribute("href", "/privacy");
}

test.describe("Apple e Google", () => {
  for (const [provider, label, ca] of [
    ["google", "Google", "CA-6"],
    ["apple", "Apple", "CA-7"],
  ] as const) {
    test(`${ca}: «Continua con ${label}» avvia l'accesso`, async ({
      page,
      baseURL,
    }) => {
      needSupabase();
      const authorize = await interceptAuthorize(page);
      await page.goto("/accesso");
      await clickUntil(
        page.getByRole("button", { name: `Continua con ${label}` }),
        () =>
          expect
            .poll(() => authorize.urls.length, { timeout: 2000 })
            .toBeGreaterThan(0),
      );
      const url = new URL(authorize.urls[0]!);
      expect(url.searchParams.get("provider")).toBe(provider);
      expect(url.searchParams.get("redirect_to")).toMatch(
        new RegExp(
          `^${new URL(baseURL!).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/auth/callback`,
        ),
      );
    });
  }

  test("CA-8: caricamento, altro bottone disabilitato, un solo avvio", async ({
    page,
  }) => {
    needSupabase();
    const authorize = await interceptAuthorize(page, true);
    await page.goto("/accesso");
    await clickUntil(
      page.getByRole("button", { name: "Continua con Google" }),
      () => expect.poll(() => authorize.urls.length, { timeout: 2000 }).toBe(1),
    );
    await expect
      .poll(() => visibleButtons(page))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: "Accesso con Google in corso",
            busy: "true",
          }),
          expect.objectContaining({
            text: "Continua con Apple",
            disabled: true,
          }),
        ]),
      );
    await clickVisibleButton(page, "Accesso con Google in corso");
    await page.waitForTimeout(300);
    expect(authorize.urls.length).toBe(1);
    authorize.release();
  });

  test("CA-9: errore del fornitore riporta a /accesso con l'avviso", async ({
    page,
  }) => {
    await page.goto("/auth/callback?provider=google&error=server_error");
    await expect(page).toHaveURL(/\/accesso\?errore=google$/);
    await expect(alertWith(page, GOOGLE_ERROR)).toBeVisible();
    await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("accesso annullato presso il fornitore: testo apposito", async ({
    page,
  }) => {
    await page.goto("/auth/callback?provider=google&error=access_denied");
    await expect(page).toHaveURL(/\/accesso\?errore=google&annullato=1$/);
    await expect(
      alertWith(
        page,
        "Accesso con Google annullato. Riprova o scegli un altro modo per entrare.",
      ),
    ).toBeVisible();
    await page.goto("/auth/callback?provider=apple&error=access_denied");
    await expect(
      alertWith(
        page,
        "Accesso con Apple annullato. Riprova o scegli un altro modo per entrare.",
      ),
    ).toBeVisible();
  });

  test("CA-10: codice non valido", async ({ page }) => {
    await page.goto("/auth/callback?provider=apple&code=codice-non-valido");
    await expect(page).toHaveURL(/\/accesso\?errore=apple$/);
    await expect(alertWith(page, APPLE_ERROR)).toBeVisible();
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-11: callback senza parametri", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/accesso\?errore=accesso$/);
    await expect(
      alertWith(
        page,
        "Accesso non riuscito. Controlla la connessione e riprova.",
      ),
    ).toBeVisible();
  });

  test("valori di errore sconosciuti si ignorano", async ({ page }) => {
    await page.goto("/accesso?errore=pippo");
    await expect(
      page.getByRole("alert").filter({ hasText: "Accesso" }),
    ).toHaveCount(0);
  });

  test("CA-12: «Riprova» rilancia lo stesso fornitore", async ({ page }) => {
    needSupabase();
    const authorize = await interceptAuthorize(page, true);
    await page.goto("/accesso?errore=google");
    await expect(alertWith(page, GOOGLE_ERROR)).toBeVisible();
    await clickUntil(page.getByRole("button", { name: "Riprova" }), () =>
      expect.poll(() => authorize.urls.length, { timeout: 2000 }).toBe(1),
    );
    expect(new URL(authorize.urls[0]!).searchParams.get("provider")).toBe(
      "google",
    );
    await expect
      .poll(async () =>
        (await visibleButtons(page)).some((b) => b.text === "Riprova"),
      )
      .toBe(false);
    authorize.release();
  });

  test("CA-13: senza rete l'accesso non parte", async ({ page, context }) => {
    await page.goto("/accesso");
    const apple = page.getByRole("button", { name: "Continua con Apple" });
    await expect(apple).toBeEnabled();
    await context.setOffline(true);
    await clickUntil(apple, () =>
      expect(alertWith(page, APPLE_ERROR)).toBeVisible({ timeout: 1000 }),
    );
    await expect(page).toHaveURL(/\/accesso$/);
    await expect(apple).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Continua con Google" }),
    ).toBeEnabled();
  });
});

test.describe("link via mail: invio", () => {
  test("CA-14: «Usa la mail» porta al campo", async ({ page }) => {
    await page.goto("/accesso");
    await page.getByRole("link", { name: "Usa la mail" }).click();
    await expect(page).toHaveURL(/\/accesso\/mail$/);
    await expect(mailInput(page)).toBeVisible();
    await expect(sendButton(page)).toBeVisible();
  });

  test("CA-15: mail vuota", async ({ page }) => {
    needSupabase();
    const otp = await interceptOtp(page, "ok");
    await page.goto("/accesso/mail");
    await clickUntil(sendButton(page), () =>
      expect(
        page
          .getByText("Scrivi la tua mail per ricevere il link.")
          .filter({ visible: true }),
      ).toBeVisible({ timeout: 1000 }),
    );
    await expect(mailInput(page)).toHaveAttribute("aria-invalid", "true");
    expect(otp.bodies).toHaveLength(0);
  });

  test("CA-16: mail non valida", async ({ page }) => {
    needSupabase();
    const otp = await interceptOtp(page, "ok");
    await page.goto("/accesso/mail");
    await submitMail(page, "marco@", () =>
      expect(
        page
          .getByText("Controlla la mail: dovrebbe essere come nome@esempio.it.")
          .filter({ visible: true }),
      ).toBeVisible({ timeout: 1000 }),
    );
    expect(otp.bodies).toHaveLength(0);
  });

  test("CA-17: invio riuscito", async ({ page }) => {
    needSupabase();
    const otp = await interceptOtp(page, "ok");
    await page.goto("/accesso/mail");
    await submitMail(page, `  ${MAIL}  `, () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
      ).toBeVisible({ timeout: 2000 }),
    );
    expect(otp.bodies).toHaveLength(1);
    expect(otp.bodies[0]).toMatchObject({ email: MAIL, create_user: true });
    await expect(
      page.locator("main").getByText(MAIL).filter({ visible: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      "/accesso/mail",
    );
  });

  test("CA-18: troppe richieste", async ({ page }) => {
    needSupabase();
    await interceptOtp(page, "rate");
    await page.goto("/accesso/mail");
    await submitMail(page, MAIL, () =>
      expect(
        page
          .getByText(
            "Hai appena chiesto un link per questa mail. Cercalo nella posta, oppure chiedine un altro tra un minuto.",
          )
          .filter({ visible: true }),
      ).toBeVisible({ timeout: 2000 }),
    );
    await expect(mailInput(page)).toHaveValue(MAIL);
  });

  test("CA-19: errore di rete, poi «Riprova»", async ({ page }) => {
    needSupabase();
    await interceptOtp(page, "abort-then-ok");
    await page.goto("/accesso/mail");
    await submitMail(page, MAIL, () =>
      expect(
        alertWith(
          page,
          "Non siamo riusciti a mandare il link. Controlla la connessione e riprova.",
        ),
      ).toBeVisible({ timeout: 2000 }),
    );
    await expect(mailInput(page)).toHaveValue(MAIL);
    await page.getByRole("button", { name: "Riprova" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
    ).toBeVisible();
  });

  test("CA-20: un solo invio mentre si aspetta", async ({ page }) => {
    needSupabase();
    const otp = await interceptOtp(page, "hold");
    await page.goto("/accesso/mail");
    await submitMail(page, MAIL, () =>
      expect.poll(() => otp.bodies.length, { timeout: 2000 }).toBe(1),
    );
    const busy = page.getByRole("button", { name: "Invio del link in corso" });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    // A second tap on the busy button must not send a second request.
    await clickVisibleButton(page, "Invio del link in corso");
    await page.waitForTimeout(300);
    expect(otp.bodies).toHaveLength(1);
  });

  test("CA-21: «Mandami un altro link» si riattiva dopo 60 secondi", async ({
    page,
  }) => {
    needSupabase();
    const otp = await interceptOtp(page, "ok");
    await page.clock.install({ time: new Date("2026-10-23T10:00:00Z") });
    await page.goto("/accesso/mail");
    await page.clock.pauseAt(new Date("2026-10-23T10:00:05Z"));
    await submitMail(page, MAIL, () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
      ).toBeVisible({ timeout: 2000 }),
    );
    const again = page.getByRole("button", { name: "Mandami un altro link" });
    await expect(again).toBeDisabled();
    await page.clock.runFor(59_000);
    await expect(again).toBeDisabled();
    await page.clock.runFor(1_000);
    await expect(again).toBeEnabled();
    await again.click();
    await expect.poll(() => otp.bodies.length).toBe(2);
    expect(otp.bodies[1]).toMatchObject({ email: MAIL });
  });

  test("CA-22: «Usa un'altra mail» riporta la mail nel campo", async ({
    page,
  }) => {
    needSupabase();
    await interceptOtp(page, "ok");
    await page.goto("/accesso/mail");
    await submitMail(page, MAIL, () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
      ).toBeVisible({ timeout: 2000 }),
    );
    await page.getByRole("button", { name: "Usa un'altra mail" }).click();
    await expect(mailInput(page)).toHaveValue(MAIL);
  });

  test("CA-23: la mail non compare in indirizzi né richieste all'app", async ({
    page,
    baseURL,
  }) => {
    needSupabase();
    await interceptOtp(page, "ok");
    const origin = new URL(baseURL!).origin;
    const seen: string[] = [];
    page.on("framenavigated", (frame) => seen.push(frame.url()));
    page.on("request", (request) => {
      if (request.url().startsWith(origin)) {
        seen.push(request.url(), request.postData() ?? "");
      }
    });
    await page.goto("/accesso/mail");
    await submitMail(page, MAIL, () =>
      expect(
        page.getByRole("heading", { level: 1, name: "Controlla la posta" }),
      ).toBeVisible({ timeout: 2000 }),
    );
    const joined = seen.join("\n");
    expect(joined).not.toContain(MAIL);
    expect(joined).not.toContain(encodeURIComponent(MAIL));
    expect(joined.toLowerCase()).not.toContain("marco%40");
  });
});

test.describe("link via mail: ritorno", () => {
  for (const url of [
    "/auth/confirm?token_hash=non-valido&type=magiclink",
    "/auth/confirm",
    "/auth/confirm?token_hash=non-valido&type=recovery",
  ]) {
    test(`CA-27: ${url} porta a /accesso/link-scaduto`, async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveURL(/\/accesso\/link-scaduto$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await page.goto("/oggi");
      await expect(page).toHaveURL(/\/accesso$/);
    });
  }

  test("CA-28: link scaduto, le due uscite", async ({ page }) => {
    await page.goto("/accesso/link-scaduto");
    await page.getByRole("link", { name: "Mandami un nuovo link" }).click();
    await expect(page).toHaveURL(/\/accesso\/mail$/);
    await page.goto("/accesso/link-scaduto");
    await page.getByRole("link", { name: "Torna all'accesso" }).click();
    await expect(page).toHaveURL(/\/accesso$/);
  });
});

test.describe("uscita e termini", () => {
  test("CA-35 (parte senza utenti): GET /auth/signout risponde 405", async ({
    request,
  }) => {
    const response = await request.get("/auth/signout");
    expect(response.status()).toBe(405);
  });

  test("POST /auth/signout senza sessione porta a /accesso", async ({
    request,
  }) => {
    const response = await request.post("/auth/signout", { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(new URL(response.headers()["location"]!).pathname).toBe("/accesso");
  });

  for (const [route, h1] of [
    ["/termini", "Termini d'uso"],
    ["/privacy", "Informativa sulla privacy"],
  ] as const) {
    test(`CA-38: ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: h1 }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Torna all'accesso" }),
      ).toHaveAttribute("href", "/accesso");
      await expect(page).toHaveTitle(`FamilyNest · ${h1}`);
    });
  }
});

test.describe("invio prima dell'idratazione", () => {
  test("un invio nativo non mette la mail nell'indirizzo", async ({ page }) => {
    // The page is served but never hydrated (scripts blocked), as when a
    // person taps before the scripts have loaded: the form submits natively.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/accesso/mail");
    await mailInput(page).fill(MAIL);
    await sendButton(page).click();
    await page.waitForTimeout(800);
    expect(decodeURIComponent(page.url())).not.toContain("marco");
    expect(page.url()).not.toContain("@");
  });
});

test.describe("parametro next (funzione pura)", () => {
  test("accetta solo percorsi interni sicuri", () => {
    expect(safeNextPath("/calendario")).toBe("/calendario");
    expect(safeNextPath("/casa/spesa?x=1")).toBe("/casa/spesa?x=1");
    for (const bad of [
      null,
      "",
      "//esempio.invalid",
      "https://esempio.invalid",
      "/\\esempio.invalid",
      "/a\\b",
      "/auth/signout",
      "/.//esempio.invalid",
      "/./accesso",
      "/a/../auth/signout",
      "/a/../../accesso/mail",
      "/%2e%2e/auth/signout",
      "/a/%2e%2e/accesso",
      "/accesso",
      "/accesso/mail",
      "calendario",
      "/a\nb",
      `/${"a".repeat(200)}`,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// [CI-utenti]
// ---------------------------------------------------------------------------

function email(user: TestUserKey) {
  return process.env[`TEST_USER_${user}_EMAIL`] ?? "";
}

function needUsers(...users: TestUserKey[]) {
  test.skip(!usersConfigured(...users), skipReason(...users));
  test.skip(!secretKey, "SUPABASE_SECRET_KEY non impostata");
}

/** A valid link, generated with the admin API: no mail is sent. */
async function magicLink(user: TestUserKey, next?: string) {
  const admin = createClient(supabaseUrl as string, secretKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email(user),
  });
  expect(error).toBeNull();
  const hash = data.properties!.hashed_token;
  return `/auth/confirm?token_hash=${hash}&type=magiclink${
    next ? `&next=${encodeURIComponent(next)}` : ""
  }`;
}

async function enter(page: Page, user: TestUserKey, next?: string) {
  await page.goto(await magicLink(user, next));
}

async function cookieNames(context: BrowserContext) {
  return (await context.cookies()).map((c) => c.name);
}

const NEST_A = "Apri Casa D'Angelo";

test.describe("[CI-utenti] ritorno e sessione", () => {
  test("CA-24: il link di A porta a /oggi", async ({ page }) => {
    needUsers("A");
    await enter(page, "A");
    await expect(page).toHaveURL(/\/oggi$/);
    expect(page.url()).not.toContain("token_hash");
    await expect(
      page
        .getByRole("button", { name: new RegExp(NEST_A) })
        .or(page.getByRole("link", { name: new RegExp(NEST_A) }))
        .first(),
    ).toBeVisible();
  });

  test("CA-25: il link di C porta a /onboarding", async ({ page }) => {
    needUsers("C");
    await enter(page, "C");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("CA-26: un link già usato porta a /accesso/link-scaduto", async ({
    page,
    browser,
  }) => {
    needUsers("A");
    const link = await magicLink("A");
    await page.goto(link);
    await expect(page).toHaveURL(/\/oggi$/);
    const other = await browser.newContext();
    const second = await other.newPage();
    await second.goto(new URL(link, page.url()).toString());
    await expect(second).toHaveURL(/\/accesso\/link-scaduto$/);
    await second.goto(new URL("/oggi", page.url()).toString());
    await expect(second).toHaveURL(/\/accesso$/);
    await other.close();
  });

  test("CA-29: next valido", async ({ page }) => {
    needUsers("A");
    await enter(page, "A", "/calendario");
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("CA-30: next esterno si ignora", async ({ page, baseURL }) => {
    needUsers("A");
    for (const bad of [
      "//esempio.invalid",
      "https://esempio.invalid",
      "/\\esempio.invalid",
    ]) {
      await enter(page, "A", bad);
      await expect(page).toHaveURL(/\/oggi$/);
      expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
      await page.context().clearCookies();
    }
  });

  test("CA-31: con la sessione le pagine di accesso portano via", async ({
    page,
    baseURL,
  }) => {
    needUsers("A", "C");
    await enter(page, "A");
    for (const route of [
      "/accesso",
      "/accesso/mail",
      "/accesso/link-scaduto",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/oggi$/);
    }
    const other = await page.context().browser()!.newContext({ baseURL });
    const cPage = await other.newPage();
    await enter(cPage, "C");
    await cPage.goto("/accesso");
    await expect(cPage).toHaveURL(/\/onboarding$/);
    await other.close();
  });

  test("CA-32: la sessione sopravvive alla chiusura del browser", async ({
    page,
    browser,
    baseURL,
  }) => {
    needUsers("A");
    await enter(page, "A");
    const state = await page.context().storageState();
    const reopened = await browser.newContext({
      baseURL,
      storageState: state,
    });
    const again = await reopened.newPage();
    await again.goto("/oggi");
    await expect(again).toHaveURL(/\/oggi$/);
    await reopened.close();
  });

  test("CA-33: token scaduto, rinnovo con il cookie salvato", async ({
    page,
    context,
    baseURL,
  }) => {
    needUsers("A");
    await enter(page, "A");
    // Moves the expiry written in the session cookie into the past.
    const cookies = await context.cookies();
    const session = cookies.filter((c) =>
      /^sb-.+-auth-token(\.\d+)?$/.test(c.name),
    );
    expect(session.length).toBeGreaterThan(0);
    const joined = session
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.value)
      .join("");
    const raw = joined.startsWith("base64-")
      ? Buffer.from(joined.slice(7), "base64url").toString("utf8")
      : decodeURIComponent(joined);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed["expires_at"] = Math.floor(Date.now() / 1000) - 3600;
    const encoded =
      "base64-" + Buffer.from(JSON.stringify(parsed)).toString("base64url");
    const name = session[0]!.name.replace(/\.\d+$/, "");
    await context.clearCookies();
    await context.addCookies([
      { name, value: encoded, url: baseURL!, sameSite: "Lax" },
    ]);
    const response = await page.goto("/oggi");
    await expect(page).toHaveURL(/\/oggi$/);
    expect(response?.status()).toBe(200);
    expect(
      (await cookieNames(context)).some((n) => n.includes("auth-token")),
    ).toBe(true);
    await page.goto("/calendario");
    await expect(page).toHaveURL(/\/calendario$/);
  });
});

test.describe("[CI-utenti] uscita e isolamento", () => {
  test("CA-34: «Esci» chiude la sessione", async ({ page, context }) => {
    needUsers("A");
    await enter(page, "A");
    await page.goto("/profilo");
    await clickUntil(page.getByRole("button", { name: "Esci" }), () =>
      expect(page).toHaveURL(/\/accesso$/, { timeout: 3000 }),
    );
    expect(
      (await cookieNames(context)).filter((n) => /^sb-.+-auth-token/.test(n)),
    ).toEqual([]);
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-35: GET /auth/signout non chiude la sessione", async ({ page }) => {
    needUsers("A");
    await enter(page, "A");
    const response = await page.request.get("/auth/signout");
    expect(response.status()).toBe(405);
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-36: B dopo A nello stesso browser", async ({ page }) => {
    needUsers("A", "B");
    await enter(page, "A");
    await page.goto("/profilo");
    await clickUntil(page.getByRole("button", { name: "Esci" }), () =>
      expect(page).toHaveURL(/\/accesso$/, { timeout: 3000 }),
    );
    await enter(page, "B");
    await expect(page).toHaveURL(/\/oggi$/);
    await expect(
      page
        .getByRole("button", { name: /Apri Casa Bianchi/ })
        .or(page.getByRole("link", { name: /Apri Casa Bianchi/ }))
        .first(),
    ).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Casa D'Angelo");
    expect(text).not.toContain("Marco");
  });

  test("CA-37: B non riceve dati di A", async ({ page }) => {
    needUsers("B");
    const bodies: string[] = [];
    page.on("response", async (response) => {
      if (
        new URL(response.url()).origin !==
        new URL(page.url() || "http://x").origin
      ) {
        // Only the app's own responses are checked below.
      }
      const type = response.headers()["content-type"] ?? "";
      if (/text|json/.test(type) && response.url().includes("/oggi")) {
        bodies.push(await response.text().catch(() => ""));
      }
    });
    await enter(page, "B");
    await expect(page).toHaveURL(/\/oggi$/);
    await page.reload();
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) expect(body).not.toContain("Casa D'Angelo");
  });
});
