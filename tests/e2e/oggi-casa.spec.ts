import type { Page } from "@playwright/test";
import { isMobileProject } from "../fixtures/casa";
import { withNest, SOLO } from "../fixtures/esplora";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  chooseLens,
  d,
  expect,
  lensButton,
  open,
  reopen,
  sec,
  test,
  type CasaNest,
} from "../fixtures/oggi";

// Oggi (#30): «Nel Nest», «Casa», la spesa in tempo reale e «I tuoi spazi»
// (CA-26 ... CA-30, CA-48, CA-49). The browser clock is stopped on Tuesday at
// 15:52 Rome, except in the real-time case, where the network needs time.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const SOFIA = "Rinnovo carta d'identità di Sofia";

/** The counters of «Casa» (`a.contatore`). */
const counters = (page: Page) => sec(page, "Casa").locator("a.contatore");

const spaceHeading = "I tuoi spazi";

async function nestLens(page: Page) {
  await chooseLens(page, "Nest");
  await expect(lensButton(page, "Nest")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(sec(page, "Casa")).toBeVisible();
}

test.describe("la spesa", () => {
  test("CA-26: con quattro cose «Nel Nest» ha la riga «Cose da comprare» e con la lente «Nest» il contatore «Spesa» ha il suo nome accessibile", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte", "pane", "mele", "uova"]);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const row = sec(page, "Nel Nest").getByRole("link", {
      name: /Cose da comprare/,
    });
    await expect(row).toBeVisible();
    await expect(row.locator(".riga-lista__ora")).toHaveText("4");
    await expect(row).toContainText("Latte, pane, mele e altro");
    await expect(row).toHaveAttribute("href", "/casa/spesa");

    await nestLens(page);
    const counter = sec(page, "Casa").getByRole("link", {
      name: /Spesa\s*4 cose da comprare:\s*Latte, pane, mele e altro/,
    });
    await expect(counter).toBeVisible();
    await expect(counter).toHaveAttribute("href", "/casa/spesa");
  });

  test("CA-26: con una sola cosa la riga dice «Cosa da comprare»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte"]);
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const row = sec(page, "Nel Nest").getByRole("link", {
      name: /Cosa da comprare/,
    });
    await expect(row).toBeVisible();
    await expect(row.locator(".riga-lista__titolo")).toHaveText(
      "Cosa da comprare",
    );
    await expect(row).toContainText("Latte");
  });

  test("CA-26: con la lista vuota il contatore «Spesa» mostra 0 e «La lista è vuota»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await open(page, baseURL, casa, "Marco", { lens: "nest" });
    const counter = counters(page).first();
    await expect(counter).toContainText("Spesa");
    await expect(counter.locator(".contatore__numero")).toContainText("0");
    await expect(counter).toContainText("La lista è vuota");
    await expect(counter).toHaveAttribute("href", "/casa/spesa");
  });

  test("CA-48: un'altra sessione aggiunge «Uova» e la riga «Cose da comprare» mostra 3 entro 5 secondi, senza ricaricare", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.shopping("Marco", ["Latte", "Pane"]);
    // Real time: the real-time channel needs the network, not a stopped clock.
    await open(page, baseURL, casa, "Marco", { lens: "io", pause: false });
    const row = sec(page, "Nel Nest").getByRole("link", {
      name: /Cose da comprare/,
    });
    await expect(row.locator(".riga-lista__ora")).toHaveText("2");
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    await casa.shopping("Marco", ["Uova"]);
    await expect(row.locator(".riga-lista__ora")).toHaveText("3", {
      timeout: 5000,
    });
    expect(navigations).toEqual([]);
  });
});

test.describe("le scadenze", () => {
  test("CA-27: una scadenza tra 5 giorni è in «Nel Nest» con i giorni, «Scade tra 5 giorni» e «urgente»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.deadline("Marco", { title: SOFIA, due: d(5) });
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    const row = sec(page, "Nel Nest").getByRole("link", {
      name: new RegExp(SOFIA),
    });
    await expect(row).toBeVisible();
    await expect(row.locator(".riga-lista__ora")).toHaveText("5");
    await expect(row).toContainText("Scade tra 5 giorni");
    await expect(row).toContainText("urgente");
    await expect(row).toHaveAttribute("href", "/casa/scadenze");
  });

  test("CA-27: tra 20 giorni la riga non c'è in «Nel Nest» e il contatore «Scadenza» mostra 20 senza «urgente»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await casa.deadline("Marco", { title: SOFIA, due: d(20) });
    await open(page, baseURL, casa, "Marco", { lens: "io" });
    await expect(sec(page, "Nel Nest")).toHaveCount(0);

    await nestLens(page);
    const counter = counters(page).nth(1);
    await expect(counter).toContainText("Scadenza");
    await expect(counter.locator(".contatore__numero")).toContainText("20");
    await expect(counter).toContainText(`giorni a «${SOFIA}»`);
    await expect(counter).not.toContainText("urgente");
    await expect(counter).toHaveAttribute("href", "/casa/scadenze");
  });
});

test.describe("casa", () => {
  async function threeTodos(casa: CasaNest) {
    for (const title of [
      "Pulire il garage",
      "Sistemare la cantina",
      "Dipingere",
    ]) {
      await casa.todo("Marco", { title, assignee: "Marco", due: d(8) });
    }
  }

  test("CA-29: con 3 da fare condivisi e due scadenze «Casa» ha 4 contatori su desktop e 2 su mobile", async ({
    page,
    baseURL,
    casa,
  }) => {
    await threeTodos(casa);
    await casa.deadline("Marco", { title: "Bollo auto", due: d(3) });
    await casa.deadline("Marco", { title: "Assicurazione", due: d(30) });
    await open(page, baseURL, casa, "Marco", { lens: "nest" });
    if (isMobileProject()) {
      await expect(counters(page)).toHaveCount(2);
      return;
    }
    await expect(counters(page)).toHaveCount(4);
    const third = counters(page).nth(2);
    await expect(third).toContainText("Da fare");
    await expect(third.locator(".contatore__numero")).toContainText("3");
    await expect(third).toHaveAttribute("href", "/casa/da-fare");
    await expect(counters(page).nth(3)).toContainText("Scadenza");
    await expect(counters(page).nth(3)).toHaveAttribute(
      "href",
      "/casa/scadenze",
    );
  });

  test("CA-29: con una sola scadenza i contatori sono 3 su desktop e 2 su mobile", async ({
    page,
    baseURL,
    casa,
  }) => {
    await threeTodos(casa);
    await casa.deadline("Marco", { title: "Bollo auto", due: d(3) });
    await open(page, baseURL, casa, "Marco", { lens: "nest" });
    await expect(counters(page)).toHaveCount(isMobileProject() ? 2 : 3);
  });

  test("CA-29: senza scadenze il contatore «Scadenza» dice «Nessuna scadenza in arrivo»", async ({
    page,
    baseURL,
    casa,
  }) => {
    await threeTodos(casa);
    await open(page, baseURL, casa, "Marco", { lens: "nest" });
    await expect(counters(page)).toHaveCount(isMobileProject() ? 2 : 3);
    await expect(counters(page).nth(1)).toContainText("Scadenza");
    await expect(counters(page).nth(1)).toContainText(
      "Nessuna scadenza in arrivo",
    );
  });
});

test.describe("i tuoi spazi", () => {
  test("CA-30: «I tuoi spazi» mostra «A tavola», la scheda «Esplora» con «Altri 5 spazi» e «Modifica»; Paolo, senza spazi fissati, non ha la sezione", async ({
    page,
    browser,
    baseURL,
    bianchi,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withNest(SOLO, async (ctx) => {
      await ctx.pinAll(["A tavola"]);
      await open(page, baseURL, ctx.nest, "Ilaria");
      const spaces = sec(page, spaceHeading);
      await expect(spaces).toBeVisible();
      const meals = spaces.getByRole("link", { name: /A tavola/ });
      await expect(meals).toContainText("In arrivo");
      await expect(meals).toHaveAttribute("href", "/esplora/a-tavola");
      const explore = spaces.getByRole("link", { name: /Esplora/ });
      await expect(explore).toContainText("Altri 5 spazi");
      await expect(explore).toHaveAttribute("href", "/esplora");
      const edit = spaces.getByRole("link", { name: "Modifica i tuoi spazi" });
      await expect(edit).toHaveText("Modifica");
      await expect(edit).toHaveAttribute("href", "/esplora");
    });

    const other = await browser.newContext({
      baseURL,
      viewport: page.viewportSize() ?? undefined,
      locale: "it-IT",
      timezoneId: "Europe/Rome",
    });
    try {
      const paolo = await other.newPage();
      await bianchi.signInContext(other, baseURL, "Paolo");
      await paolo.goto("/oggi");
      await expect(paolo.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: 20_000,
      });
      await expect(paolo.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(sec(paolo, spaceHeading)).toHaveCount(0);
    } finally {
      await other.close();
    }
  });

  test("CA-49: se lo spazio fissato non è più disponibile (il figlio è stato tolto) la sezione «I tuoi spazi» non c'è", async ({
    page,
    baseURL,
  }) => {
    test.skip(!throwawayConfigured(), throwawaySkipReason);
    await withNest(
      [
        { name: "Ilaria", kind: "adult", color: "pomodoro", account: true },
        { name: "Anna", kind: "child", color: "salvia" },
      ],
      async (ctx) => {
        await ctx.pinAll(["Crescere"]);
        await open(page, baseURL, ctx.nest, "Ilaria");
        // With the child in the Nest the space is there.
        await expect(
          sec(page, spaceHeading).getByRole("link", { name: /Crescere/ }),
        ).toBeVisible();

        const { error } = await ctx.user.admin
          .from("household_members")
          .delete()
          .eq("id", ctx.nest.members["Anna"]!);
        if (error) throw new Error("Figlio di prova non tolto");
        await reopen(page);
        await expect(sec(page, spaceHeading)).toHaveCount(0);
      },
    );
  });
});
