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

  for (const type of ["email", "signup"]) {
    test(`type=${type} con un token inventato: pagina «Conferma l'indirizzo», poi il bottone porta a /accesso/link-scaduto`, async ({
      page,
    }) => {
      await page.goto(`/auth/confirm?type=${type}&token_hash=inventato`);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Conferma il tuo indirizzo",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Conferma l'indirizzo", exact: true })
        .click();
      await expect(page).toHaveURL(/\/accesso\/link-scaduto\?tipo=conferma$/);
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

// POST /auth/confirm accepts only a request that comes from the page of the
// app: `Origin` present and equal to the address of the app.
test.describe("POST /auth/confirm: origine", () => {
  // With `Sec-Fetch-Site` under test the `Origin` is the right one, so that
  // only that header is wrong.
  const cases: Array<[string, (own: string) => Record<string, string>]> = [
    // Origin missing, «null», of another site and cross-site: with a real
    // token and the link still usable afterwards, in conferma-link.spec.ts.
    [
      "Sec-Fetch-Site same-site",
      (own) => ({ Origin: own, "Sec-Fetch-Site": "same-site" }),
    ],
    [
      "Sec-Fetch-Site none",
      (own) => ({ Origin: own, "Sec-Fetch-Site": "none" }),
    ],
  ];
  for (const [name, headersFor] of cases) {
    test(`${name}: 403 e nessuna sessione`, async ({ request, baseURL }) => {
      const response = await request.post("/auth/confirm", {
        form: { token_hash: "inventato", type: "email" },
        headers: headersFor(new URL(baseURL!).origin),
        maxRedirects: 0,
      });
      expect(response.status()).toBe(403);
      expect(response.headers()["set-cookie"] ?? "").not.toContain("sb-");
    });
  }

  test("dalla nostra origine con un token inventato: 303 a /accesso/link-scaduto", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post("/auth/confirm", {
      form: { token_hash: "inventato", type: "email" },
      headers: { Origin: new URL(baseURL!).origin },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/accesso/link-scaduto?tipo=conferma");
    expect(location).not.toContain("inventato");
  });

  const badForms: Array<Record<string, string>> = [
    // type=recovery with a valid token and no token_hash: CA-10 of
    // conferma-link.spec.ts.
    { token_hash: "inventato", type: "recovery" },
    { token_hash: "inventato", type: "magiclink" },
  ];
  for (const form of badForms) {
    test(`dalla nostra origine con ${JSON.stringify(form)}: 303 a /accesso/link-scaduto?tipo=conferma`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.post("/auth/confirm", {
        form,
        headers: { Origin: new URL(baseURL!).origin },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      expect(response.headers()["location"] ?? "").toContain(
        "/accesso/link-scaduto?tipo=conferma",
      );
      expect(response.headers()["set-cookie"] ?? "").not.toContain(
        RECOVERY_COOKIE,
      );
    });
  }
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
  // type=email with a valid link, GET/HEAD not using it, the button and
  // «Continua»: CA-2 and CA-17 of conferma-link.spec.ts.

  // The POST refused with 403 and the link still usable: conferma-link.spec.ts.

  test("type=email con il cookie d'invito: /accesso/mail-confermata e il cookie resta", async ({
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
      const tokenHash = new URL(
        await linkFor(user.email, "email"),
        baseURL!,
      ).searchParams.get("token_hash");
      const response = await page.context().request.post("/auth/confirm", {
        form: { token_hash: tokenHash!, type: "email" },
        headers: { Origin: new URL(baseURL!).origin },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      const location = response.headers()["location"] ?? "";
      expect(new URL(location, baseURL!).pathname).toBe(
        "/accesso/mail-confermata",
      );
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
