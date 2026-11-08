import { type Page } from "@playwright/test";
import { expect, greeting, sec, test } from "../fixtures/oggi";
import {
  card,
  cards,
  grid,
  linkOf,
  pinFix,
  pinRemove,
  pins,
  toast,
  undoButton,
  waitHydrated,
  keyOf,
} from "../fixtures/esplora";
import {
  askButton,
  doneButton,
  openSpace,
  spaceTitle,
} from "../fixtures/esplora-spazio";
import { NOT_FOUND, h1 } from "../fixtures/figlio";
import {
  notificationsSection,
  peopleSection,
  switchOf,
} from "../fixtures/impostazioni-ca";
import { contextLike, goTo } from "../fixtures/percorso-casa";

// Percorso di Esplora e delle impostazioni della casa (#307): dal Nest a
// Esplora, due spazi fissati in Oggi, l'avviso «quando è pronto» di uno spazio,
// uno spazio tolto; poi le impostazioni della casa (chi c'è, una notifica che
// si accende e resta) e, per finire, un adulto di un'altra casa che non vede e
// non raggiunge niente di tutto questo.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const NEST = "Casa D'Angelo";
const SPACES_REGION = "I tuoi spazi";

/** From Today to the page of the Nest, through the square of the bar. */
async function openNest(page: Page): Promise<void> {
  await page.getByRole("link", { name: new RegExp(`^Apri ${NEST}`) }).click();
  await expect(page).toHaveURL(/\/nest$/);
  await expect(h1(page)).toHaveText(NEST);
}

async function waitToday(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: greeting }),
  ).toBeVisible({ timeout: 20_000 });
  // Only what the person sees: the router keeps the pages it left hidden
  // (`display: none`, React Activity), and a hidden copy of Esplora can sit on
  // its skeleton because its effects do not run while it is hidden.
  await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0);
}

test.describe("percorso di Esplora e delle impostazioni", () => {
  test("percorso: fisso due spazi, chiedo l'avviso, ne tolgo uno, cambio una notifica; un'altra casa non vede niente", async ({
    page,
    browser,
    baseURL,
    casa,
    bianchi,
  }) => {
    test.setTimeout(300_000);
    const marco = casa.users["Marco"]!;
    const pinned = async () => {
      const { data, error } = await marco.client
        .from("pinned_spaces")
        .select("space")
        .order("pinned_at", { ascending: true });
      if (error) throw new Error("Lettura degli spazi fissati fallita");
      return (data ?? []).map((row) => row.space);
    };

    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/oggi");
    await waitToday(page);
    await expect(sec(page, SPACES_REGION)).toHaveCount(0);

    // ---- Dal Nest a Esplora: le dieci voci, nessuna fissata
    await openNest(page);
    await page.getByRole("link", { name: /Esplora.*Cosa può fare/ }).click();
    await expect(page).toHaveURL(/\/esplora$/);
    await expect(cards(page)).toHaveCount(10, { timeout: 20_000 });
    await waitHydrated(pins(page).first());
    await expect(grid(page).locator('button[aria-pressed="true"]')).toHaveCount(
      0,
    );

    // ---- Fisso «A tavola» e «Crescere»
    await pinFix(page, "A tavola").click();
    await expect(pinRemove(page, "A tavola")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(toast(page)).toContainText(
      "A tavola fissato in fondo a Oggi.",
    );
    await expect(undoButton(page)).toBeVisible();
    await pinFix(page, "Crescere").click();
    await expect(pinRemove(page, "Crescere")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(pinned).toEqual([keyOf("A tavola"), keyOf("Crescere")]);

    // ---- La scheda di «A tavola»: «Avvisami quando è pronto»
    await linkOf(page, "A tavola").click();
    await expect(page).toHaveURL(/\/esplora\/a-tavola$/);
    await expect(spaceTitle(page, "A tavola")).toBeVisible();
    const ask = askButton(page);
    await expect(ask).toBeVisible({ timeout: 20_000 });
    await waitHydrated(ask);
    await expect(ask).toHaveAttribute("aria-pressed", "false");
    await ask.click();
    await expect(doneButton(page)).toHaveAttribute("aria-pressed", "true");
    await expect(
      toast(page, "Ti avvisiamo quando A tavola è pronto."),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await marco.admin
          .from("space_interests")
          .select("member_id, space")
          .eq("household_id", casa.householdId);
        return data ?? [];
      })
      .toEqual([
        { member_id: casa.members["Marco"], space: keyOf("A tavola") },
      ]);

    // ---- Oggi: «I tuoi spazi» ha i due spazi fissati, «In arrivo»
    await goTo(page, "Oggi", /\/oggi$/);
    await waitToday(page);
    const spaces = sec(page, SPACES_REGION);
    await expect(spaces).toBeVisible({ timeout: 20_000 });
    const meals = spaces.getByRole("link", { name: /A tavola/ });
    await expect(meals).toContainText("In arrivo");
    await expect(meals).toHaveAttribute("href", "/esplora/a-tavola");
    await expect(
      spaces.getByRole("link", { name: /Crescere/ }),
    ).toHaveAttribute("href", "/esplora/crescere");

    // ---- Torno in Esplora da «Modifica» e tolgo «A tavola»
    await spaces.getByRole("link", { name: "Modifica i tuoi spazi" }).click();
    await expect(page).toHaveURL(/\/esplora$/);
    await expect(cards(page)).toHaveCount(10, { timeout: 20_000 });
    await waitHydrated(pins(page).first());
    await expect(pinRemove(page, "A tavola")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pinRemove(page, "A tavola").click();
    await expect(pinFix(page, "A tavola")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(toast(page)).toContainText("A tavola tolto da Oggi.");
    await expect.poll(pinned).toEqual([keyOf("Crescere")]);
    await goTo(page, "Oggi", /\/oggi$/);
    await waitToday(page);
    await expect(
      sec(page, SPACES_REGION).getByRole("link", { name: /Crescere/ }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      sec(page, SPACES_REGION).getByRole("link", { name: /A tavola/ }),
    ).toHaveCount(0);

    // ---- Impostazioni della casa: chi c'è e una notifica che resta accesa
    await openNest(page);
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Impostazioni della casa/ })
      .click();
    await expect(page).toHaveURL(/\/impostazioni$/);
    await expect(h1(page)).toHaveText(NEST);
    await expect(
      peopleSection(page).locator("ul > li .riga-lista__titolo"),
    ).toHaveText(["Marco, tu", "Laura", "Sofia", "Tommaso", "Biscotto"]);
    const shopping = switchOf(page, "Spesa");
    await waitHydrated(shopping);
    await expect(shopping).toHaveAttribute("aria-checked", "false");
    await shopping.click();
    await expect(shopping).toHaveAttribute("aria-checked", "true");
    const savedChoice = async () => {
      const { data } = await marco.admin
        .from("notification_preferences")
        .select("shopping")
        .eq("member_id", casa.members["Marco"]!)
        .maybeSingle();
      return data?.shopping ?? null;
    };
    await expect.poll(savedChoice).toBe(true);
    await page.reload();
    await expect(h1(page)).toHaveText(NEST);
    await waitHydrated(switchOf(page, "Spesa"));
    await expect(switchOf(page, "Spesa")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(notificationsSection(page).getByRole("switch")).toHaveCount(5);

    // ---- Isolamento: un adulto di un'altra casa non vede e non raggiunge niente
    const context = await contextLike(browser, baseURL, page);
    try {
      await bianchi.signInContext(context, baseURL, "Giulia");
      const other = await context.newPage();

      await other.goto("/esplora");
      await expect(cards(other)).toHaveCount(9, { timeout: 20_000 });
      await expect(card(other, "Zampe")).toHaveCount(0);
      await waitHydrated(pins(other).first());
      await expect(
        grid(other).locator('button[aria-pressed="true"]'),
      ).toHaveCount(0);

      await openSpace(other, "A tavola");
      await expect(askButton(other)).toHaveAttribute("aria-pressed", "false");
      await expect(doneButton(other)).toHaveCount(0);

      await other.goto("/oggi");
      await waitToday(other);
      await expect(sec(other, SPACES_REGION)).toHaveCount(0);

      await other.goto("/impostazioni");
      await expect(h1(other)).toHaveText("Casa Bianchi");
      await waitHydrated(switchOf(other, "Spesa"));
      await expect(switchOf(other, "Spesa")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      const html = await (await other.request.get("/impostazioni")).text();
      for (const forbidden of [
        /Casa D(?:'|&#x27;|&#39;|\\u0027)Angelo/,
        /\bMarco\b/,
        /\bLaura\b/,
        /\bSofia\b/,
        /\bTommaso\b/,
        /\bBiscotto\b/,
      ]) {
        expect(html, String(forbidden)).not.toMatch(forbidden);
      }

      // Per indirizzo diretto: i membri della casa di Marco non ci sono.
      for (const path of [
        `/membri/${casa.members["Laura"]}`,
        `/membri/${casa.members["Biscotto"]}`,
        `/figli/${casa.members["Sofia"]}`,
      ]) {
        await other.goto(path);
        await expect(h1(other), path).toHaveText(NOT_FOUND);
      }
    } finally {
      await context.close();
    }

    // Con la sua sessione Giulia non legge né cambia le scelte di Marco.
    const giulia = bianchi.users["Giulia"]!.client;
    for (const table of [
      "pinned_spaces",
      "space_interests",
      "notification_preferences",
    ]) {
      const read = await giulia
        .from(table)
        .select("member_id")
        .eq("member_id", casa.members["Marco"]!);
      expect(read.error, table).toBeNull();
      expect(read.data ?? [], table).toEqual([]);
    }
    await giulia
      .from("notification_preferences")
      .update({ shopping: false })
      .eq("member_id", casa.members["Marco"]!);
    await giulia
      .from("pinned_spaces")
      .delete()
      .eq("member_id", casa.members["Marco"]!);
    await expect.poll(savedChoice).toBe(true);
    expect(await pinned()).toEqual([keyOf("Crescere")]);
  });
});
