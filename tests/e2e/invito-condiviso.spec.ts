import { expect, test } from "@playwright/test";
import { chosenFirstOrder } from "../../src/components/ui/ColorChoice/ColorChoice";
import { accessErrorText, startOAuthSignIn } from "../../src/lib/auth/oauth";
import { safeNextPath } from "../../src/lib/auth/safe-next";
import {
  shapePreview,
  type PreviewRow,
} from "../../src/lib/invitation-preview-shape";
import { calendarDaysUntil } from "../../src/lib/datetime";
import {
  buildInviteLink,
  clearInviteCookieOptions,
  inviteCookieOptions,
  isValidInviteToken,
  readInviteToken,
} from "../../src/lib/invitations";

// Shared pieces for the invitation pages (#16) and the member page (#18).

const TOKEN = "a".repeat(64);

test.describe("invito: funzioni condivise", () => {
  test("S6: giorni di calendario a Roma, non blocchi di 24 ore", () => {
    const now = "2026-10-20T21:30:00Z"; // 23:30 a Roma
    expect(calendarDaysUntil("2026-10-20T22:30:00Z", now)).toBe(1); // 00:30 del 21
    expect(calendarDaysUntil("2026-10-26T10:00:00Z", now)).toBe(6);
    expect(calendarDaysUntil("2026-10-20T10:00:00Z", now)).toBe(0);
    expect(calendarDaysUntil("2026-10-19T10:00:00Z", now)).toBe(-1);
  });

  test("S3: formato del token e cookie", () => {
    expect(isValidInviteToken(TOKEN)).toBe(true);
    expect(isValidInviteToken("a".repeat(31))).toBe(false);
    expect(isValidInviteToken("A".repeat(64))).toBe(false);
    expect(isValidInviteToken("g".repeat(64))).toBe(false);
    expect(isValidInviteToken(undefined)).toBe(false);
    const cookies = (value?: string) => ({
      get: () => (value === undefined ? undefined : { value }),
    });
    expect(readInviteToken(cookies(TOKEN))).toBe(TOKEN);
    expect(readInviteToken(cookies("x"))).toBeNull();
    expect(readInviteToken(cookies())).toBeNull();
    expect(buildInviteLink("https://example.org/", TOKEN)).toBe(
      `https://example.org/invito/${TOKEN}`,
    );
  });

  test("S3: opzioni del cookie, maxAge tra 1 e 86400", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const origin = "https://example.org";
    const normal = inviteCookieOptions(origin, null, now);
    expect(normal).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 86400,
    });
    expect(inviteCookieOptions("http://localhost:3000")?.secure).toBe(false);
    expect(
      inviteCookieOptions(origin, "2026-10-20T12:00:00Z", now)?.maxAge,
    ).toBe(7200);
    expect(
      inviteCookieOptions(origin, "2026-10-30T12:00:00Z", now)?.maxAge,
    ).toBe(86400);
    expect(
      inviteCookieOptions(origin, "2026-10-20T10:00:01Z", now)?.maxAge,
    ).toBe(1);
    // Expired, expiring now or within the second: no cookie at all.
    expect(inviteCookieOptions(origin, "2026-10-20T10:00:00Z", now)).toBeNull();
    expect(
      inviteCookieOptions(origin, "2026-10-20T10:00:00.900Z", now),
    ).toBeNull();
    expect(inviteCookieOptions(origin, "2026-10-19T10:00:00Z", now)).toBeNull();
    // A date that cannot be read is ignored: the cookie lasts 24 hours.
    expect(inviteCookieOptions(origin, "non-una-data", now)?.maxAge).toBe(
      86400,
    );
  });

  test("S3: il cookie si cancella con una scadenza passata, senza maxAge", () => {
    const cleared = clearInviteCookieOptions("https://example.org");
    expect(cleared.expires.getTime()).toBe(0);
    expect(cleared).not.toHaveProperty("maxAge");
    expect(cleared).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
  });

  test("S5: next accetta /invito/colore e mai /invito/<token>", () => {
    expect(safeNextPath("/invito/colore")).toBe("/invito/colore");
    expect(safeNextPath("/invito/colore?x=1")).toBe("/invito/colore?x=1");
    expect(safeNextPath("/invito")).toBe("/invito");
    expect(safeNextPath(`/invito/${TOKEN}`)).toBeNull();
    expect(safeNextPath(`/invito/${TOKEN}?a=1`)).toBeNull();
    expect(safeNextPath("/invito/colore/altro")).toBeNull();
    expect(safeNextPath("/invito/")).toBeNull();
    expect(safeNextPath("/invito/%63olore/x")).toBeNull();
    expect(safeNextPath("/oggi/../invito/" + TOKEN)).toBeNull();
    expect(safeNextPath("/invito/./" + TOKEN)).toBeNull();
    expect(safeNextPath("/oggi")).toBe("/oggi");
  });

  test("S5: startOAuthSignIn rifiuta next vietati prima di toccare la finestra", async () => {
    const g = globalThis as Record<string, unknown>;
    const original = {
      navigator: Object.getOwnPropertyDescriptor(g, "navigator"),
      window: Object.getOwnPropertyDescriptor(g, "window"),
    };
    let touched = 0;
    Object.defineProperty(g, "navigator", {
      value: { onLine: true },
      configurable: true,
    });
    Object.defineProperty(g, "window", {
      value: {
        get location() {
          touched += 1;
          return { origin: "https://example.org" };
        },
      },
      configurable: true,
    });
    try {
      for (const next of [
        `/invito/${TOKEN}`,
        "https://evil.example/x",
        "//evil.example",
        "/auth/signout",
        "",
      ]) {
        expect(await startOAuthSignIn("google", { next })).toBe("failed");
      }
      expect(touched).toBe(0);
      // A path that is allowed does go on (and fails later: no Supabase here).
      await startOAuthSignIn("google", { next: "/invito/colore" });
      expect(touched).toBe(1);
    } finally {
      for (const [key, d] of Object.entries(original)) {
        if (d) Object.defineProperty(g, key, d);
        else delete g[key];
      }
    }
  });

  test("S4: l'anteprima senza nomi non porta mai i nomi dei membri", () => {
    const row: PreviewRow = {
      status: "valid",
      household_name: "Rossi",
      inviter_name: "Laura",
      message: null,
      invitee_name: "Marco",
      invitee_color: "glicine",
      expires_at: "2026-10-27T10:00:00Z",
      members: [
        { initial: "L", color: "pomodoro", name: "Laura" },
        { initial: "S", color: "salvia", name: null },
      ],
    };
    const plain = shapePreview(row, false);
    if (plain.status !== "valid") throw new Error("expected valid");
    expect(plain.members).toEqual([
      { initial: "L", color: "pomodoro" },
      { initial: "S", color: "salvia" },
    ]);
    expect(JSON.stringify(plain)).not.toContain('Laura"}');
    expect(JSON.stringify(plain.members)).not.toContain("name");
    const named = shapePreview(row, true);
    if (named.status !== "valid") throw new Error("expected valid");
    expect(named.members).toEqual([
      { initial: "L", color: "pomodoro", name: "Laura" },
      { initial: "S", color: "salvia" },
    ]);
    expect(shapePreview(undefined, false)).toEqual({ status: "error" });
    expect(shapePreview({ ...row, status: "expired" }, true)).toEqual({
      status: "invalid",
    });
  });

  test("S5: testi di errore dell'accesso", () => {
    expect(accessErrorText({ provider: "google", cancelled: false })).toBe(
      "Accesso con Google non riuscito. Controlla la connessione e riprova.",
    );
    expect(accessErrorText({ provider: "apple", cancelled: true })).toBe(
      "Accesso con Apple annullato. Riprova o scegli un altro modo per entrare.",
    );
    expect(accessErrorText({ provider: null, cancelled: false })).toBe(
      "Accesso non riuscito. Controlla la connessione e riprova.",
    );
  });

  test("ColorChoice: ordine scelto, liberi, presi", () => {
    expect(
      chosenFirstOrder("glicine", [
        { color: "pomodoro" },
        { color: "salvia" },
        { color: "cobalto" },
        { color: "zafferano" },
      ]),
    ).toEqual([
      "glicine",
      "lampone",
      "ceruleo",
      "peonia",
      "basilico",
      "cannella",
      "pomodoro",
      "salvia",
      "cobalto",
      "zafferano",
    ]);
    expect(chosenFirstOrder(null, [])).toHaveLength(10);
  });
});

test.describe("invito: /auth/callback con il cookie dell'invito (S2)", () => {
  const cookie = `familynest_invito=${TOKEN}`;

  test("errore del fornitore porta a /invito", async ({ request }) => {
    const response = await request.get(
      "/auth/callback?provider=google&error=server_error",
      { headers: { cookie }, maxRedirects: 0 },
    );
    expect(response.status()).toBe(303);
    const location = new URL(response.headers()["location"]!);
    expect(location.pathname + location.search).toBe("/invito?errore=google");
  });

  test("accesso annullato aggiunge annullato=1", async ({ request }) => {
    const response = await request.get(
      "/auth/callback?provider=apple&error=access_denied",
      { headers: { cookie }, maxRedirects: 0 },
    );
    const location = new URL(response.headers()["location"]!);
    expect(location.pathname + location.search).toBe(
      "/invito?errore=apple&annullato=1",
    );
    expect(response.headers()["location"]).not.toContain(TOKEN);
  });

  test("senza cookie resta /accesso", async ({ request }) => {
    const response = await request.get(
      "/auth/callback?provider=google&error=server_error",
      { maxRedirects: 0 },
    );
    const location = new URL(response.headers()["location"]!);
    expect(location.pathname + location.search).toBe("/accesso?errore=google");
  });

  test("cookie malformato conta come assente", async ({ request }) => {
    const response = await request.get(
      "/auth/callback?provider=google&error=server_error",
      { headers: { cookie: "familynest_invito=non-valido" }, maxRedirects: 0 },
    );
    const location = new URL(response.headers()["location"]!);
    expect(location.pathname).toBe("/accesso");
  });

  test("POST /auth/invito/annulla cancella il cookie senza maxAge", async ({
    request,
  }) => {
    const response = await request.post("/auth/invito/annulla", {
      headers: { cookie },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    const setCookie = response.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("familynest_invito=;");
    expect(setCookie).toMatch(/expires=Thu, 01 Jan 1970/i);
    expect(setCookie).not.toMatch(/max-age/i);
    expect(response.headers()["location"]).not.toContain(TOKEN);
  });

  test("GET /auth/invito/annulla risponde 405", async ({ request }) => {
    const response = await request.get("/auth/invito/annulla", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(405);
  });

  test("POST da un altro sito è rifiutato", async ({ request }) => {
    const response = await request.post("/auth/invito/annulla", {
      headers: { origin: "https://evil.example" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
  });
});
