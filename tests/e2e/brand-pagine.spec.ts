import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BRAND } from "@/lib/brand";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { isMobileProject } from "../fixtures/invito";
import { linkOf } from "../fixtures/invito-ingresso";
import { openProfile, signOutButton, signOutDialog } from "../fixtures/profilo";

// The product name in one place (#502): what people see (CA-6 ... CA-11,
// CA-14 ... CA-17). Seed: Nest A «Casa D'Angelo» (Marco, Laura), Nest B
// «Casa Bianchi» (Giulia, Paolo).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const needsUsers = (...keys: Parameters<typeof usersConfigured>) =>
  test.skip(!usersConfigured(...keys), skipReason(...keys));

const visibleMark = (page: Page) =>
  page.getByRole("img", { name: BRAND.full }).filter({ visible: true });

const originOf = (baseURL: string | undefined) =>
  new URL(baseURL as string).origin;

/** Console errors and page errors of the i18n kind collected while a page loads. */
function collectI18nErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test.describe("marchio", () => {
  test("CA-6: /accesso a 390 px ha un solo marchio «familynest» con pesi 400 e 700, senza il quadrato dei pallini", async ({
    page,
  }) => {
    test.skip(!isMobileProject(), "Il criterio riguarda 390×844");
    await page.goto("/accesso");
    const mark = visibleMark(page);
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveText("familynest");
    await expect(mark.getByText("family", { exact: true })).toHaveCSS(
      "font-weight",
      "400",
    );
    await expect(mark.getByText("nest", { exact: true })).toHaveCSS(
      "font-weight",
      "700",
    );
    await expect(page.locator(".quadrato-nest")).toHaveCount(0);
  });

  test("CA-7: Marco su /oggi a 1280 px ha nella barra in alto il link «FamilyNest» col marchio, verso /oggi", async ({
    page,
    baseURL,
  }) => {
    test.skip(isMobileProject(), "Barra in alto solo da computer (1280 px)");
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/oggi");
    const link = page
      .getByRole("link", { name: BRAND.full, exact: true })
      .filter({ visible: true });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", "/oggi");
    await expect(link.getByRole("img", { name: BRAND.full })).toBeVisible();
    await expect(link).toContainText("familynest");
  });

  test("CA-8: l'esempio «Il nome» della galleria mostra marchio, «Entra in FamilyNest», «Chiedi a Nest» e «Energia di Nest»", async ({
    page,
  }) => {
    await page.goto("/design-system");
    const example = page.getByTestId("il-nome");
    await expect(example.getByRole("img", { name: BRAND.full })).toBeVisible();
    await expect(example.getByText("Entra in FamilyNest")).toBeVisible();
    await expect(example.getByText("Chiedi a Nest")).toBeVisible();
    await expect(example.getByText("Energia di Nest")).toBeVisible();
  });
});

test.describe("testi e titoli invariati", () => {
  test("CA-9: i titoli del browser restano quelli di prima", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    const titles: [string, string][] = [
      ["/oggi", "FamilyNest · Oggi"],
      ["/calendario", "FamilyNest · Calendario"],
      ["/casa/spesa", "FamilyNest · Casa · Spesa"],
      ["/nest", "FamilyNest · Il tuo Nest"],
      ["/calendari-collegati", "FamilyNest · Calendari collegati"],
    ];
    for (const [path, title] of titles) {
      await page.goto(path);
      await expect(page, path).toHaveTitle(title);
    }
  });

  test("CA-10: /accesso ha descrizione e nome dell'applicazione nell'head", async ({
    page,
  }) => {
    await page.goto("/accesso");
    await expect(page.locator("meta[name=description]")).toHaveAttribute(
      "content",
      "FamilyNest — l'organizer per la tua famiglia",
    );
    await expect(page.locator("meta[name=application-name]")).toHaveAttribute(
      "content",
      "FamilyNest",
    );
  });

  test("CA-11: calendari collegati e dialogo «Esci» leggono come prima", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/calendari-collegati");
    await expect(
      page
        .getByText(
          "Scegli quali calendari portare in FamilyNest e cosa vedono gli altri.",
          { exact: true },
        )
        .filter({ visible: true }),
    ).toBeVisible();

    await openProfile(page);
    await signOutButton(page).click();
    await expect(signOutDialog(page)).toBeVisible();
    await expect(
      signOutDialog(page).getByText("Uscire da FamilyNest?", { exact: true }),
    ).toBeVisible();
  });

  test("CA-14: il file «I tuoi dati» si chiama familynest-i-tuoi-dati-<data>.json", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    await signInAs(page.context(), baseURL as string, "A");
    const response = await page.request.post("/profilo/dati");
    expect(response.status()).toBe(200);
    const disposition = response.headers()["content-disposition"] ?? "";
    expect(disposition).toMatch(
      new RegExp(`filename="${BRAND.slug}-i-tuoi-dati-[^"]*\\.json"`),
    );
  });
});

test.describe("errori, isolamento, accessibilità", () => {
  test("CA-15: nessun testo o titolo mostra «{app}» o «{nest}» e nessun messaggio perde un parametro", async ({
    page,
    baseURL,
  }) => {
    needsUsers("A");
    const errors = collectI18nErrors(page);
    const check = async (path: string) => {
      await page.goto(path);
      await expect(page.locator("body"), path).not.toContainText(
        /\{app\}|\{nest\}/,
      );
      expect(await page.title(), path).not.toMatch(/\{app\}|\{nest\}/);
    };

    for (const path of [
      "/accesso",
      "/privacy",
      linkOf(originOf(baseURL), randomBytes(32).toString("hex")),
    ])
      await check(path);

    await signInAs(page.context(), baseURL as string, "A");
    for (const path of [
      "/oggi",
      "/calendario",
      "/casa/spesa",
      "/nest",
      "/calendari-collegati",
    ])
      await check(path);

    expect(errors.filter((text) => /i18n: missing param/.test(text))).toEqual(
      [],
    );
  });

  test("CA-16: Paolo (Nest B) su /nest vede solo «Casa Bianchi» e i suoi membri", async ({
    page,
    baseURL,
  }) => {
    needsUsers("B2");
    await signInAs(page.context(), baseURL as string, "B2");
    await page.goto("/nest");
    const main = page.getByRole("main");
    await expect(main).toContainText("Casa Bianchi");
    await expect(main).toContainText("Giulia");
    await expect(main).toContainText("Paolo");
    await expect(main).not.toContainText(/D.Angelo/);
    await expect(main).not.toContainText("Marco");
    await expect(main).not.toContainText("Laura");
  });

  for (const path of ["/accesso", "/onboarding", "/design-system"]) {
    test(`CA-17: ${path} senza violazioni serious o critical e senza label-content-name-mismatch`, async ({
      page,
      baseURL,
    }) => {
      if (path === "/onboarding") {
        needsUsers("C");
        await signInAs(page.context(), baseURL as string, "C");
      }
      await page.goto(path);
      await expect(visibleMark(page).first()).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
      expect(
        results.violations.filter(
          (v) => v.id === "label-content-name-mismatch",
        ),
      ).toEqual([]);
    });
  }
});
