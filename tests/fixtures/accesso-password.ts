import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { expect, type BrowserContext, type Page } from "@playwright/test";

// Helpers of the specs of the sign-in with mail and password (#327).
//
// Mailpit is the mail inbox of the local Supabase stack: the app sends real
// mails to it and the tests read them through its HTTP API. It does not exist
// in the remote project, so the tests that need it are skipped there
// (`mailpitReachable`). In the local stack `site_url` is 127.0.0.1:3000 while
// the browser of the tests is on localhost:3000: the links of the mails are
// rewritten to the host of `baseURL` before they are opened, otherwise the
// cookies of the two hosts would be separate (PR #340).
//
// Every test creates its own users (marked as test users) and deletes them in
// a `finally`; the mails are deleted too. Keys come only from the environment.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
/** `site_url` of supabase/config.toml: how every link of the mails starts. */
export const SITE_URL = process.env.SITE_URL ?? "http://127.0.0.1:3000";
export const RECOVERY_COOKIE = "familynest_recupero";
export const PASSWORD = "una-password-di-prova";
export const NEW_PASSWORD = "un'altra-password-di-prova";

export function keysConfigured(): boolean {
  return !!supabaseUrl && !!publishableKey && !!secretKey;
}
export const keysSkipReason =
  "Chiavi Supabase (URL, chiave pubblica, chiave amministrativa) non impostate";

let reachable: Promise<boolean> | undefined;
/** True when Mailpit answers (local stack and CI; false on the remote project). */
export function mailpitReachable(): Promise<boolean> {
  reachable ??= fetch(`${MAILPIT_URL}/api/v1/info`, {
    signal: AbortSignal.timeout(3000),
  })
    .then((response) => response.ok)
    .catch(() => false);
  return reachable;
}
export const mailpitSkipReason =
  "Mailpit (casella del Supabase locale) non raggiungibile";

export function newAddress(prefix = "accesso"): string {
  return `${prefix}-${randomUUID()}@example.test`;
}

export function admin(): SupabaseClient {
  return createClient(supabaseUrl as string, secretKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ------------------------------------------------------------------ mailpit

export type Mail = {
  id: string;
  subject: string;
  html: string;
  text: string;
};

type Summary = { ID: string; Subject: string };

async function summariesFor(address: string): Promise<Summary[]> {
  const query = encodeURIComponent(`to:${address}`);
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  if (!response.ok) throw new Error("Lettura di Mailpit fallita");
  const body = (await response.json()) as { messages?: Summary[] };
  return body.messages ?? [];
}

/** Every mail sent to an address, oldest first. */
export async function mailsFor(address: string): Promise<Mail[]> {
  const summaries = await summariesFor(address);
  const mails: Mail[] = [];
  for (const summary of [...summaries].reverse()) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
    if (!response.ok) throw new Error("Lettura di una mail fallita");
    const body = (await response.json()) as {
      Subject: string;
      HTML: string;
      Text: string;
    };
    mails.push({
      id: summary.ID,
      subject: body.Subject,
      html: body.HTML,
      text: body.Text,
    });
  }
  return mails;
}

/** Waits until `count` mails have arrived for the address (default 1). */
export async function waitForMails(
  address: string,
  count = 1,
): Promise<Mail[]> {
  let mails: Mail[] = [];
  await expect
    .poll(
      async () => {
        mails = await mailsFor(address);
        return mails.length;
      },
      { timeout: 20_000, message: `mail per ${address}` },
    )
    .toBeGreaterThanOrEqual(count);
  return mails;
}

/** After a wait: the address must still have exactly this many mails. */
export async function expectMailCount(address: string, count: number) {
  // Mails are sent before the answer reaches the browser: one reading is enough.
  expect((await summariesFor(address)).length).toBe(count);
}

export async function deleteMailsFor(address: string): Promise<void> {
  const query = encodeURIComponent(`to:${address}`);
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

/** Every `href` of the HTML of a mail. */
export function linksIn(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) =>
    (match[1] as string).replaceAll("&amp;", "&"),
  );
}

/** The link of a mail, moved to the host of `baseURL` so that cookies match. */
export function onBase(link: string, baseURL: string): string {
  const target = new URL(baseURL);
  const url = new URL(link);
  url.protocol = target.protocol;
  url.host = target.host;
  return url.toString();
}

// -------------------------------------------------------------------- users

export type PasswordUser = {
  id: string;
  email: string;
  password: string;
  remove: () => Promise<void>;
};

/**
 * A user who signs in with mail and password. `confirmed: false` is a person
 * who registered and has not opened the link yet. With `nest` the user also
 * has a Nest of his own (like Marco of Casa D'Angelo).
 */
export async function createPasswordUser(
  options: { confirmed?: boolean; nest?: boolean; name?: string } = {},
): Promise<PasswordUser> {
  const { confirmed = true, nest = false, name = "Carla" } = options;
  const email = newAddress("utente");
  const password = PASSWORD;
  const client = admin();
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: confirmed,
    user_metadata: { full_name: name },
    app_metadata: { familynest_test_user: true },
  });
  if (error || !data.user) {
    throw new Error(`Utente di prova non creato: ${error?.message}`);
  }
  const id = data.user.id;
  let removed = false;
  const remove = async () => {
    if (removed) return;
    removed = true;
    await client.auth.admin.deleteUser(id);
    await deleteMailsFor(email);
  };
  if (nest) {
    try {
      const own = createClient(
        supabaseUrl as string,
        publishableKey as string,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const signedIn = await own.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw new Error("Accesso di prova fallito");
      const created = await own.rpc("create_household", {
        name: "Casa di prova",
        household_type: "family_with_children",
        member_name: name,
        color: "salvia",
      });
      if (created.error) throw new Error("Creazione del Nest di prova fallita");
    } catch (failure) {
      await remove();
      throw failure;
    }
  }
  return { id, email, password, remove };
}

/** Deletes a user created by the app itself (a registration in a test). */
export async function removeByEmail(address: string): Promise<void> {
  const client = admin();
  for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
    const { data } = await client.auth.admin.listUsers({
      page: pageNumber,
      perPage: 200,
    });
    const users = data?.users ?? [];
    const found = users.find((user) => user.email === address);
    if (found) {
      await client.auth.admin.deleteUser(found.id);
      break;
    }
    if (users.length < 200) break;
  }
  await deleteMailsFor(address);
}

// --------------------------------------------------------------- the screens

export const mailField = (page: Page) => page.getByLabel("La tua mail");

export const passwordField = (page: Page, label = "Password") =>
  page.getByLabel(label, { exact: true });

export const modeGroup = (page: Page) =>
  page.getByRole("group", { name: "Hai già un account?" });

export const modeVoice = (page: Page, name: "Entra" | "Registrati") =>
  modeGroup(page).getByRole("button", { name, exact: true });

/** The submit button of the form (the «Entra» voice of the selector is not it). */
export const submitButton = (page: Page) =>
  page.locator('main form button[type="submit"]');

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** `status` notice with a text (the route announcer is also a `role=alert`). */
export const statusWith = (page: Page, text: string | RegExp) =>
  page.getByRole("status").filter({ hasText: text });
export const alertWith = (page: Page, text: string | RegExp) =>
  page.getByRole("alert").filter({ hasText: text });

/**
 * Keeps trying `step` until the page has been hydrated and `done` holds: a
 * click before hydration submits the form natively and reloads the page.
 */
export async function untilHydrated(
  step: () => Promise<void>,
  done: () => Promise<void>,
) {
  await expect(async () => {
    await step();
    await done();
  }).toPass({ timeout: 20_000 });
}

/** Fills the fields of /accesso/mail and presses the button, until it works. */
export async function submitMailForm(
  page: Page,
  input: {
    mode: "Entra" | "Registrati";
    email: string;
    password: string;
  },
  done: () => Promise<void>,
) {
  await untilHydrated(async () => {
    await modeVoice(page, input.mode).click({ timeout: 2000 });
    await mailField(page).fill(input.email, { timeout: 2000 });
    await passwordField(
      page,
      input.mode === "Entra" ? "Password" : "Scegli una password",
    ).fill(input.password, { timeout: 2000 });
    await submitButton(page).click({ timeout: 2000, noWaitAfter: true });
  }, done);
}

// ---------------------------------------------------------- Supabase calls

export type AuthCall = {
  path: string;
  method: string;
  query: URLSearchParams;
  body: Record<string, unknown>;
};

/** Every request of the page to the Auth API of Supabase, in order. */
export function recordAuth(page: Page): AuthCall[] {
  const calls: AuthCall[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!supabaseUrl || !url.startsWith(`${supabaseUrl}/auth/v1/`)) return;
    const parsed = new URL(url);
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
    } catch {
      body = {};
    }
    calls.push({
      path: parsed.pathname.replace("/auth/v1", "/auth/v1"),
      method: request.method(),
      query: parsed.searchParams,
      body,
    });
  });
  return calls;
}

export const callsTo = (calls: AuthCall[], path: string) =>
  calls.filter((call) => call.path === `/auth/v1${path}`);

/** The magic link is gone (CA-35): no call may reach these endpoints. */
export function expectNoMagicLink(calls: AuthCall[]) {
  expect(
    calls.filter((call) => /\/auth\/v1\/(otp|magiclink)/.test(call.path)),
  ).toEqual([]);
}

type Mock =
  | { kind: "ok"; body?: unknown }
  | { kind: "status"; status: number; body: unknown }
  | { kind: "abort" }
  | { kind: "abort-once"; then?: unknown };

export const RATE_LIMIT = {
  kind: "status",
  status: 429,
  body: {
    code: 429,
    error_code: "over_email_send_rate_limit",
    msg: "rate limit",
  },
} as const satisfies Mock;

/** Answers the requests of an Auth endpoint (`/signup`, `/token`, ...) with a fixed reply. */
export async function mockAuth(page: Page, path: string, mock: Mock) {
  let calls = 0;
  await page.route(`${supabaseUrl}/auth/v1${path}*`, async (route) => {
    calls += 1;
    if (mock.kind === "abort" || (mock.kind === "abort-once" && calls === 1)) {
      await route.abort("failed");
      return;
    }
    const status = mock.kind === "status" ? mock.status : 200;
    const body =
      mock.kind === "status"
        ? mock.body
        : mock.kind === "ok"
          ? (mock.body ?? {})
          : (mock.then ?? {});
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/** Browser context signed in as a user, without going through the page. */
export async function signInContext(
  context: BrowserContext,
  baseURL: string,
  user: PasswordUser,
): Promise<void> {
  const jar = new Map<string, string>();
  const client = createServerClient(
    supabaseUrl as string,
    publishableKey as string,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll(cookies) {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error("Accesso di prova fallito");
  await client.auth.getSession();
  await context.addCookies(
    [...jar].map(([name, value]) => ({ name, value, url: baseURL })),
  );
}

/** A recovery link for the user, made with the administrative key: no mail. */
export async function recoveryLink(address: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "recovery",
    email: address,
  });
  if (error || !data.properties) throw new Error("Link di prova non creato");
  return `/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`;
}

/** Names of the cookies of a context. */
export async function cookieNames(context: BrowserContext) {
  return (await context.cookies()).map((cookie) => cookie.name);
}

// ------------------------------------------------- default links of Supabase

/** The `token_hash` of the (local, custom) mail: the value of `{{ .TokenHash }}`. */
export function tokenHashIn(html: string): string {
  const withHash = linksIn(html).find((href) => href.includes("token_hash="));
  expect(withHash, "link con token_hash nella mail").toBeTruthy();
  const tokenHash = new URL(withHash as string).searchParams.get("token_hash");
  expect(tokenHash).toBeTruthy();
  return tokenHash as string;
}

/**
 * The link of Supabase's DEFAULT template, rebuilt from the `token_hash` of the
 * local mail (#327, CA-2 and CA-21): `{{ .ConfirmationURL }}` is
 * `<API>/auth/v1/verify?token=<TokenHash>&type=signup|recovery&redirect_to=…`.
 *
 * Supabase accepts a `redirect_to` with a query only on the host of `site_url`,
 * and the browser of the tests is on another host: the link is followed by
 * hand (Supabase checks the token and answers with the address of the
 * callback) and the callback is then opened on the host of `baseURL`. Each
 * call follows the link again, so a second call is a second use of the token.
 */
export function defaultLink(
  html: string,
  kind: "conferma" | "password",
  baseURL: string,
): () => Promise<string> {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHashIn(html));
  url.searchParams.set("type", kind === "conferma" ? "signup" : "recovery");
  url.searchParams.set("redirect_to", `${SITE_URL}/auth/callback?tipo=${kind}`);
  return async () => {
    const response = await fetch(url, { redirect: "manual" });
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    return onBase(location as string, baseURL);
  };
}

/** Every Auth call as text, query string included (to look for a secret). */
export function callsText(calls: AuthCall[]): string {
  return calls
    .map(
      (call) =>
        `${call.method} ${call.path}?${call.query.toString()}\n${JSON.stringify(call.body)}`,
    )
    .join("\n");
}

/** Every request of the browser that goes to our own site (not to Supabase). */
export function recordOwnRequests(page: Page) {
  const seen: Array<{ url: string; body: string; type: string }> = [];
  page.on("request", (request) => {
    const url = request.url();
    if (supabaseUrl && url.startsWith(supabaseUrl)) return;
    seen.push({
      url,
      body: request.postData() ?? "",
      type: request.resourceType(),
    });
  });
  return seen;
}
