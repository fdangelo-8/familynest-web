import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  busy,
  card,
  cards,
  CATALOGUE,
  errorBox,
  failRequests,
  FULL,
  grid,
  h1,
  holdRequests,
  hrefOf,
  isMobileProject,
  linkOf,
  openEsplora,
  PATH,
  PINNED_READ,
  pins,
  retryButton,
  seedClient,
  SOLO,
  toast,
  waitHydrated,
  withNest,
} from "../fixtures/esplora";
import { SPACES } from "../../src/lib/spaces";

// Esplora (#28): access, structure, catalogue, loading, error, navigation and
// layout. Criteria CA-1 ... CA-10 and CA-25 ... CA-29, CA-33 of the issue (with
// the decisions of the coordinator of 31/10). The seed users (Marco, Giulia,
// the user without a Nest) are only read; the Nests with other members are
// throwaway. Fixing and removing are in esplora-fissare.spec.ts, the isolation
// between Nests in esplora-isolamento.spec.ts.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const PROMISES = Object.fromEntries(
  SPACES.map((space) => [space.name, space.promise]),
);
PROMISES["Crescere"] = "Tutto su Sofia e Tommaso, in un posto solo.";
PROMISES["Zampe"] = "Per Biscotto e per chi ha quattro zampe.";

const SOLO_NAMES = [
  "A tavola",
  "Stare bene",
  "Tempo insieme",
  "Passioni",
  "Casa in ordine",
  "Progetti",
];

async function openAs(
  page: Page,
  baseURL: string | undefined,
  user: "A" | "B",
  count: number,
) {
  await signInAs(page.context(), baseURL as string, user);
  await openEsplora(page, count);
}

// ------------------------------------------------------- access and structure

test.describe("accesso", () => {
  test("CA-1: senza sessione /esplora porta a /accesso", async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-2: l'utente C, senza Nest, viene portato su /onboarding", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("C"), skipReason("C"));
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

test.describe("struttura", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
  });

  test("CA-3: titolo della scheda, un solo h1 e i testi dell'intestazione", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A", 10);
    await expect(page).toHaveTitle("FamilyNest · Esplora");
    await expect(h1(page)).toHaveCount(1);
    await expect(h1(page)).toHaveAccessibleName("Cosa può fare la vostra casa");
    await expect(
      page.getByRole("main").getByText("Esplora", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Scegli gli spazi che vi servono. Con la puntina li fissi in fondo a Oggi.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("CA-4: la griglia è una lista di 10 voci, nell'ordine, con nome e promessa", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A", 10);
    await expect(grid(page)).toHaveCount(1);
    await expect(cards(page)).toHaveCount(10);
    for (const [index, name] of CATALOGUE.entries()) {
      const item = cards(page).nth(index);
      await expect(item.getByText(name, { exact: true })).toBeVisible();
      await expect(item).toContainText(PROMISES[name]!);
    }
    await expect(cards(page).nth(8)).toContainText(
      "Tutto su Sofia e Tommaso, in un posto solo.",
    );
    await expect(cards(page).nth(9)).toContainText(
      "Per Biscotto e per chi ha quattro zampe.",
    );
  });

  test("CA-5: Crescere ha gli avatar S e T, Zampe ha B, tutti aria-hidden", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A", 10);
    const children = card(page, "Crescere").locator(".avatar");
    await expect(children).toHaveText(["S", "T"]);
    const pets = card(page, "Zampe").locator(".avatar");
    await expect(pets).toHaveText(["B"]);
    for (const avatar of [...(await children.all()), ...(await pets.all())]) {
      await expect(avatar).toHaveAttribute("aria-hidden", "true");
    }
    // the other spaces have no avatars
    await expect(card(page, "A tavola").locator(".avatar")).toHaveCount(0);
  });

  test("CA-6: ogni voce ha un link col nome dello spazio e l'indirizzo giusto; il tocco apre la pagina", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A", 10);
    for (const name of CATALOGUE) {
      const link = linkOf(page, name);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", hrefOf(name));
      await expect(link).toHaveAccessibleName(new RegExp(`^${name}`));
    }
    await expect(linkOf(page, "A tavola")).toHaveAttribute(
      "href",
      "/esplora/a-tavola",
    );
    await expect(linkOf(page, "Casa in ordine")).toHaveAttribute(
      "href",
      "/esplora/casa-in-ordine",
    );
    await linkOf(page, "A tavola").click();
    await expect(page).toHaveURL(/\/esplora\/a-tavola$/);
  });

  test("CA-7: stato vuoto, 10 puntine non premuti fuori dai link e nessun toast", async ({
    page,
    baseURL,
  }) => {
    await openAs(page, baseURL, "A", 10);
    await expect(pins(page)).toHaveCount(10);
    for (const name of CATALOGUE) {
      const button = page.getByRole("button", {
        name: `Fissa ${name} in Oggi`,
        exact: true,
      });
      await expect(button).toHaveCount(1);
      await expect(button).toHaveAttribute("aria-pressed", "false");
    }
    // the pin is never inside a link
    await expect(grid(page).locator("a button, a [role='button']")).toHaveCount(
      0,
    );
    await expect(toast(page)).toHaveCount(0);
  });
});

// ---------------------------------------------------- spaces shown by the Nest

test.describe("spazi secondo la casa", () => {
  test("CA-8: Giulia (Casa Bianchi) vede 9 spazi, senza Zampe, Crescere con Leo", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("B"), skipReason("B"));
    await openAs(page, baseURL, "B", 9);
    await expect(cards(page)).toHaveCount(9);
    await expect(grid(page).getByText("Zampe", { exact: true })).toHaveCount(0);
    await expect(
      grid(page).getByText("Noi due", { exact: true }),
    ).toBeVisible();
    await expect(card(page, "Crescere")).toContainText(
      "Tutto su Leo, in un posto solo.",
    );
    await expect(card(page, "Crescere").locator(".avatar")).toHaveText(["L"]);
  });

  test("CA-9: un Nest «Solo io» ha 6 spazi, senza Noi due, Conti chiari, Crescere e Zampe", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 6);
      for (const [index, name] of SOLO_NAMES.entries()) {
        await expect(
          cards(page).nth(index).getByText(name, { exact: true }),
        ).toBeVisible();
      }
      for (const name of ["Noi due", "Conti chiari", "Crescere", "Zampe"]) {
        await expect(grid(page).getByText(name, { exact: true })).toHaveCount(
          0,
        );
      }
    });
  });

  test("CA-10: gli adulti senza account contano e i nomi seguono l'ordine di inserimento", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await expect(cards(page)).toHaveCount(10);
      await expect(card(page, "Noi due")).toBeVisible();
      await expect(card(page, "Conti chiari")).toBeVisible();
      await expect(card(page, "Crescere")).toContainText(
        "Tutto su Anna, Bea e Carlo, in un posto solo.",
      );
      await expect(card(page, "Zampe")).toContainText(
        "Per Fido, Micia e per chi ha quattro zampe.",
      );
      await expect(card(page, "Crescere").locator(".avatar")).toHaveText([
        "A",
        "B",
        "C",
      ]);
      await expect(card(page, "Zampe").locator(".avatar")).toHaveText([
        "F",
        "M",
      ]);
    });
  });
});

// ------------------------------------------------------------- loading, error

test.describe("caricamento ed errore", () => {
  test("CA-25: durante la lettura si vedono h1 e scheletri, nessuna puntina; poi le 10 voci", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    const hold = await holdRequests(page, PINNED_READ);
    try {
      // `commit`: the answer of the page must not wait for the held read
      await page.goto(PATH, { waitUntil: "commit" });
      await expect(h1(page)).toBeVisible();
      await expect(busy(page)).toHaveCount(1);
      await expect(busy(page)).toHaveAttribute("aria-busy", "true");
      await expect(busy(page)).toHaveAttribute("aria-live", "polite");
      await expect(busy(page)).toContainText("Caricamento in corso");
      await expect(busy(page).locator(".skeleton--scheda")).toHaveCount(6);
      await expect(page.getByRole("button", { name: /Oggi$/ })).toHaveCount(0);
      for (const name of CATALOGUE) {
        await expect(
          page.getByRole("link", { name: new RegExp(`^${name}`) }),
        ).toHaveCount(0);
      }
    } finally {
      hold.release();
    }
    await expect(cards(page)).toHaveCount(10, { timeout: 20_000 });
    await expect(busy(page)).toHaveCount(0);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-26: se la lettura fallisce c'è la pagina d'errore; «Riprova» mostra il catalogo", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await failRequests(page, PINNED_READ);
    await page.goto(PATH);
    await expect(errorBox(page)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Questa pagina non si è caricata"),
    ).toBeVisible();
    await expect(retryButton(page)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Torna a Oggi" }),
    ).toHaveAttribute("href", "/oggi");
    await expect(pins(page)).toHaveCount(0);
    await expect(h1(page)).toBeVisible();
    // the fault is removed: only that request was intercepted
    await page.unroute(PINNED_READ);
    await waitHydrated(retryButton(page));
    await retryButton(page).click();
    await expect(cards(page)).toHaveCount(10, { timeout: 20_000 });
    await expect(errorBox(page)).toHaveCount(0);
  });
});

// ------------------------------------------------------------ navigation, grid

test.describe("navigazione e disposizione", () => {
  test("CA-27: da /nest, su mobile: barra con Indietro e Cerca, navigazione in basso; Indietro torna a /nest", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), "Caso a 390 px");
    test.skip(!usersConfigured("A"), skipReason("A"));
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/nest");
    const door = page.getByRole("link", { name: /Esplora.*Cosa può fare/ });
    await expect(door).toBeVisible();
    await door.click();
    await expect(page).toHaveURL(/\/esplora$/);
    await expect(cards(page)).toHaveCount(10, { timeout: 20_000 });
    await expect(page.getByRole("link", { name: "Indietro" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cerca nel Nest" }),
    ).toHaveAttribute("href", "/ricerca");
    const nav = page.getByRole("navigation", {
      name: "Navigazione principale",
    });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Oggi" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(
      page
        .getByRole("link", { name: "Aggiungi" })
        .or(page.getByRole("button", { name: "Aggiungi" }))
        .first(),
    ).toBeVisible();
    await waitHydrated(pins(page).first());
    await page.getByRole("link", { name: "Indietro" }).click();
    await expect(page).toHaveURL(/\/nest$/);
  });

  test("CA-28: su mobile, aperta direttamente, Indietro porta a /nest", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), "Caso a 390 px");
    test.skip(!usersConfigured("A"), skipReason("A"));
    await openAs(page, baseURL, "A", 10);
    await waitHydrated(pins(page).first());
    await page.getByRole("link", { name: "Indietro" }).click();
    await expect(page).toHaveURL(/\/nest$/);
  });

  test("CA-29: disposizione, desktop a due colonne con griglia a destra; mobile a due colonne", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await openAs(page, baseURL, "A", 10);
    const box = async (locator: Locator) => {
      const found = await locator.boundingBox();
      if (!found) throw new Error("Elemento senza riquadro");
      return found;
    };
    const a = await box(card(page, "A tavola"));
    const b = await box(card(page, "Noi due"));
    const c = await box(card(page, "Stare bene"));
    if (isMobileProject(testInfo.project.name)) {
      // Noi due and Stare bene together, on the row below A tavola
      expect(b.y).toBeGreaterThan(a.y + a.height - 1);
      expect(Math.abs(b.y - c.y)).toBeLessThan(2);
      expect(c.x).toBeGreaterThan(b.x);
    } else {
      const nav = page.getByRole("navigation", {
        name: "Navigazione principale",
      });
      await expect(nav.locator("[aria-current]")).toHaveCount(0);
      const title = await box(h1(page));
      const gridBox = await box(grid(page));
      expect(gridBox.x).toBeGreaterThan(title.x + title.width);
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      expect(Math.abs(b.y - c.y)).toBeLessThan(2);
    }
  });
});

// ------------------------------------------------------------------- privacy

test.describe("privacy", () => {
  test("CA-33: le risposte di rete non contengono birth_date né le date di nascita dei figli", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    // The dates of the two children, read by Marco himself (he is the
    // administrator): they must not travel to the page of Esplora.
    const marco = await seedClient("A");
    const { data: kids } = await marco
      .from("household_members")
      .select("name, birth_date")
      .eq("kind", "child");
    const dates = (kids ?? [])
      .map((row) => row.birth_date as string | null)
      .filter((value): value is string => !!value);

    const bodies: Promise<string>[] = [];
    page.on("response", (response) => {
      bodies.push(response.text().catch(() => ""));
    });
    await signInAs(page.context(), baseURL as string, "A");
    await openEsplora(page, 10);
    await waitHydrated(pins(page).first());
    const texts = await Promise.all(bodies);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).not.toContain("birth_date");
      for (const date of dates) expect(text).not.toContain(date);
    }
  });
});
