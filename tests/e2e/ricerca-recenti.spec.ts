import type { Page } from "@playwright/test";
import { openProfile, signOutButton, signOutDialog } from "../fixtures/profilo";
import { setClock } from "../fixtures/casa";
import {
  CLOCK,
  addShopping,
  d,
  example,
  expect,
  expectReady,
  field,
  isMobile,
  openSearch,
  recentTexts,
  rowsOf,
  seedNuoto,
  seedRecents,
  storedRecents,
  test,
  titlesOf,
  toast,
  typeSearch,
  type CasaNest,
} from "../fixtures/ricerca";

// Ricerca (#40): recent searches (CA-36 ... CA-40, CA-58, CA-59).
// Recents live only in the browser (localStorage, key of the account). Data: a
// throwaway Nest per test; dates relative to T, a Tuesday (fixtures/ricerca.ts).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const lower = (list: string[]) => list.map((text) => text.toLowerCase());
const clearButton = (page: Page) =>
  page.getByRole("button", { name: "Cancella le ricerche recenti" });
const recentRow = (page: Page, text: string) =>
  page.getByTestId("ricerca-recenti").locator("button", { hasText: text });

/** Opens the search with recent searches already in the browser of Marco. */
async function openWithRecents(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  recents: string[],
): Promise<void> {
  await setClock(page, CLOCK);
  await nest.signIn(page, baseURL, "Marco");
  await seedRecents(page, nest.users["Marco"]!.id, recents);
  await page.goto("/ricerca");
  await expectReady(page);
  await expect(page.getByTestId("ricerca-recenti")).toBeVisible();
}

test.describe("recenti", () => {
  test("CA-36 (mobile): si salvano aprendo un risultato o con Invio, la più recente prima, senza doppioni e al massimo tre", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "L'Invio che salva è un comportamento mobile");
    await seedNuoto(nest);
    await nest.deadline("Marco", { title: "Bollo auto", due: d(3) });
    await addShopping(nest, "Latte");
    await openSearch(page, baseURL, nest);
    await expect(page.getByTestId("ricerca-recenti")).toHaveCount(0);

    // 1. A result is opened.
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await rowsOf(page, "event").first().click();
    await expect(page).toHaveURL(/\/impegni\//);

    const reopen = async () => {
      await page.goto("/ricerca");
      await expectReady(page);
      await expect(page.getByTestId("ricerca-recenti")).toBeVisible();
    };

    // 2. Enter with a result.
    await reopen();
    await expect.poll(() => recentTexts(page)).toEqual(["nuoto"]);
    await typeSearch(page, "bollo auto");
    await expect(titlesOf(page, "deadline")).toHaveText(["Bollo auto"]);
    await field(page).press("Enter");

    await reopen();
    await expect.poll(() => recentTexts(page)).toEqual(["bollo auto", "nuoto"]);

    // 3. The same text in capitals: no duplicate, it goes to the top.
    await typeSearch(page, "NUOTO");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await field(page).press("Enter");
    await reopen();
    await expect
      .poll(async () => lower(await recentTexts(page)))
      .toEqual(["nuoto", "bollo auto"]);

    // 4. and 5. More searches: at most three, the latest first.
    await typeSearch(page, "latte");
    await expect(titlesOf(page, "shopping_item")).toHaveText(["Latte"]);
    await field(page).press("Enter");
    await reopen();
    await typeSearch(page, "cuffia");
    await expect(titlesOf(page, "todo")).toHaveCount(1);
    await field(page).press("Enter");
    await reopen();
    await expect
      .poll(async () => lower(await recentTexts(page)))
      .toEqual(["cuffia", "latte", "nuoto"]);
  });

  test("CA-36 (desktop): aprire un risultato con Invio salva la ricerca tra le recenti", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "Caso della palette (1280 px)");
    await seedNuoto(nest);
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    await expect(rowsOf(page, "event")).toHaveCount(3);
    await field(page).press("Enter");
    await expect(page).toHaveURL(/\/impegni\//);

    await page.goto("/ricerca");
    await expectReady(page);
    await expect.poll(() => recentTexts(page)).toEqual(["nuoto"]);
  });

  test("CA-37: toccare una recente scrive il testo nel campo e mostra i risultati", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.deadline("Marco", { title: "Bollo auto", due: d(3) });
    await openWithRecents(page, baseURL, nest, ["bollo auto"]);
    await recentRow(page, "bollo auto").click();
    await expect(field(page)).toHaveValue("bollo auto");
    await expect(titlesOf(page, "deadline")).toHaveText(["Bollo auto"]);
  });

  test("CA-38: «Cancella» toglie le recenti, il fuoco va nel campo, compare il toast e non tornano dopo il ricaricamento", async ({
    page,
    baseURL,
    nest,
  }) => {
    await openWithRecents(page, baseURL, nest, ["uno", "due", "tre"]);
    await expect.poll(() => recentTexts(page)).toEqual(["uno", "due", "tre"]);
    await clearButton(page).click();

    await expect(page.getByTestId("ricerca-recenti")).toHaveCount(0);
    await expect(field(page)).toBeFocused();
    await expect(toast(page)).toContainText("Ricerche recenti cancellate.");
    await expect(
      toast(page).getByRole("button", { name: "Annulla" }),
    ).toBeVisible();

    await page.reload();
    await expectReady(page);
    await expect(example(page, "questo weekend")).toBeVisible();
    await expect(page.getByTestId("ricerca-recenti")).toHaveCount(0);
    expect(await storedRecents(page, nest.users["Marco"]!.id)).toEqual([]);
  });

  test("CA-58: «Annulla» nel toast rimette le stesse tre ricerche nello stesso ordine, senza un secondo toast", async ({
    page,
    baseURL,
    nest,
  }) => {
    await openWithRecents(page, baseURL, nest, ["uno", "due", "tre"]);
    await expect.poll(() => recentTexts(page)).toEqual(["uno", "due", "tre"]);
    await clearButton(page).click();
    await expect(page.getByTestId("ricerca-recenti")).toHaveCount(0);

    await toast(page).getByRole("button", { name: "Annulla" }).click();
    await expect.poll(() => recentTexts(page)).toEqual(["uno", "due", "tre"]);
    await expect(toast(page)).toHaveCount(0);
  });

  test("CA-39: dopo «Esci» un altro account nello stesso browser non vede le recenti di Marco", async ({
    page,
    baseURL,
    nest,
  }) => {
    await nest.signIn(page, baseURL, "Marco");
    await seedRecents(page, nest.users["Marco"]!.id, ["nuoto", "bollo auto"]);
    await openProfile(page);
    await signOutButton(page).click();
    await expect(signOutDialog(page)).toBeVisible();
    await signOutDialog(page)
      .getByRole("button", { name: "Esci", exact: true })
      .click();
    await expect(page).toHaveURL(/\/accesso$/);
    expect(
      await page.evaluate(() =>
        Object.keys(window.localStorage).filter((key) =>
          key.startsWith("familynest:recent-searches:"),
        ),
      ),
    ).toEqual([]);

    await nest.signInContext(page.context(), baseURL, "Laura");
    await page.goto("/ricerca");
    await expectReady(page);
    await expect(example(page, "questo weekend")).toBeVisible();
    await expect(page.getByTestId("ricerca-recenti")).toHaveCount(0);
    await expect(page.getByText("nuoto")).toHaveCount(0);
  });

  test("CA-40: aprendo la ricerca nessuna richiesta contiene il testo delle recenti", async ({
    page,
    baseURL,
    nest,
  }) => {
    const sent: string[] = [];
    page.on("request", (request) =>
      sent.push(
        `${request.method()} ${request.url()} ${request.postData() ?? ""}`,
      ),
    );
    await openWithRecents(page, baseURL, nest, ["parolasegreta"]);
    await expect.poll(() => recentTexts(page)).toEqual(["parolasegreta"]);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.filter((line) => line.includes("parolasegreta"))).toEqual([]);
  });

  test("CA-59: su desktop le frecce partono dal campo senza scelta, passano dalle recenti ai chip e ↵ scrive il testo", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "Caso della palette (1280 px)");
    await openWithRecents(page, baseURL, nest, ["uno", "due"]);
    const input = field(page);
    await expect(input).not.toHaveAttribute("aria-activedescendant");

    const idOf = async (locator: ReturnType<typeof recentRow>) =>
      (await locator.getAttribute("id")) ?? "";
    const first = recentRow(page, "uno");
    const second = recentRow(page, "due");

    await input.press("ArrowDown");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      await idOf(first),
    );
    await input.press("ArrowUp");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      await idOf(first),
    );
    await input.press("ArrowDown");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      await idOf(second),
    );
    await input.press("ArrowDown");
    const weekend = example(page, "questo weekend");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await weekend.getAttribute("id")) ?? "",
    );
    await input.press("Enter");
    await expect(input).toHaveValue("questo weekend");
  });
});
