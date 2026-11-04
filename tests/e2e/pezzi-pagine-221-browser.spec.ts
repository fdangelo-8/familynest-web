import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  clearSessionCookies,
  DELETE_COOKIE_OPTIONS,
  isSessionCookie,
} from "../../src/lib/auth/session-cookies";

// Shared pieces of request #221 that need a browser: the notice on /accesso
// (point 5, R3) and the examples of the design system gallery (points 1, 4, 7,
// 11). The pure functions are in pezzi-pagine-221.spec.ts.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DELETED = "Il tuo account è stato eliminato.";

function deletedNotice(page: Page) {
  return page.getByRole("status").filter({ hasText: DELETED });
}

test.describe("avviso su /accesso dopo l'eliminazione dell'account (#38, R3)", () => {
  test.beforeEach(() => {
    test.skip(!supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL non impostato");
  });

  test("?account=eliminato mostra l'avviso calmo, non un errore", async ({
    page,
  }) => {
    await page.goto("/accesso?account=eliminato");
    await expect(deletedNotice(page)).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: DELETED }),
    ).toHaveCount(0);
  });

  test("senza il parametro, o con un altro valore, l'avviso non c'è", async ({
    page,
  }) => {
    await page.goto("/accesso");
    await expect(
      page.getByRole("button", { name: /Google/ }).first(),
    ).toBeVisible();
    await expect(deletedNotice(page)).toHaveCount(0);

    await page.goto("/accesso?account=altro");
    await expect(
      page.getByRole("button", { name: /Google/ }).first(),
    ).toBeVisible();
    await expect(deletedNotice(page)).toHaveCount(0);
  });

  test("l'avviso non porta dati personali nell'indirizzo", async ({ page }) => {
    await page.goto("/accesso?account=eliminato");
    await expect(deletedNotice(page)).toBeVisible();
    expect(new URL(page.url()).search).toBe("?account=eliminato");
  });
});

test.describe("galleria: pezzi delle pagine (#221)", () => {
  test("gli esempi si vedono solo con ?pezzi-pagine=1", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByTestId("sezione-ancora")).toHaveCount(0);

    await page.goto("/design-system?pezzi-pagine=1");
    await expect(page.getByTestId("sezione-ancora")).toHaveCount(1);
  });

  test("overflow-wrap: un nome lungo del profilo va a capo", async ({
    page,
  }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const head = page.getByTestId("profilo-testa-azione");
    await expect(head).toBeVisible();
    for (const selector of [".t-titolo-pagina", ".intestazione__sotto"]) {
      await expect(head.locator(selector)).toHaveCSS(
        "overflow-wrap",
        "anywhere",
      );
    }
  });

  test("modulo-gruppo: colonna sola, il gruppo di sezione ha il filo e il rientro", async ({
    page,
  }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const form = page.getByTestId("modulo-gruppi");
    await expect(form).toBeVisible();
    await expect(form).toHaveCSS("display", "grid");
    const section = form.locator(".modulo-gruppo--sezione");
    await expect(section).toHaveCSS("display", "grid");
    const padding = await section.evaluate((el) =>
      parseFloat(getComputedStyle(el).paddingTop),
    );
    expect(padding).toBeGreaterThan(0);
    await expect(section).not.toHaveCSS("box-shadow", "none");
  });

  test("campo-doppio--tre: tre colonne uguali", async ({ page }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const row = page.getByTestId("campo-doppio-tre");
    await expect(row).toBeVisible();
    const columns = await row.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(" ")
        .map((value) => parseFloat(value)),
    );
    expect(columns).toHaveLength(3);
    // fractional widths can differ by a hundredth of a pixel
    expect(Math.max(...columns) - Math.min(...columns)).toBeLessThan(1);
  });

  test("sezione--ancora: si ferma sotto la barra (scroll-margin-top)", async ({
    page,
  }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const anchored = page.getByTestId("sezione-ancora");
    await expect(anchored).toBeAttached();
    const margin = await anchored.evaluate((el) =>
      parseFloat(getComputedStyle(el).scrollMarginTop),
    );
    expect(margin).toBeGreaterThan(40);
  });

  test("profilo-testa__azione: nascosta sotto 1024 px, visibile da 1024 px", async ({
    page,
  }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const action = page
      .getByTestId("profilo-testa-azione")
      .getByRole("button", { name: "Modifica il profilo di Sofia" });
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (wide) {
      await expect(action).toBeVisible();
    } else {
      await expect(action).toBeHidden();
    }
  });

  test("spazio-arrivo__desktop: il link «Esplora» si vede solo da 1024 px", async ({
    page,
  }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const link = page
      .getByTestId("spazio-arrivo")
      .getByRole("link", { name: /Esplora/ });
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (wide) {
      await expect(link).toBeVisible();
    } else {
      await expect(link).toBeHidden();
    }
  });

  test("skeleton--bottone: ha l'altezza di un'azione", async ({ page }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const group = page.getByTestId("skeleton-bottone");
    await expect(group).toBeAttached();
    const shape = group.locator(".skeleton--bottone");
    await expect(shape).toHaveCount(1);
    const height = await shape.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(height).toBeGreaterThanOrEqual(44);
  });

  test("sezione__link: area di tocco di almeno 44 px", async ({ page }) => {
    await page.goto("/design-system?pezzi-pagine=1");
    const link = page
      .getByTestId("sezione-link")
      .getByRole("link", { name: "Vedi nel calendario" });
    await expect(link).toBeVisible();
    const height = await link.evaluate((el) =>
      parseFloat(getComputedStyle(el, "::before").height),
    );
    expect(height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("BarAction: la prop pressed (#29)", () => {
  test("pressed arriva al bottone come aria-pressed", () => {
    const source = readFileSync(
      "src/components/ui/AppFrame/BarAction.tsx",
      "utf8",
    );
    expect(source).toContain("pressed?: boolean");
    expect(source).toContain("pressed={action.pressed}");
    const button = readFileSync(
      "src/components/ui/IconButton/IconButton.tsx",
      "utf8",
    );
    expect(button).toContain("aria-pressed={pressed}");
  });
});

test.describe("cookie di sessione condivisi tra «Esci» e «Elimina l'account»", () => {
  test("riconosce solo i cookie di sessione di Supabase", () => {
    for (const name of [
      "sb-abc-auth-token",
      "sb-abc-auth-token.0",
      "sb-abc-auth-token.12",
      "sb-abc-auth-token-code-verifier",
    ]) {
      expect(isSessionCookie(name), name).toBe(true);
    }
    for (const name of ["theme", "sb-abc-other", "xsb-abc-auth-token-x"]) {
      expect(isSessionCookie(name), name).toBe(false);
    }
  });

  test("la cancellazione ha una scadenza passata e lo stesso path", () => {
    expect(DELETE_COOKIE_OPTIONS.path).toBe("/");
    expect(DELETE_COOKIE_OPTIONS.expires.getTime()).toBe(0);
    const set: Array<[string, string, unknown]> = [];
    const request = {
      cookies: {
        getAll: () => [
          { name: "sb-abc-auth-token.0", value: "x" },
          { name: "theme", value: "y" },
        ],
      },
    };
    const response = {
      cookies: {
        set: (name: string, value: string, options: unknown) =>
          set.push([name, value, options]),
      },
    };
    clearSessionCookies(request as never, response as never);
    expect(set).toEqual([["sb-abc-auth-token.0", "", DELETE_COOKIE_OPTIONS]]);
  });
});
