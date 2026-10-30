import type { BrowserContext, Cookie } from "@playwright/test";
import { signInAs, type TestUserKey } from "./visual-login";

// Same as signInAs, but the password sign-in happens once per worker: the
// session cookies are kept and put back in every later context. The auth
// service allows only a few sign-ins every 5 minutes from one address, and a
// suite with one sign-in per test would be skipped halfway (#55).

const sessions = new Map<TestUserKey, Cookie[]>();

export async function signInAsCached(
  context: BrowserContext,
  baseURL: string,
  key: TestUserKey,
): Promise<boolean> {
  const cached = sessions.get(key);
  if (cached) {
    await context.addCookies(cached);
    return true;
  }
  const signedIn = await signInAs(context, baseURL, key);
  if (signedIn) sessions.set(key, await context.cookies());
  return signedIn;
}
