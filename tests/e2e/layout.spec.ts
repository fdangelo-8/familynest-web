import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  PLACEHOLDERS,
  getActiveNavItem,
  getActiveSettingsItem,
  getBarConfig,
  hasBottomNav,
} from "../../src/lib/app-routes";

// Layout and navigation (#10). These tests need no test users: public
// routes, redirects without a session, placeholders and pure rules.
// The tests with signed-in users depend on the test users (#55).

const PROTECTED_ROUTES = [
  "/oggi",
  "/aggiungi",
  "/calendario",
  "/casa/spesa",
  "/nest",
  "/notifiche",
  "/ricerca",
  "/profilo",
  "/calendari-collegati",
  "/impostazioni",
  "/membri",
];

test.describe("sessione", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`CA-1: senza sessione ${route} porta a /accesso`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/accesso$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Accesso" }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(0);
    });
  }

  test("CA-2: un cookie di sessione alterato porta a /accesso", async ({
    page,
    context,
    baseURL,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
    const projectRef = new URL(supabaseUrl!).hostname.split(".")[0]!;
    await context.addCookies([
      {
        name: `sb-${projectRef}-auth-token`,
        value: "valore-non-valido",
        url: baseURL!,
      },
    ]);
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso$/);
    await expect(page.locator("body")).not.toContainText("Casa D'Angelo");
    await expect(page.locator("body")).not.toContainText("Casa Bianchi");
  });

  test("CA-4: senza sessione / e /casa finiscono su /accesso", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/accesso$/);
    await page.goto("/casa");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-5: non esiste un middleware", () => {
    expect(existsSync("middleware.ts")).toBe(false);
    expect(existsSync("src/middleware.ts")).toBe(false);
  });
});

test.describe("pagine fuori dalla cornice", () => {
  test("/accesso: un solo h1, un solo main, nessuna navigazione", async ({
    page,
  }) => {
    const response = await page.goto("/accesso");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Accesso");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Accesso" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("/onboarding: segnaposto senza cornice", async ({ page }) => {
    const response = await page.goto("/onboarding");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("FamilyNest · Chi vive con te?");
    await expect(
      page.getByRole("heading", { level: 1, name: "Chi vive con te?" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByText("In arrivo")).toBeVisible();
  });
});

test.describe("regole di navigazione (funzioni pure)", () => {
  test("voce attiva su mobile", () => {
    const mobile = (path: string) => getActiveNavItem(path, "mobile");
    expect(mobile("/oggi")).toBe("oggi");
    expect(mobile("/aggiungi")).toBe("oggi");
    expect(mobile("/calendario")).toBe("calendario");
    expect(mobile("/calendario/mese")).toBe("calendario");
    expect(mobile("/impegni/abc")).toBe("calendario");
    expect(mobile("/casa/spesa")).toBe("casa");
    expect(mobile("/casa/scadenze")).toBe("casa");
    expect(mobile("/notifiche")).toBe("oggi");
    expect(mobile("/esplora/palestra")).toBe("oggi");
    expect(mobile("/figli/sofia")).toBe("oggi");
    expect(mobile("/ricerca")).toBeNull();
    expect(mobile("/nest")).toBeNull();
  });

  test("voce attiva su desktop", () => {
    const desktop = (path: string) => getActiveNavItem(path, "desktop");
    expect(desktop("/oggi")).toBe("oggi");
    expect(desktop("/aggiungi")).toBe("oggi");
    expect(desktop("/ricerca")).toBe("oggi");
    expect(desktop("/calendario")).toBe("calendario");
    expect(desktop("/casa/spesa")).toBe("casa");
    for (const path of [
      "/nest",
      "/notifiche",
      "/esplora/palestra",
      "/figli/sofia",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ]) {
      expect(desktop(path)).toBeNull();
    }
  });

  test("il prefisso non confonde rotte simili", () => {
    expect(getActiveNavItem("/casalinga", "mobile")).toBeNull();
    expect(getActiveSettingsItem("/membri-extra")).toBeNull();
  });

  test("navigazione in basso", () => {
    for (const path of [
      "/oggi",
      "/aggiungi",
      "/calendario",
      "/casa/spesa",
      "/notifiche",
    ]) {
      expect(hasBottomNav(path)).toBe(true);
    }
    for (const path of [
      "/nest",
      "/ricerca",
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ]) {
      expect(hasBottomNav(path)).toBe(false);
    }
  });

  test("menu laterale delle impostazioni", () => {
    expect(getActiveSettingsItem("/profilo")).toBe("profilo");
    expect(getActiveSettingsItem("/calendari-collegati")).toBe(
      "calendari-collegati",
    );
    expect(getActiveSettingsItem("/impostazioni")).toBe("impostazioni");
    expect(getActiveSettingsItem("/membri/laura")).toBe("membri");
    expect(getActiveSettingsItem("/oggi")).toBeNull();
  });

  test("forma della barra in alto", () => {
    expect(getBarConfig("/oggi")).toEqual({
      kind: "section",
      center: "lens",
      right: "bell",
    });
    expect(getBarConfig("/calendario")).toEqual({
      kind: "section",
      center: "lens",
      right: "search",
    });
    expect(getBarConfig("/casa/spesa")).toEqual({
      kind: "section",
      center: "title",
      right: "search",
    });
    expect(getBarConfig("/nest")).toEqual({ kind: "close", href: "/oggi" });
    expect(getBarConfig("/profilo")).toEqual({
      kind: "detail",
      fallback: "/nest",
    });
    expect(getBarConfig("/notifiche")).toEqual({
      kind: "detail",
      fallback: "/oggi",
    });
  });

  test("ogni segnaposto ha titolo e titolo del browser", () => {
    for (const def of Object.values(PLACEHOLDERS)) {
      expect(def.browserTitle).toBe(
        def.title === "Casa"
          ? "FamilyNest · Casa · Spesa"
          : `FamilyNest · ${def.title}`,
      );
    }
  });
});
