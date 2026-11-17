import {
  expect,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { admin } from "./accesso-password";
import { waitHydrated } from "./esplora";

// Helpers of tests/e2e/conferma-link.spec.ts (#419): the page that asks to
// press a button before a mail link is used (GET /auth/confirm), the POST
// that uses it, the page «Mail confermata» and the row of the active account.
//
// Texts: the ones APPROVED by the designer in the comments of the issue
// (section 3 «Testi nuovi»), which win over the `[D]` proposals of the body.
// They live here, in one place: if Francesco changes a text, only this block
// changes.

export const TEXT = {
  aboveConfirm: "Registrazione",
  confirmTitle: "Conferma il tuo indirizzo",
  confirmLead:
    "Tocca il bottone per confermare la mail ed entrare in FamilyNest.",
  confirmButton: "Conferma l'indirizzo",
  confirmBusy: "Conferma in corso",
  stay: "Resta con questo account",
  confirmedAbove: "Accesso con la mail",
  confirmedTitle: "Mail confermata",
  next: "Continua",
} as const;

/** «Non sei tu? Esci» (designer) or «Esci» after the text «Non sei tu?» (issue). */
export const EXIT_NAME = /^(Non sei tu\? )?Esci$/;

export const CONFIRM_EXPIRED = /\/accesso\/link-scaduto\?tipo=conferma$/;
export const CONFIRMED = /\/accesso\/mail-confermata(\?[^#]*)?$/;
export const RECOVERY_COOKIE = "familynest_recupero";
export const INVITE_COOKIE = "familynest_invito";

// ------------------------------------------------------------------ links

/** A valid `token_hash` for the user, made with the administrative key: no mail. */
export async function tokenFor(
  address: string,
  kind: "magiclink" | "recovery" = "magiclink",
): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    // The stored token of a magic link also verifies as `email`.
    type: kind,
    email: address,
  });
  if (error || !data.properties) throw new Error("Link di prova non creato");
  return data.properties.hashed_token;
}

export function confirmPath(
  token: string,
  options: { type?: string; next?: string } = {},
): string {
  const { type = "email", next } = options;
  return `/auth/confirm?token_hash=${token}&type=${type}${
    next ? `&next=${encodeURIComponent(next)}` : ""
  }`;
}

/** A valid link of the user (type `email`). */
export async function linkFor(
  address: string,
  next?: string,
): Promise<{ token: string; path: string }> {
  const token = await tokenFor(address);
  return { token, path: confirmPath(token, { next }) };
}

export const originOf = (baseURL: string | undefined) =>
  new URL(baseURL as string).origin;

// ---------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

export const confirmButton = (page: Page) =>
  page.getByRole("button", { name: TEXT.confirmButton, exact: true });

/** The form of the page «Conferma» (the only one with the POST to the route). */
export const confirmForm = (page: Page) =>
  page.locator('main form[action="/auth/confirm"]');

export const stayLink = (page: Page) =>
  page.getByRole("link", { name: TEXT.stay, exact: true });

export const continueControl = (page: Page) =>
  page
    .getByRole("button", { name: TEXT.next, exact: true })
    .or(page.getByRole("link", { name: TEXT.next, exact: true }));

export const exitButton = (page: Page) =>
  page.getByRole("button", { name: EXIT_NAME });

/** The row «Per l'account <mail>.» (one of the two layouts is visible). */
export const accountRow = (page: Page): Locator =>
  page.getByTestId("account-attivo").filter({ visible: true });

export const accountLine = (email: string) => `Per l'account ${email}.`;

// ---------------------------------------------------------------- sessions

const SESSION_COOKIE = /^sb-.*-auth-token/;

export async function sessionCookieNames(context: BrowserContext) {
  return (await context.cookies())
    .map((cookie) => cookie.name)
    .filter((name) => SESSION_COOKIE.test(name));
}

export async function hasSession(context: BrowserContext): Promise<boolean> {
  return (await sessionCookieNames(context)).length > 0;
}

/** No session cookie and no recovery cookie in the context. */
export async function expectNoSession(context: BrowserContext) {
  const names = (await context.cookies()).map((cookie) => cookie.name);
  expect(names.filter((name) => SESSION_COOKIE.test(name))).toEqual([]);
  expect(names).not.toContain(RECOVERY_COOKIE);
}

/**
 * Who the session of the context belongs to, read from «Mail confermata» in a
 * new tab (the page of the test stays where it is).
 */
export async function expectSessionOf(context: BrowserContext, email: string) {
  const tab = await context.newPage();
  try {
    await tab.goto("/accesso/mail-confermata");
    await expect(accountRow(tab)).toContainText(accountLine(email));
  } finally {
    await tab.close();
  }
}

// ------------------------------------------------------------------- flows

/** Opens the page «Conferma» of a link and waits for it. */
export async function openConfirm(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(h1(page)).toHaveText(TEXT.confirmTitle);
  return response!;
}

/** Opens the link and presses the button: the user of the link comes in. */
export async function confirmWithButton(page: Page, path: string) {
  await openConfirm(page, path);
  await confirmButton(page).click();
  await expect(page).toHaveURL(CONFIRMED);
}

/** The link is used once in a browser of its own, then that browser is closed. */
export async function consumeLink(
  browser: Browser,
  baseURL: string,
  path: string,
) {
  const other = await browser.newContext({ baseURL });
  try {
    const tab = await other.newPage();
    await confirmWithButton(tab, path);
  } finally {
    await other.close();
  }
}

/** Waits for the button to be hydrated (the second click needs JS to be held). */
export async function waitConfirmHydrated(page: Page) {
  await waitHydrated(confirmForm(page).locator('button[type="submit"]'));
}

// ------------------------------------------------------------- raw requests

/** The headers a browser of this site would send; the cases below change them. */
export type PostCase = {
  name: string;
  headers: (origin: string) => Record<string, string>;
};

/** POSTs rejected with 403 (decision D1): the token must not be used. */
export const FORBIDDEN_POSTS: PostCase[] = [
  {
    name: "Origin diversa",
    headers: () => ({ Origin: "https://altro.example" }),
  },
  // No header at all: Playwright's request does not add one by itself.
  { name: "Origin assente", headers: () => ({}) },
  { name: "Origin: null", headers: () => ({ Origin: "null" }) },
  {
    name: "Sec-Fetch-Site: cross-site",
    headers: (origin) => ({ Origin: origin, "Sec-Fetch-Site": "cross-site" }),
  },
];

/** POST of the form, without following the answer, in a context of its own. */
export async function postConfirm(
  browser: Browser,
  baseURL: string,
  form: Record<string, string>,
  headers: Record<string, string>,
): Promise<{ response: APIResponse; context: BrowserContext }> {
  const context = await browser.newContext({ baseURL });
  const response = await context.request.post("/auth/confirm", {
    form,
    headers,
    maxRedirects: 0,
  });
  return { response, context };
}
