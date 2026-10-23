import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

// Signs a test user in with the password from the environment and stores the
// session in the browser context with the same cookie format the app reads
// (@supabase/ssr: base64url value, split in chunks of at most 3180 chars).
// Credentials come only from environment variables, never from files.

export type TestUserKey = "A" | "B" | "C";

export function hasTestUser(key: TestUserKey): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env[`TEST_USER_${key}_EMAIL`] &&
    process.env[`TEST_USER_${key}_PASSWORD`],
  );
}

const CHUNK = 3180;

export async function signInAs(
  context: BrowserContext,
  baseURL: string,
  key: TestUserKey,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabase = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env[`TEST_USER_${key}_EMAIL`] as string,
    password: process.env[`TEST_USER_${key}_PASSWORD`] as string,
  });
  if (error || !data.session) {
    throw new Error(`Sign-in of test user ${key} failed.`);
  }
  const ref = new URL(url).hostname.split(".")[0]!;
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK) {
    chunks.push(value.slice(i, i + CHUNK));
  }
  await context.addCookies(
    chunks.length === 1
      ? [{ name, value: chunks[0]!, url: baseURL }]
      : chunks.map((c, i) => ({
          name: `${name}.${i}`,
          value: c,
          url: baseURL,
        })),
  );
}
