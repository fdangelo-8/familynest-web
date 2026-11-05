import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  card,
  failRequests,
  hrefOf,
  holdRequests,
  linkOf,
  openEsplora,
  seedClient,
  SOLO,
  toast,
  waitHydrated,
  withNest,
} from "../fixtures/esplora";
import {
  askButton,
  barPin,
  desktopLink,
  errorAlert,
  INTEREST_READ,
  notFoundTitle,
  openSpace,
  rowsList,
  spaceTitle,
} from "../fixtures/esplora-spazio";
import { SPACES } from "../../src/lib/spaces";

// Esplora · «In arrivo» (#29): access, content, loading, error, navigation and
// privacy of the page `/esplora/<spazio>`. Criteria CA-1 ... CA-7, CA-18,
// CA-23 ... CA-29 and CA-35 (reads of the page, frame excluded). The seed users (Marco, Giulia, Paolo, the user
// without a Nest) are only read; the tests that write are in
// esplora-spazio-avvisami.spec.ts and use throwaway users.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const isMobile = (project: string) => project === "mobile";

const PROMISES: Record<string, string> = Object.fromEntries(
  SPACES.map((space) => [space.name, space.promise]),
);
PROMISES["Crescere"] = "Tutto su Sofia e Tommaso, in un posto solo.";
PROMISES["Zampe"] = "Per Biscotto e per chi ha quattro zampe.";

const SUFFIX = " Stiamo preparando questo spazio.";

const MEAL_ROWS = [
  "Il piano dei pasti della settimana",
  "Ricette adatte a chi vive con te",
  "La spesa che si scrive da sola",
];

const paragraph = (page: Page, text: string) =>
  page.getByRole("main").getByText(text, { exact: true });

// ------------------------------------------------------------ access, content

test.describe("accesso", () => {
  test("CA-1: senza sessione /esplora/a-tavola porta a /accesso", async ({
    page,
  }) => {
    await page.goto("/esplora/a-tavola");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-2: l'utente C, senza Nest, viene portato su /onboarding", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("C"), skipReason("C"));
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto("/esplora/a-tavola");
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

test.describe("contenuto", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
  });

  test("CA-3: A tavola ha titolo, promessa, tre righe non cliccabili e «Avvisami» non registrato", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openSpace(page, "A tavola");
    await expect(page).toHaveTitle("FamilyNest · A tavola");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(spaceTitle(page, "A tavola")).toBeVisible();
    await expect(
      page.getByRole("main").getByText("In arrivo", { exact: true }),
    ).toBeVisible();
    await expect(
      paragraph(
        page,
        "Cosa mangiamo questa settimana, senza pensarci ogni sera. Stiamo preparando questo spazio.",
      ),
    ).toBeVisible();
    await expect(rowsList(page)).toHaveCount(1);
    const items = rowsList(page).getByRole("listitem");
    await expect(items).toHaveText(MEAL_ROWS);
    await expect(items.locator("a, button")).toHaveCount(0);
    await expect(askButton(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("CA-4: i 10 indirizzi mostrano nome, promessa di Esplora e bottone; solo A tavola ha l'elenco", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    for (const space of SPACES) {
      await openSpace(page, space.name);
      await expect(spaceTitle(page, space.name)).toBeVisible();
      await expect(
        page.getByRole("main").getByText("In arrivo", { exact: true }),
      ).toBeVisible();
      await expect(
        paragraph(page, `${PROMISES[space.name]}${SUFFIX}`),
      ).toBeVisible();
      await expect(askButton(page)).toBeVisible();
      await expect(rowsList(page)).toHaveCount(
        space.name === "A tavola" ? 1 : 0,
      );
    }
  });

  test("CA-5: un indirizzo che non è uno spazio mostra «Questa pagina non c’è», senza «Avvisami»", async ({
    page,
    baseURL,
  }) => {
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/esplora/non-esiste");
    await expect(notFoundTitle(page)).toBeVisible();
    await expect(askButton(page)).toHaveCount(0);
  });

  for (const [user, who] of [
    ["B", "Giulia"],
    ["B2", "Paolo"],
  ] as const) {
    test(`CA-6: ${who} (Casa Bianchi, senza animali) non vede Zampe e legge Leo in Crescere`, async ({
      page,
      baseURL,
    }) => {
      await signInAs(page.context(), baseURL as string, user);
      await page.goto("/esplora/zampe");
      await expect(notFoundTitle(page)).toBeVisible();
      await expect(askButton(page)).toHaveCount(0);
      await expect(barPin(page)).toHaveCount(0);

      await openSpace(page, "Crescere");
      await expect(
        paragraph(
          page,
          "Tutto su Leo, in un posto solo. Stiamo preparando questo spazio.",
        ),
      ).toBeVisible();
    });
  }
});

test("CA-7: in un Nest «Solo io» quattro spazi non ci sono e Progetti sì", async ({
  page,
  baseURL,
}) => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  await withNest(SOLO, async (ctx) => {
    await ctx.signIn(page, baseURL);
    for (const name of ["Noi due", "Conti chiari", "Crescere", "Zampe"]) {
      await page.goto(hrefOf(name));
      await expect(notFoundTitle(page)).toBeVisible();
      await expect(askButton(page)).toHaveCount(0);
    }
    await openSpace(page, "Progetti");
    await expect(spaceTitle(page, "Progetti")).toBeVisible();
    await expect(askButton(page)).toBeVisible();
  });
});

// ------------------------------------------------------------------- puntina

test.describe("puntina e disposizione", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-18: su mobile la barra ha «Indietro» e la puntina non premuta, senza «Cerca nel Nest»", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Caso a 390 px");
    await signInAs(page.context(), baseURL as string, "A");
    await openSpace(page, "A tavola");
    const bar = page.locator("header.barra");
    await expect(bar.getByRole("link", { name: "Indietro" })).toBeVisible();
    await expect(barPin(page)).toHaveCount(1);
    await expect(barPin(page)).toHaveAttribute("aria-pressed", "false");
    await expect(
      bar.getByRole("button", { name: "Fissa A tavola in Oggi", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cerca nel Nest" }),
    ).toHaveCount(0);
    await expect(toast(page)).toHaveCount(0);
  });

  test("CA-23: su desktop non c'è nessuna puntina", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(isMobile(testInfo.project.name), "Caso a 1280 px");
    await signInAs(page.context(), baseURL as string, "A");
    await openSpace(page, "A tavola");
    await expect(
      page.getByRole("button", { name: "Fissa A tavola in Oggi" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Togli A tavola da Oggi" }),
    ).toHaveCount(0);
  });
});

// ------------------------------------------------------------ loading, error

test.describe("caricamento ed errore", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-24: durante la lettura il testo fisso si vede, l'area è occupata e mancano bottone e puntina", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Caso a 390 px");
    await signInAs(page.context(), baseURL as string, "A");
    const hold = await holdRequests(page, INTEREST_READ);
    const busy = page
      .locator('[aria-busy="true"]')
      .filter({ hasText: "Caricamento in corso" });
    try {
      // `commit`: the answer of the page must not wait for the held read
      await page.goto("/esplora/a-tavola", { waitUntil: "commit" });
      await expect(spaceTitle(page, "A tavola")).toBeVisible();
      await expect(
        page.getByRole("main").getByText("In arrivo", { exact: true }),
      ).toBeVisible();
      await expect(
        paragraph(
          page,
          "Cosa mangiamo questa settimana, senza pensarci ogni sera. Stiamo preparando questo spazio.",
        ),
      ).toBeVisible();
      await expect(rowsList(page).getByRole("listitem")).toHaveCount(3);
      await expect(busy).toHaveCount(1);
      await expect(askButton(page)).toHaveCount(0);
      await expect(barPin(page)).toHaveCount(0);
    } finally {
      hold.release();
    }
    await expect(askButton(page)).toBeVisible({ timeout: 20_000 });
    await expect(barPin(page)).toBeVisible();
    await expect(busy).toHaveCount(0);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("CA-25: se la lettura fallisce c'è un avviso con «Riprova», non la pagina d'errore; riprovare riporta il bottone", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Caso a 390 px");
    await signInAs(page.context(), baseURL as string, "A");
    // only the read of the table of the interests fails
    await failRequests(page, INTEREST_READ);
    await page.goto("/esplora/a-tavola");
    await expect(errorAlert(page)).toBeVisible({ timeout: 30_000 });
    await expect(errorAlert(page)).toHaveText(
      /Non riusciamo a caricare le tue scelte per A tavola\. Controlla la connessione e riprova\./,
    );
    await expect(spaceTitle(page, "A tavola")).toBeVisible();
    await expect(
      paragraph(
        page,
        "Cosa mangiamo questa settimana, senza pensarci ogni sera. Stiamo preparando questo spazio.",
      ),
    ).toBeVisible();
    await expect(rowsList(page).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("Questa pagina non si è caricata")).toHaveCount(
      0,
    );
    await expect(askButton(page)).toHaveCount(0);
    await expect(barPin(page)).toHaveCount(0);

    const retry = errorAlert(page).getByRole("button", { name: "Riprova" });
    await expect(retry).toBeVisible();
    await page.unroute(INTEREST_READ);
    await waitHydrated(retry);
    await retry.click();
    await expect(askButton(page)).toBeVisible({ timeout: 20_000 });
    await expect(errorAlert(page)).toHaveCount(0);
    await expect(askButton(page)).toBeFocused();
  });
});

// ----------------------------------------------------- navigation, disposition

test.describe("navigazione e disposizione", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A"), skipReason("A"));
  });

  test("CA-26: da Esplora alla scheda e «Indietro»; in basso «Oggi» è evidenziata e c'è «Aggiungi»", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Caso a 390 px");
    await signInAs(page.context(), baseURL as string, "A");
    await openEsplora(page, 10);
    await linkOf(page, "A tavola").click();
    await expect(page).toHaveURL(/\/esplora\/a-tavola$/);
    await expect(spaceTitle(page, "A tavola")).toBeVisible();
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
    const back = page.getByRole("link", { name: "Indietro" });
    await waitHydrated(back);
    await back.click();
    await expect(page).toHaveURL(/\/esplora$/);
    await expect(card(page, "A tavola")).toBeVisible();
  });

  test("CA-27: aperta direttamente, «Indietro» porta a /esplora", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Caso a 390 px");
    await signInAs(page.context(), baseURL as string, "A");
    await openSpace(page, "A tavola");
    const back = page.getByRole("link", { name: "Indietro" });
    await waitHydrated(back);
    await back.click();
    await expect(page).toHaveURL(/\/esplora$/);
  });

  test("CA-28: il link «← Esplora» è su desktop, largo la colonna e centrato; su mobile non c'è", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInAs(page.context(), baseURL as string, "A");
    await openSpace(page, "A tavola");
    if (isMobile(testInfo.project.name)) {
      await expect(desktopLink(page)).toBeHidden();
      return;
    }
    const nav = page.getByRole("navigation", {
      name: "Navigazione principale",
    });
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
    const link = desktopLink(page);
    await expect(link).toBeVisible();
    await expect(
      page.getByRole("main").locator("a[href='/esplora']"),
    ).toHaveCount(1);
    await expect(link).toHaveAccessibleName("Esplora");
    await expect(link.locator("[aria-hidden='true']")).toHaveText("←");

    const linkBox = await link.boundingBox();
    const columnBox = await page.locator("div.spazio-arrivo").boundingBox();
    if (!linkBox || !columnBox) throw new Error("Elemento senza riquadro");
    expect(Math.abs(linkBox.width - columnBox.width)).toBeLessThanOrEqual(1);

    // centre of the visible content of the link (arrow and text together)
    const contentCentre = await link.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    expect(
      Math.abs(contentCentre - (linkBox.x + linkBox.width / 2)),
    ).toBeLessThanOrEqual(2);

    await waitHydrated(link);
    await link.click();
    await expect(page).toHaveURL(/\/esplora$/);
  });

  test("CA-29: su mobile, in una pagina che non c'è nessuna voce in basso è evidenziata", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Caso a 390 px");
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto("/esplora/non-esiste");
    await expect(notFoundTitle(page)).toBeVisible();
    const nav = page.getByRole("navigation", {
      name: "Navigazione principale",
    });
    await expect(nav).toBeVisible();
    await expect(nav.locator("[aria-current]")).toHaveCount(0);
  });
});

// ------------------------------------------------------------------- privacy

test("CA-35: le letture della pagina di Crescere non portano date di nascita, colori, altri nomi né dati degli account", async ({
  page,
  baseURL,
}) => {
  test.skip(!usersConfigured("A"), skipReason("A"));
  // The name and colour of the members shown by the common frame (the square
  // of the Nest) are allowed (decision of the coordinator, #29): this test
  // looks at what the page reads by itself (REST calls of the browser) and at
  // the content of `main`, not at the whole document.
  const marco = await seedClient("A");
  const { data: kids } = await marco
    .from("household_members")
    .select("birth_date")
    .eq("kind", "child");
  const dates = (kids ?? [])
    .map((row) => row.birth_date as string | null)
    .filter((value): value is string => !!value);

  const bodies: Promise<{ url: string; text: string }>[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/rest/v1/")) {
      bodies.push(
        response.text().then(
          (text) => ({ url: response.url(), text }),
          () => ({ url: response.url(), text: "" }),
        ),
      );
    }
  });
  await signInAs(page.context(), baseURL as string, "A");
  await openSpace(page, "Crescere");
  await expect(
    paragraph(
      page,
      "Tutto su Sofia e Tommaso, in un posto solo. Stiamo preparando questo spazio.",
    ),
  ).toBeVisible();
  const responses = await Promise.all(bodies);
  expect(responses.length).toBeGreaterThan(0);
  // the page reads the names of the children and nothing else of the members
  expect(
    responses.some(({ url }) => url.includes("/rest/v1/household_members")),
  ).toBe(true);
  const leaks: string[] = [];
  for (const { url, text } of responses) {
    for (const needle of [
      "birth_date",
      "color",
      "user_id",
      "Laura",
      "Biscotto",
      ...dates,
    ]) {
      const at = text.indexOf(needle);
      if (at >= 0) {
        leaks.push(
          `${url} contiene «${needle}»: …${text.slice(Math.max(0, at - 60), at + 60)}…`,
        );
      }
    }
  }
  expect(leaks).toEqual([]);
  const mainText = await page.getByRole("main").innerText();
  for (const needle of ["Laura", "Biscotto", "birth_date", ...dates]) {
    expect(mainText).not.toContain(needle);
  }
});
