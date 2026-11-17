import { expect, test } from "@playwright/test";
import { buildSecurityHeaders } from "../../src/lib/security-headers";

const STANDARD: Record<string, string> = {
  "content-security-policy":
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
};

test.describe("Intestazioni di protezione", () => {
  for (const path of [
    "/",
    "/accesso",
    "/oggi",
    "/profilo",
    "/invito",
    "/desideri/codice-di-prova",
  ]) {
    test(`${path} risponde con le sei intestazioni`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      const headers = response.headers();
      for (const [name, value] of Object.entries(STANDARD)) {
        if (path.startsWith("/desideri/") && name === "referrer-policy") {
          expect(headers[name]).toBe("no-referrer");
        } else {
          expect(headers[name], `${name} su ${path}`).toBe(value);
        }
      }
    });
  }

  test("la pagina pubblica dei desideri mantiene le sue intestazioni", async ({
    request,
  }) => {
    const headers = (
      await request.get("/desideri/codice-di-prova", { maxRedirects: 0 })
    ).headers();
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["cache-control"]).toContain("no-store");
  });

  for (const path of [
    "/invito/chiudi",
    "/invito/token-di-prova",
    "/calendari-collegati/ritorno/google",
  ]) {
    test(`${path} mantiene no-referrer`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    });
  }

  test("POST su /calendari-collegati/collega/google senza sessione mantiene no-referrer", async ({
    request,
  }) => {
    const response = await request.post("/calendari-collegati/collega/google", {
      maxRedirects: 0,
    });
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  });

  test("/invito/colore resta con la politica standard", async ({ request }) => {
    const response = await request.get("/invito/colore", { maxRedirects: 0 });
    expect(response.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  for (const path of ["/auth/confirm", "/accesso/conferma-mail"]) {
    test(`${path} mantiene same-origin e no-store`, async ({ request }) => {
      const headers = (await request.get(path, { maxRedirects: 0 })).headers();
      expect(headers["referrer-policy"]).toBe("same-origin");
      expect(headers["cache-control"]).toContain("no-store");
    });
  }

  test("una pagina esterna non può incorniciare /oggi", async ({
    page,
    baseURL,
  }) => {
    await page.route("https://esterna.test/", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><title>Esterna</title><iframe id="f" src="${baseURL}/oggi"></iframe>`,
      }),
    );
    await page.goto("https://esterna.test/");
    const iframe = page.locator("#f");
    await expect(iframe).toBeAttached();
    const handle = await iframe.elementHandle();
    const frame = await handle?.contentFrame();
    expect(frame, "il frame deve esistere").toBeTruthy();
    await expect
      .poll(() => frame!.url())
      .toMatch(/^(chrome-error:|about:blank)/);
    await expect(frame!.locator("main, h1")).toHaveCount(0);
  });

  test("il noindex delle anteprime c'è solo con VERCEL_ENV=preview", () => {
    const keys = (env?: string) =>
      buildSecurityHeaders(env).map((header) => header.key);
    expect(keys("preview")).toContain("X-Robots-Tag");
    expect(
      buildSecurityHeaders("preview").find((h) => h.key === "X-Robots-Tag")
        ?.value,
    ).toBe("noindex, nofollow");
    for (const env of ["production", "development", "", undefined]) {
      expect(keys(env)).not.toContain("X-Robots-Tag");
    }
    expect(keys("production")).toHaveLength(6);
  });
});
