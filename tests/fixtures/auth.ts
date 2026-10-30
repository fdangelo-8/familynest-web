import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

// Sign-in helper for the end-to-end tests (decision D3 of issue #10): the test
// signs in as a test user with email and password through the Supabase client
// and puts the resulting session cookie in the browser context, so the app
// sees a signed-in visitor before the real login page exists (#11).
//
// Credentials come only from environment variables:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//   TEST_USER_A_EMAIL / _PASSWORD, TEST_USER_B_*, TEST_USER_C_*.
// A = Marco (Casa D'Angelo), B = Giulia and B2 = Paolo (Casa Bianchi), C = no Nest.

export type TestUserKey = "A" | "B" | "B2" | "C";

type SessionCookie = { name: string; value: string; expires?: number };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function credentials(key: TestUserKey) {
  return {
    email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
    password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
  };
}

/**
 * True when the Supabase variables and the credentials are set AND the
 * database is seeded. As in tests/e2e/utenti-di-test.spec.ts, the variables of
 * B2 and C are the sign that the seed has been run: while only A and B are set
 * (remote project not seeded yet, #55) the tests are skipped.
 */
export function usersConfigured(...keys: TestUserKey[]): boolean {
  const required = [...new Set([...keys, "C"])] as TestUserKey[];
  const hasCredentials = (email: string, password: string) =>
    !!email && !!password;
  return (
    !!supabaseUrl &&
    !!publishableKey &&
    hasCredentials(
      process.env.TEST_USER_B2_EMAIL ?? "",
      process.env.TEST_USER_B2_PASSWORD ?? "",
    ) &&
    required.every((key) => {
      const c = credentials(key);
      return hasCredentials(c.email, c.password);
    })
  );
}

/** Reason for `test.skip` when the users are not available. */
export function skipReason(...keys: TestUserKey[]): string {
  return `Utenti di test non configurati (#55): servono le variabili Supabase e TEST_USER_${keys.join(", TEST_USER_")}_*, TEST_USER_B2_* e TEST_USER_C_* (segno che il seed è stato eseguito)`;
}

// One sign-in per user in each worker: the session is reused by every test.
const sessions = new Map<TestUserKey, Promise<SessionCookie[]>>();

async function signIn(key: TestUserKey): Promise<SessionCookie[]> {
  const jar = new Map<string, SessionCookie>();
  const client = createServerClient(
    supabaseUrl as string,
    publishableKey as string,
    {
      cookies: {
        getAll() {
          return [...jar.values()].map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            if (!value || options?.maxAge === 0) {
              jar.delete(name);
            } else {
              jar.set(name, {
                name,
                value,
                expires: options?.maxAge
                  ? Math.floor(Date.now() / 1000) + options.maxAge
                  : undefined,
              });
            }
          }
        },
      },
    },
  );
  const { error } = await client.auth.signInWithPassword(credentials(key));
  if (error) throw new Error(`Accesso di prova fallito per ${key}`);
  // Makes sure the session has been written to the cookie jar.
  await client.auth.getSession();
  if (jar.size === 0) throw new Error(`Nessun cookie di sessione per ${key}`);
  return [...jar.values()];
}

/** Signs the context in as the given test user. */
export async function signInAs(
  context: BrowserContext,
  baseURL: string,
  key: TestUserKey,
): Promise<void> {
  let session = sessions.get(key);
  if (!session) {
    session = signIn(key);
    sessions.set(key, session);
  }
  const cookies = await session;
  await context.addCookies(
    cookies.map((cookie) => ({ ...cookie, url: baseURL })),
  );
}
