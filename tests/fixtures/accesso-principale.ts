import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  admin,
  defaultLink,
  keysConfigured,
  keysSkipReason,
  mailField,
  mailpitReachable,
  mailpitSkipReason,
  newAddress,
  passwordField,
  submitButton,
  untilHydrated,
  waitForMails,
  type PasswordUser,
} from "./accesso-password";
import { tokenFor } from "./conferma-link";
import { waitHydrated } from "./esplora";

// Helpers of the specs of #461 (`/accesso` = mail and password first, Apple and
// Google below; button page of the recovery link). Mail and password helpers
// are the ones of the #327 specs (`accesso-password.ts`).
//
// Texts marked [D] are the proposals of the issue: if the designer approves
// other words, only this block changes.

export const TEXT = {
  // [D] proposals of the issue (section 5 and CA-22/CA-27)
  recoveryTitle: "Hai chiesto una nuova password",
  recoveryButton: "Scegli una nuova password",
  stay: "Resta con questo account",
  // texts of #327 (unchanged by #461)
  credentials: /^La mail e la password non corrispondono\./,
  unconfirmed: /^Questa mail non è ancora confermata\./,
  googleError:
    "Accesso con Google non riuscito. Controlla la connessione e riprova.",
  networkLogin:
    "Non siamo riusciti a farti entrare. Controlla la connessione e riprova.",
  deleted: "Il tuo account è stato eliminato.",
  emptyMail: "Scrivi la tua mail per entrare.",
  tooLong: "La password è troppo lunga: al massimo 72 caratteri.",
  limitLogin: "Troppi tentativi di fila. Aspetta qualche minuto e riprova.",
  newPasswordNetwork:
    "Non siamo riusciti a salvare la password. Controlla la connessione e riprova.",
  newPasswordSaved: "Nuova password salvata.",
  resent: "Mail rimandata: usa quella più recente.",
  recoverResent: "Nuovo link mandato: usa quello più recente.",
} as const;

/** Words that must never appear in a rate-limit notice (CA-34). */
export const TECHNICAL = /\b(429|rate|limit|error)\b|over_|_limit/i;

export const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
] as const;

// ------------------------------------------------------------------ guards

export function needKeys() {
  test.skip(!keysConfigured(), keysSkipReason);
}

export async function needStack() {
  needKeys();
  test.skip(!(await mailpitReachable()), mailpitSkipReason);
}

export function seedCredentials(key: "A" | "B") {
  const email = process.env[`TEST_USER_${key}_EMAIL`];
  const password = process.env[`TEST_USER_${key}_PASSWORD`];
  test.skip(!email || !password, `Utente di prova ${key} non configurato`);
  return { email: email as string, password: password as string };
}

// ---------------------------------------------------------------- locators

export const checkPosta = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Controlla la posta" });
export const sentTitle = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Ti abbiamo scritto" });
export const appleButton = (page: Page) =>
  page.getByRole("button", { name: "Continua con Apple", exact: true });
export const googleButton = (page: Page) =>
  page.getByRole("button", { name: "Continua con Google", exact: true });
export const forgotLink = (page: Page) =>
  page.getByRole("link", { name: "Password dimenticata?", exact: true });
export const resendButton = (page: Page) =>
  page.getByRole("button", { name: "Rimanda la mail", exact: true });
export const againButton = (page: Page) =>
  page.getByRole("button", { name: "Mandami un altro link", exact: true });
export const retryButton = (page: Page) =>
  page.getByRole("button", { name: "Riprova", exact: true });
export const mainContent = (page: Page) => page.getByRole("main");

/** The primary button of the recovery page (the only submit of the form). */
export const recoveryButton = (page: Page) =>
  page.getByRole("button", { name: TEXT.recoveryButton, exact: true });
export const recoveryForm = (page: Page) =>
  page.locator('main form[action="/auth/recupero"]');
export const stayLink = (page: Page) =>
  page.getByRole("link", { name: TEXT.stay, exact: true });

// ----------------------------------------------------------------- the page

/** Opens `/accesso` and waits until the form belongs to React. */
export async function openAccess(page: Page) {
  await page.goto("/accesso");
  await expect(submitButton(page)).toBeVisible();
  await waitHydrated(submitButton(page));
}

/**
 * The elements are in this order in the DOM and on the screen (`y` growing).
 * A locator that is not visible makes the test fail.
 */
export async function expectOrder(page: Page, locators: Locator[]) {
  // Each element gets its position in the list; the DOM must list them in the
  // same order (the marks are removed afterwards).
  for (const [index, locator] of locators.entries()) {
    await locator.evaluate((node, mark) => {
      node.setAttribute("data-ordine-prova", String(mark));
    }, index);
  }
  const inDom = await page.evaluate(() => {
    const marks = [...document.querySelectorAll("[data-ordine-prova]")];
    const order = marks.map((node) =>
      Number(node.getAttribute("data-ordine-prova")),
    );
    marks.forEach((node) => node.removeAttribute("data-ordine-prova"));
    return order;
  });
  expect(inDom, "ordine nel DOM").toEqual(locators.map((_, index) => index));
  const ys: number[] = [];
  for (const locator of locators) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    ys.push(box!.y);
  }
  for (let i = 1; i < ys.length; i += 1) {
    expect(ys[i]!, `y dell'elemento ${i}`).toBeGreaterThan(ys[i - 1]!);
  }
}

/** Text of the visible content with the address replaced (to compare cases). */
export async function snapshot(page: Page, address?: string) {
  let html = await mainContent(page).innerHTML();
  if (address) html = html.split(address).join("<MAIL>");
  return html;
}

/** `page.title()` once the document has its final title. */
export async function titleOf(page: Page) {
  return page.title();
}

// -------------------------------------------------- held and failing requests

/**
 * Holds the answers of an Auth endpoint until `release()`; the request itself
 * is not answered by Supabase (the page stays in its loading state).
 */
export async function holdAuth(page: Page, url: string, path: string) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(`${url}/auth/v1${path}*`, async (route) => {
    await gate;
    await route.abort("failed").catch(() => undefined);
  });
  return { release };
}

/** Reads the state of the form from the DOM (locators wait for navigations). */
export async function formState(page: Page) {
  return page.evaluate(() => {
    const submit = document.querySelector<HTMLButtonElement>(
      'main form button[type="submit"]',
    );
    const inputs = [
      ...document.querySelectorAll<HTMLInputElement>("form input"),
    ];
    return {
      submitText: (submit?.textContent ?? "").trim(),
      submitBusy: submit?.getAttribute("aria-busy"),
      submitDisabled:
        !!submit &&
        (submit.disabled || submit.getAttribute("aria-disabled") === "true"),
      inputsReadOnly: inputs.map((input) => input.readOnly),
      providers: [...document.querySelectorAll<HTMLButtonElement>("button")]
        .filter((b) => /^Continua con (Apple|Google)/.test(b.textContent ?? ""))
        .map((b) => ({
          text: (b.textContent ?? "").trim(),
          disabled: b.disabled || b.getAttribute("aria-disabled") === "true",
        })),
    };
  });
}

// ------------------------------------------------------------------ accounts

/**
 * An account created only with Google: confirmed, no password. The provider
 * is simulated through the administrative key (the local stack has no Google).
 */
export async function createGoogleOnlyUser(): Promise<PasswordUser> {
  const email = newAddress("google");
  const client = admin();
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Carla" },
    app_metadata: {
      provider: "google",
      providers: ["google"],
      familynest_test_user: true,
    },
  });
  if (error || !data.user) throw new Error("Utente Google di prova non creato");
  const id = data.user.id;
  return {
    id,
    email,
    password: "",
    remove: async () => {
      await client.auth.admin.deleteUser(id);
    },
  };
}

/** A session of the account that is not in any browser (to see it closed). */
export async function otherSession(user: PasswordUser) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) throw new Error("Seconda sessione non aperta");
  return { client, refreshToken: data.session.refresh_token };
}

// -------------------------------------------------------------- recovery link

/** A valid recovery link of the address (administrative key, no mail). */
export async function recoveryPath(
  address: string,
  options: { next?: string } = {},
): Promise<{ token: string; path: string }> {
  const token = await tokenFor(address, "recovery");
  const next = options.next ? `&next=${encodeURIComponent(options.next)}` : "";
  return {
    token,
    path: `/auth/confirm?token_hash=${token}&type=recovery${next}`,
  };
}

/** Opens the page of the button and checks it is the recovery page. */
export async function openRecovery(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: TEXT.recoveryTitle }),
  ).toBeVisible();
  await expect(recoveryButton(page)).toBeVisible();
  return response!;
}

export async function pressRecovery(page: Page, path: string) {
  await openRecovery(page, path);
  await recoveryButton(page).click();
  await expect(page).toHaveURL(/\/accesso\/nuova-password$/);
}

export async function consumeRecovery(
  browser: Browser,
  baseURL: string,
  path: string,
) {
  const other = await browser.newContext({ baseURL });
  try {
    await pressRecovery(await other.newPage(), path);
  } finally {
    await other.close();
  }
}

/** POST of the recovery form without following the answer, in a fresh context. */
export async function postTo(
  browser: Browser,
  baseURL: string,
  route: "/auth/recupero" | "/auth/confirm",
  form: Record<string, string>,
  headers: Record<string, string>,
): Promise<{ response: APIResponse; context: BrowserContext }> {
  const context = await browser.newContext({ baseURL });
  const response = await context.request.post(route, {
    form,
    headers,
    maxRedirects: 0,
  });
  return { response, context };
}

/** Asks for the recovery link through the page «Password dimenticata». */
export async function askRecovery(page: Page, address: string) {
  await page.goto("/accesso/password-dimenticata");
  await untilHydrated(
    async () => {
      await mailField(page).fill(address, { timeout: 2000 });
      await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
    },
    () => expect(sentTitle(page)).toBeVisible({ timeout: 8000 }),
  );
}

/** Link of Supabase's default mail for a recovery asked by this page (PKCE). */
export async function recoveryMailLink(
  page: Page,
  address: string,
  baseURL: string,
) {
  await askRecovery(page, address);
  const [mail] = await waitForMails(address);
  return defaultLink(mail!.html, "password", baseURL);
}

/** Fills the new password and presses the button of /accesso/nuova-password. */
export async function saveNewPassword(page: Page, value: string) {
  await passwordField(page, "Nuova password").fill(value);
  await submitButton(page).click();
}
