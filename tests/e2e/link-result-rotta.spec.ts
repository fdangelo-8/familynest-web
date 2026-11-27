import { expect, test } from "@playwright/test";

// The route that deletes the cookie of the way back from a calendar provider
// (#590): a POST from the same address deletes it, one from another site or
// with no Origin is refused with 403. The answer is never cached.
test.describe("rotta /api/calendar-sync/link-result", () => {
  test("stesso indirizzo: 204, cookie cancellato, niente cache", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post("/api/calendar-sync/link-result", {
      headers: { origin: new URL(baseURL as string).origin },
    });
    expect(response.status()).toBe(204);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"] ?? "").toContain(
      "fn-calendar-link=;",
    );
  });

  test("altro sito o Origin mancante: 403, nessun cookie toccato", async ({
    request,
  }) => {
    const foreign = await request.post("/api/calendar-sync/link-result", {
      headers: { origin: "https://altro-sito.example" },
    });
    expect(foreign.status()).toBe(403);
    expect(foreign.headers()["cache-control"]).toBe("no-store");
    expect(foreign.headers()["set-cookie"]).toBeUndefined();

    const missing = await request.post("/api/calendar-sync/link-result");
    expect(missing.status()).toBe(403);
    expect(missing.headers()["set-cookie"]).toBeUndefined();
  });
});
