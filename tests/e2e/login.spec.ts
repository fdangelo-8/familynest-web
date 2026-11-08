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
import { BIANCHI, buildNest, D_ANGELO } from "../fixtures/casa";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

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

function needSupabase() {
  test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
}

/** The error notice (the Next.js route announcer is also a role=alert). */
function noticeWith(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

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
 * «Esci» on /profilo asks for a confirmation (#38): opens the dialog (clicking
 * until the page is hydrated) and confirms inside it.
 */
async function signOutFromProfile(page: Page) {
  const dialog = page.getByRole("alertdialog", {
    name: "Uscire da FamilyNest?",
  });
  await clickUntil(
    page.getByRole("main").getByRole("button", { name: "Esci", exact: true }),
    () => expect(dialog).toBeVisible({ timeout: 3000 }),
  );
  await dialog.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page).toHaveURL(/\/accesso$/);
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

/**
 * Lets a possible (unwanted) second request leave the page: waits for two
 * animation frames in the browser, with no fixed delay.
 */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0)),
        ),
      ),
  );
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

  // #327 replaces the rule of #11 ("no password anywhere", true while the mail
  // sign-in was a magic link): /accesso/mail now has the password field, and
  // exactly one (a single form in the DOM). /accesso has none and does not
  // speak of passwords; the expired-link screen speaks of it but has no field.
  test("CA-3: il campo password è solo in /accesso/mail, e uno solo", async ({
    page,
  }) => {
    await page.goto("/accesso");
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    const text = (await page.locator("main").innerText()).toLowerCase();
    expect(text).not.toContain("password");
    await page.goto("/accesso/link-scaduto");
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await page.goto("/accesso/mail");
    await expect(page.locator("input[type=password]")).toHaveCount(1);
    await expect(page.locator("main form")).toHaveCount(1);
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
    await settle(page);
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
    // Cancelled by the user: a neutral notice, not a red alert (#67)
    await expect(
      noticeWith(
        page,
        "Accesso con Google annullato. Riprova o scegli un altro modo per entrare.",
      ),
    ).toBeVisible();
    await expect(page.locator(".avviso--info:visible")).toHaveCount(1);
    await expect(page.locator(".avviso--errore")).toHaveCount(0);
    await expect(page.locator(".avviso[role=alert]")).toHaveCount(0);
    await page.goto("/auth/callback?provider=apple&error=access_denied");
    await expect(
      noticeWith(
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

test.describe("link via mail: ritorno", () => {
  for (const [url, tipo] of [
    ["/auth/confirm?token_hash=non-valido&type=magiclink", "conferma"],
    ["/auth/confirm", "conferma"],
    ["/auth/confirm?token_hash=non-valido&type=recovery", "password"],
  ] as const) {
    test(`CA-27: ${url} porta a /accesso/link-scaduto`, async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveURL(
        new RegExp(`/accesso/link-scaduto\\?tipo=${tipo}$`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await page.goto("/oggi");
      await expect(page).toHaveURL(/\/accesso$/);
    });
  }

  // #327: the screen depends on the kind of link; the main action changes.
  for (const [tipo, action, target] of [
    ["conferma", "Entra con la mail", "/accesso/mail"],
    ["password", "Mandami un nuovo link", "/accesso/password-dimenticata"],
    ["altro", "Entra con la mail", "/accesso/mail"],
  ] as const) {
    test(`CA-28: link scaduto (tipo=${tipo}), le due uscite`, async ({
      page,
    }) => {
      await page.goto(`/accesso/link-scaduto?tipo=${tipo}`);
      await page.getByRole("link", { name: action }).click();
      await expect(page).toHaveURL(new RegExp(`${target}$`));
      await page.goto(`/accesso/link-scaduto?tipo=${tipo}`);
      await page.getByRole("link", { name: "Torna all'accesso" }).click();
      await expect(page).toHaveURL(/\/accesso$/);
    });
  }
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

// Each [CI-utenti] test signs in with its OWN throwaway user. A magic link is
// stored on the user row, so a second link generated for the same user
// replaces the first: with the shared seed users, two workers (desktop and
// mobile run the same test at the same time, and CI runs of different PRs
// share the remote project) invalidated each other's links and the page ended
// on /accesso/link-scaduto (#173).

function needKeys() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.skip(!secretKey, "SUPABASE_SECRET_KEY non impostata");
}

type Resident = { email: string; cleanup: () => Promise<void> };

/** A throwaway user with a Nest of his own (like Marco of Casa D'Angelo). */
async function residentOf(
  nestName: string,
  members = D_ANGELO,
): Promise<Resident> {
  const { nest, cleanup } = await buildNest(nestName, members);
  const owner = nest.users[members.find((m) => m.account)!.name]!;
  return { email: owner.email, cleanup };
}

/** A throwaway user with no Nest (goes to /onboarding). */
async function newcomer(): Promise<Resident> {
  const user = await createThrowawayUser("Carla");
  return { email: user.email, cleanup: () => user.remove() };
}

/** A valid link, generated with the admin API: no mail is sent. */
async function magicLink(address: string, next?: string) {
  const admin = createClient(supabaseUrl as string, secretKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink", // the stored token also verifies as `email`
    email: address,
  });
  expect(error).toBeNull();
  const hash = data.properties!.hashed_token;
  return `/auth/confirm?token_hash=${hash}&type=email${
    next ? `&next=${encodeURIComponent(next)}` : ""
  }`;
}

async function enter(page: Page, address: string, next?: string) {
  await page.goto(await magicLink(address, next));
}

async function cookieNames(context: BrowserContext) {
  return (await context.cookies()).map((c) => c.name);
}

const NEST_A = "Apri Casa D'Angelo";

test.describe("[CI-utenti] ritorno e sessione", () => {
  test("CA-24: il link di A porta a /oggi", async ({ page }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    try {
      await enter(page, marco.email);
      await expect(page).toHaveURL(/\/oggi$/);
      expect(page.url()).not.toContain("token_hash");
      await expect(
        page
          .getByRole("button", { name: new RegExp(NEST_A) })
          .or(page.getByRole("link", { name: new RegExp(NEST_A) }))
          .first(),
      ).toBeVisible();
    } finally {
      await marco.cleanup();
    }
  });

  test("CA-25: il link di C porta a /onboarding", async ({ page }) => {
    needKeys();
    const carla = await newcomer();
    try {
      await enter(page, carla.email);
      await expect(page).toHaveURL(/\/onboarding$/);
    } finally {
      await carla.cleanup();
    }
  });

  test("CA-26: un link già usato porta a /accesso/link-scaduto", async ({
    page,
    browser,
  }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    const other = await browser.newContext();
    try {
      const link = await magicLink(marco.email);
      await page.goto(link);
      await expect(page).toHaveURL(/\/oggi$/);
      const second = await other.newPage();
      await second.goto(new URL(link, page.url()).toString());
      await expect(second).toHaveURL(/\/accesso\/link-scaduto\?tipo=conferma$/);
      await second.goto(new URL("/oggi", page.url()).toString());
      await expect(second).toHaveURL(/\/accesso$/);
    } finally {
      await other.close();
      await marco.cleanup();
    }
  });

  test("CA-29: next valido", async ({ page }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    try {
      await enter(page, marco.email, "/calendario");
      await expect(page).toHaveURL(/\/calendario$/);
    } finally {
      await marco.cleanup();
    }
  });

  test("CA-30: next esterno si ignora", async ({ page, baseURL }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    try {
      for (const bad of [
        "//esempio.invalid",
        "https://esempio.invalid",
        "/\\esempio.invalid",
      ]) {
        await enter(page, marco.email, bad);
        await expect(page).toHaveURL(/\/oggi$/);
        expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
        await page.context().clearCookies();
      }
    } finally {
      await marco.cleanup();
    }
  });

  test("CA-31: con la sessione le pagine di accesso portano via", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    const carla = await newcomer();
    const other = await page.context().browser()!.newContext({ baseURL });
    try {
      await enter(page, marco.email);
      for (const route of [
        "/accesso",
        "/accesso/mail",
        "/accesso/link-scaduto",
      ]) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/oggi$/);
      }
      const cPage = await other.newPage();
      await enter(cPage, carla.email);
      await cPage.goto("/accesso");
      await expect(cPage).toHaveURL(/\/onboarding$/);
    } finally {
      await other.close();
      await carla.cleanup();
      await marco.cleanup();
    }
  });

  test("CA-32: la sessione sopravvive alla chiusura del browser", async ({
    page,
    browser,
    baseURL,
  }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    let reopened: BrowserContext | undefined;
    try {
      await enter(page, marco.email);
      const state = await page.context().storageState();
      reopened = await browser.newContext({ baseURL, storageState: state });
      const again = await reopened.newPage();
      await again.goto("/oggi");
      await expect(again).toHaveURL(/\/oggi$/);
    } finally {
      await reopened?.close();
      await marco.cleanup();
    }
  });

  test("CA-33: token scaduto, rinnovo con il cookie salvato", async ({
    page,
    context,
    baseURL,
  }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    try {
      await enter(page, marco.email);
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
      // The response renews the session cookie: it sets a new auth cookie
      // whose expiry is in the future again.
      const renewed = await context.cookies();
      const renewedSession = renewed
        .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      expect(renewedSession.length).toBeGreaterThan(0);
      const renewedJoined = renewedSession.map((c) => c.value).join("");
      expect(renewedJoined).not.toBe(encoded);
      const renewedRaw = renewedJoined.startsWith("base64-")
        ? Buffer.from(renewedJoined.slice(7), "base64url").toString("utf8")
        : decodeURIComponent(renewedJoined);
      const renewedParsed = JSON.parse(renewedRaw) as Record<string, unknown>;
      expect(Number(renewedParsed["expires_at"])).toBeGreaterThan(
        Math.floor(Date.now() / 1000),
      );
      await page.goto("/calendario");
      await expect(page).toHaveURL(/\/calendario$/);
    } finally {
      await marco.cleanup();
    }
  });
});

test.describe("[CI-utenti] uscita e isolamento", () => {
  test("CA-34: «Esci» chiude la sessione", async ({ page, context }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    try {
      await enter(page, marco.email);
      await page.goto("/profilo");
      await signOutFromProfile(page);
      expect(
        (await cookieNames(context)).filter((n) => /^sb-.+-auth-token/.test(n)),
      ).toEqual([]);
      await page.goto("/oggi");
      await expect(page).toHaveURL(/\/accesso$/);
    } finally {
      await marco.cleanup();
    }
  });

  test("CA-35: GET /auth/signout non chiude la sessione", async ({ page }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    try {
      await enter(page, marco.email);
      const response = await page.request.get("/auth/signout");
      expect(response.status()).toBe(405);
      await page.goto("/oggi");
      await expect(page).toHaveURL(/\/oggi$/);
    } finally {
      await marco.cleanup();
    }
  });

  test("CA-36: B dopo A nello stesso browser", async ({ page }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    const giulia = await residentOf("Casa Bianchi", BIANCHI);
    try {
      await enter(page, marco.email);
      await page.goto("/profilo");
      await signOutFromProfile(page);
      await enter(page, giulia.email);
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
    } finally {
      await giulia.cleanup();
      await marco.cleanup();
    }
  });

  test("CA-37: B non riceve dati di A", async ({ page }) => {
    needKeys();
    const marco = await residentOf("Casa D'Angelo");
    const giulia = await residentOf("Casa Bianchi", BIANCHI);
    try {
      const bodies: string[] = [];
      page.on("response", async (response) => {
        const type = response.headers()["content-type"] ?? "";
        if (/text|json/.test(type) && response.url().includes("/oggi")) {
          bodies.push(await response.text().catch(() => ""));
        }
      });
      await enter(page, giulia.email);
      await expect(page).toHaveURL(/\/oggi$/);
      await page.reload();
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) expect(body).not.toContain("Casa D'Angelo");
    } finally {
      await giulia.cleanup();
      await marco.cleanup();
    }
  });
});
