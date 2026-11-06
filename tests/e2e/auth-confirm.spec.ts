import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import {
  RECOVERY_COOKIE_MAX_AGE_SECONDS,
  clearRecoveryCookieOptions,
  isRecoveryCookieValue,
  newRecoveryCookieValue,
  recoveryCookieOptions,
} from "../../src/lib/auth/recovery-cookie";
import { checkPassword } from "../../src/lib/auth/password";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import { COOKIE } from "../fixtures/invito-ingresso";

// Route /auth/confirm and helpers of the password access (#327, #326).
// The [CI-utenti] tests create their own throwaway user and generate the link
// with the administrative key: no mail is sent.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const RECOVERY_COOKIE = "familynest_recupero";

test.describe("helpers", () => {
  test("password: limiti da 8 a 72 caratteri, nessun taglio degli spazi", () => {
    expect(checkPassword("")).toBe("empty");
    expect(checkPassword("1234567")).toBe("short");
    expect(checkPassword("12345678")).toBe("ok");
    expect(checkPassword("a".repeat(72))).toBe("ok");
    expect(checkPassword("a".repeat(73))).toBe("long");
    expect(checkPassword("       ")).toBe("short");
    expect(checkPassword("        ")).toBe("ok");
  });

  test("cookie di recupero: opzioni e valore", () => {
    expect(recoveryCookieOptions("https://esempio.test")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 900,
    });
    expect(RECOVERY_COOKIE_MAX_AGE_SECONDS).toBe(900);
    expect(recoveryCookieOptions("http://127.0.0.1:3000").secure).toBe(false);
    const cleared = clearRecoveryCookieOptions("http://127.0.0.1:3000");
    expect(cleared.expires.getTime()).toBe(0);
    expect("maxAge" in cleared).toBe(false);
    expect(isRecoveryCookieValue(newRecoveryCookieValue())).toBe(true);
    expect(isRecoveryCookieValue("")).toBe(false);
    expect(isRecoveryCookieValue(undefined)).toBe(false);
    expect(isRecoveryCookieValue("1")).toBe(false);
  });
});

test.describe("/auth/confirm: link non validi", () => {
  const cases: Array<[string, RegExp]> = [
    [
      "/auth/confirm?type=magiclink&token_hash=qualunque",
      /\/accesso\/link-scaduto\?tipo=conferma$/,
    ],
    ["/auth/confirm?token_hash=qualunque", /\?tipo=conferma$/],
    ["/auth/confirm?type=email", /\?tipo=conferma$/],
    ["/auth/confirm?type=email&token_hash=inventato", /\?tipo=conferma$/],
    ["/auth/confirm?type=signup&token_hash=inventato", /\?tipo=conferma$/],
    ["/auth/confirm?type=otro&token_hash=inventato", /\?tipo=conferma$/],
    ["/auth/confirm?type=recovery&token_hash=inventato", /\?tipo=password$/],
  ];
  for (const [url, expected] of cases) {
    test(`${url} porta a /accesso/link-scaduto senza sessione`, async ({
      page,
    }) => {
      await page.goto(url);
      await expect(page).toHaveURL(expected);
      expect(page.url()).not.toContain("token_hash");
      const names = (await page.context().cookies()).map((c) => c.name);
      expect(names.filter((n) => n.startsWith("sb-"))).toEqual([]);
      expect(names).not.toContain(RECOVERY_COOKIE);
    });
  }

  test("la risposta è un 303 e non scrive il token in nessun indirizzo", async ({
    request,
  }) => {
    const response = await request.get(
      "/auth/confirm?type=recovery&token_hash=inventato&next=/oggi",
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(303);
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/accesso/link-scaduto?tipo=password");
    expect(location).not.toContain("inventato");
  });
});

function needKeys() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.skip(!secretKey, "SUPABASE_SECRET_KEY non impostata");
}

async function linkFor(
  email: string,
  kind: "recovery" | "email",
): Promise<string> {
  const admin = createClient(supabaseUrl as string, secretKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    // A token made for a magic link also verifies as `email`.
    type: kind === "recovery" ? "recovery" : "magiclink",
    email,
  });
  expect(error).toBeNull();
  return `/auth/confirm?token_hash=${data.properties!.hashed_token}&type=${kind}`;
}

test.describe("[CI-utenti] /auth/confirm: link validi", () => {
  test("type=email: sessione e /onboarding, senza token nell'indirizzo", async ({
    page,
  }) => {
    needKeys();
    const user = await createThrowawayUser("Carla");
    try {
      await page.goto(await linkFor(user.email, "email"));
      await expect(page).toHaveURL(/\/onboarding$/);
      expect(page.url()).not.toContain("token_hash");
      const names = (await page.context().cookies()).map((c) => c.name);
      expect(names).not.toContain(RECOVERY_COOKIE);
    } finally {
      await user.remove();
    }
  });

  test("type=email con il cookie d'invito: /invito/colore e il cookie resta", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    const user = await createThrowawayUser("Carla");
    const token = "a1".repeat(32);
    try {
      await page.context().addCookies([
        {
          name: COOKIE,
          value: token,
          url: baseURL!,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      // The route alone: /invito/colore would check the invitation itself.
      const response = await page
        .context()
        .request.get(await linkFor(user.email, "email"), { maxRedirects: 0 });
      expect(response.status()).toBe(303);
      const location = response.headers()["location"] ?? "";
      expect(new URL(location, baseURL!).pathname).toBe("/invito/colore");
      expect(location).not.toContain(token);
      expect(location).not.toContain("token_hash");
      const cookie = (await page.context().cookies()).find(
        (c) => c.name === COOKIE,
      );
      expect(cookie?.value).toBe(token);
    } finally {
      await user.remove();
    }
  });

  test("type=recovery: cookie di recupero e /accesso/nuova-password, next ignorato", async ({
    page,
    baseURL,
  }) => {
    needKeys();
    const user = await createThrowawayUser("Carla");
    try {
      // The route alone: the page of the new password is another PR.
      const response = await page
        .context()
        .request.get(`${await linkFor(user.email, "recovery")}&next=/oggi`, {
          maxRedirects: 0,
        });
      expect(response.status()).toBe(303);
      const location = response.headers()["location"] ?? "";
      expect(new URL(location, baseURL!).pathname).toBe(
        "/accesso/nuova-password",
      );
      expect(location).not.toContain("token_hash");
      const cookie = (await page.context().cookies()).find(
        (c) => c.name === RECOVERY_COOKIE,
      );
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("Lax");
      expect(cookie?.path).toBe("/");
      const remaining = (cookie?.expires ?? 0) - Date.now() / 1000;
      expect(remaining).toBeGreaterThan(800);
      expect(remaining).toBeLessThanOrEqual(900);
    } finally {
      await user.remove();
    }
  });

  test("un link usato due volte porta a /accesso/link-scaduto", async ({
    page,
    browser,
    baseURL,
  }) => {
    needKeys();
    const user = await createThrowawayUser("Carla");
    const other = await browser.newContext({ baseURL });
    try {
      const link = await linkFor(user.email, "recovery");
      const first = await page.context().request.get(link, { maxRedirects: 0 });
      expect(first.headers()["location"]).toContain("/accesso/nuova-password");
      const second = await other.request.get(link, { maxRedirects: 0 });
      expect(second.status()).toBe(303);
      expect(second.headers()["location"]).toContain(
        "/accesso/link-scaduto?tipo=password",
      );
      const names = (await other.cookies()).map((c) => c.name);
      expect(names).not.toContain(RECOVERY_COOKIE);
    } finally {
      await other.close();
      await user.remove();
    }
  });
});
