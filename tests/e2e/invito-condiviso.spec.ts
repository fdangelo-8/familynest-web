import { expect, test } from "@playwright/test";
import { chosenFirstOrder } from "../../src/components/ui/ColorChoice/ColorChoice";
import { accessErrorText } from "../../src/lib/auth/oauth";
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

  test("S3: opzioni del cookie", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    const normal = inviteCookieOptions("https://example.org", null, now);
    expect(normal).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
    expect(normal.expires.toISOString()).toBe("2026-10-21T10:00:00.000Z");
    expect(inviteCookieOptions("http://localhost:3000").secure).toBe(false);
    const sooner = inviteCookieOptions(
      "https://example.org",
      "2026-10-20T12:00:00Z",
      now,
    );
    expect(sooner.expires.toISOString()).toBe("2026-10-20T12:00:00.000Z");
    const later = inviteCookieOptions(
      "https://example.org",
      "2026-10-30T12:00:00Z",
      now,
    );
    expect(later.expires.toISOString()).toBe("2026-10-21T10:00:00.000Z");
    expect(
      clearInviteCookieOptions("https://example.org").expires.getTime(),
    ).toBe(0);
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
});
