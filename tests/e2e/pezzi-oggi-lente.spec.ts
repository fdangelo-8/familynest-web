import { createClient } from "@supabase/supabase-js";
import { test as plain } from "@playwright/test";
import { createEvent } from "../fixtures/calendario";
import { expect, isMobileProject, setClock, test } from "../fixtures/casa";
import { LENS_LABEL } from "../fixtures/preferenze";

// Shared pieces for Oggi (issue #231): the accessible name of the «Occupato»
// block in the desktop week, the layout classes of the gallery and the starter
// list of the two seed Nests. The initial lens and the default visibility are in
// lente-iniziale.spec.ts and visibilita-predefinita.spec.ts.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

/** Tuesday 20 October 2026, 15:52 in Rome (CEST, UTC+2) */
const TODAY = new Date("2026-10-20T13:52:00Z");

test.describe("nome accessibile del blocco «Occupato» in DesktopWeek (#231)", () => {
  test("il blocco di un altro si legge per intero «Paolo ha un impegno, dalle 9:00 alle 15:00»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    test.skip(isMobileProject(), "DesktopWeek esiste solo da 1024 px");
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: "2026-10-20",
      from: "9:00",
      to: "15:00",
      visibility: "busy",
      location: "Ufficio Nord",
    });
    await createEvent(bianchi, "Paolo", {
      title: "Cena segreta",
      day: "2026-10-21",
      from: "18:00",
      to: "19:30",
      visibility: "busy",
    });
    await setClock(page, TODAY);
    await page.addInitScript(() =>
      window.sessionStorage.setItem("familynest.lens", "nest"),
    );
    await bianchi.signIn(page, baseURL, "Giulia");
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });

    // The whole text, not a part of it (exact match of the accessible name).
    for (const name of [
      "Paolo ha un impegno, dalle 9:00 alle 15:00",
      "Paolo ha un impegno, dalle 18:00 alle 19:30",
    ]) {
      const block = page.getByRole("group", { name, exact: true });
      await expect(block).toHaveCount(1);
      await expect(block).toBeVisible();
      await expect(block.locator(".blocco-orario__titolo")).toHaveText(
        "Occupato",
      );
      expect(await block.evaluate((el) => el.tagName)).not.toBe("A");
    }
    // Neither the title nor the place reach the page.
    await expect(page.getByText("Riunione segreta")).toHaveCount(0);
    await expect(page.getByText("Ufficio Nord")).toHaveCount(0);
    // Sanity: the lens switch of the page is the one we set.
    await expect(
      page.getByRole("group", { name: LENS_LABEL }).first(),
    ).toBeVisible();
  });

  test("isolamento: Casa D'Angelo non vede l'«Occupato» di Paolo (Casa Bianchi)", async ({
    page,
    baseURL,
    casa,
    bianchi,
  }) => {
    test.skip(isMobileProject(), "DesktopWeek esiste solo da 1024 px");
    await createEvent(bianchi, "Paolo", {
      title: "Riunione segreta",
      day: "2026-10-20",
      from: "9:00",
      to: "15:00",
      visibility: "busy",
    });
    await setClock(page, TODAY);
    await page.addInitScript(() =>
      window.sessionStorage.setItem("familynest.lens", "nest"),
    );
    await casa.signIn(page, baseURL, "Marco");
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("group", { name: /Paolo ha un impegno/ }),
    ).toHaveCount(0);
  });
});

plain.describe("galleria: classi di Oggi (#231)", () => {
  const url = "/design-system?pezzi-pagine=1";

  plain(
    "k) a 390 e a 1280 px: sotto 1024 si vede solo il mobile, da 1024 solo il desktop",
    async ({ page }) => {
      for (const [width, mobile] of [
        [390, true],
        [1280, false],
      ] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(url);
        const onMobile = page.getByTestId("oggi-solo-mobile");
        const onDesktop = page.getByTestId("oggi-solo-desktop");
        await expect(page.getByTestId("oggi-disposizioni")).toBeVisible();
        if (mobile) {
          await expect(onMobile).toBeVisible();
          await expect(onDesktop).toBeHidden();
          await expect(onDesktop).toHaveCSS("display", "none");
        } else {
          await expect(onDesktop).toBeVisible();
          await expect(onMobile).toBeHidden();
          await expect(onMobile).toHaveCSS("display", "none");
        }
      }
    },
  );

  plain(
    "k) il punto di rottura è 1024 px: a 1023 si vede il mobile, a 1024 il desktop",
    async ({ page }) => {
      await page.setViewportSize({ width: 1023, height: 800 });
      await page.goto(url);
      await expect(page.getByTestId("oggi-solo-mobile")).toBeVisible();
      await expect(page.getByTestId("oggi-solo-desktop")).toBeHidden();
      await page.setViewportSize({ width: 1024, height: 800 });
      await expect(page.getByTestId("oggi-solo-desktop")).toBeVisible();
      await expect(page.getByTestId("oggi-solo-mobile")).toBeHidden();
    },
  );

  plain(
    "k) .lista-partenza__passi è una griglia senza punti né rientro, con 4 px tra i passi",
    async ({ page }) => {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(url);
        const list = page.getByTestId("lista-passi");
        await expect(list).toBeVisible();
        await expect(list).toHaveCSS("display", "grid");
        await expect(list).toHaveCSS("list-style-type", "none");
        await expect(list).toHaveCSS("padding-left", "0px");
        await expect(list).toHaveCSS("padding-top", "0px");
        await expect(list).toHaveCSS("margin-top", "0px");
        await expect(list).toHaveCSS("margin-bottom", "0px");
        await expect(list).toHaveCSS("row-gap", "4px");
        await expect(list.getByRole("listitem")).toHaveCount(2);
      }
    },
  );
});

plain.describe("seed: lista di partenza completata (#231)", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const HOME_A = "11111111-1111-4111-8111-111111111111";
  const HOME_B = "22222222-2222-4222-8222-222222222222";

  plain.beforeEach(() => {
    plain.skip(!supabaseUrl || !secretKey, "Chiavi Supabase non impostate");
  });

  plain(
    "l) starter_list_completed_at è valorizzato in Casa D'Angelo e in Casa Bianchi",
    async () => {
      const admin = createClient(supabaseUrl!, secretKey!, {
        auth: { persistSession: false },
      });
      const { data, error } = await admin
        .from("households")
        .select("id, name, starter_list_completed_at")
        .in("id", [HOME_A, HOME_B]);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      for (const row of data ?? []) {
        expect(
          row.starter_list_completed_at,
          `${row.name}: lista di partenza completata`,
        ).not.toBeNull();
        expect(
          new Date(row.starter_list_completed_at as string).getTime(),
        ).toBeLessThan(Date.now());
      }
    },
  );
});
