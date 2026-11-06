import type { Locator, Page } from "@playwright/test";
import { isMobileProject, romeDay } from "../fixtures/casa";
import {
  card,
  createEvent,
  dayLabel,
  editDialog,
  expect,
  fieldOf,
  h1,
  openForm,
  pressSave,
  test,
  textRx,
  toastOf,
} from "../fixtures/impegni";
import { addDays } from "../fixtures/casa";
import { waitHydrated } from "../fixtures/profilo";

// #324, review of #325: a sheet over the page (Add) is not a return. Opening
// it and closing it must leave the page below as it was: same scroll, same
// focus on whoever opened the sheet, same state, no skeleton. The state is
// proved with a mark written on a node of the page: a page that is mounted
// again builds new nodes and loses it. Every test builds its own throwaway
// Nest (Marco is its administrator).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });
test.describe.configure({ timeout: 120_000 });

const PROBE = "data-probe";

const addDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Aggiungi" });
const loading = (page: Page) => page.locator('main [aria-busy="true"]');

/** Marks the heading of the page: a new mount builds a new node. */
async function markNode(page: Page): Promise<void> {
  await page
    .getByRole("main")
    .getByRole("heading", { level: 1 })
    .evaluate((node, name) => node.setAttribute(name, "same"), PROBE);
}

const GONE_TEXT = "Questo impegno non c'è più";

/**
 * Installs, before the action, an observer that records whether the skeleton
 * (`main [aria-busy="true"]`) or the «non c'è più» text ever showed up, even
 * for a single frame: it reads the added nodes of every mutation, not only the
 * final DOM.
 */
async function watchFlashes(page: Page): Promise<void> {
  await page.evaluate((gone) => {
    const w = window as unknown as {
      __flash: { skeleton: boolean; gone: boolean };
    };
    w.__flash = { skeleton: false, gone: false };
    const busy = (el: Element) =>
      el.matches('[aria-busy="true"]') && el.closest("main") !== null;
    const scan = (node: Node) => {
      if (node.textContent?.includes(gone)) w.__flash.gone = true;
      if (node.nodeType !== 1) return;
      const el = node as Element;
      if (busy(el)) w.__flash.skeleton = true;
      for (const d of el.querySelectorAll('[aria-busy="true"]'))
        if (busy(d)) w.__flash.skeleton = true;
    };
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach(scan);
        if (r.type === "attributes" && r.target.nodeType === 1) scan(r.target);
        if (r.type === "characterData") scan(r.target);
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-busy"],
      characterData: true,
    });
    scan(document.documentElement);
  }, GONE_TEXT);
}

async function flashes(
  page: Page,
): Promise<{ skeleton: boolean; gone: boolean }> {
  return page.evaluate(
    () =>
      (window as unknown as { __flash: { skeleton: boolean; gone: boolean } })
        .__flash,
  );
}

/** A short window, so that every page can scroll. */
async function shortViewport(page: Page): Promise<void> {
  const size = page.viewportSize();
  await page.setViewportSize({ width: size?.width ?? 390, height: 460 });
}

async function scrollDown(page: Page): Promise<number> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      ),
    )
    .toBeGreaterThan(40);
  await page.evaluate(() => window.scrollTo(0, 40));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(40);
  return 40;
}

/**
 * Opens Add with the opener, closes it with Esc and checks that the page
 * below is the same: scroll, focus on the opener, mark, no skeleton.
 */
async function openAndEscape(
  page: Page,
  opener: Locator,
  scroll: number,
  onBelow?: () => Promise<void>,
): Promise<void> {
  await waitHydrated(opener);
  await opener.focus();
  await watchFlashes(page);
  await expect(async () => {
    if (!(await addDialog(page).isVisible())) await opener.click();
    await expect(addDialog(page)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await onBelow?.();
  await page.keyboard.press("Escape");
  await expect(addDialog(page)).toHaveCount(0);
  await onBelow?.();

  expect((await flashes(page)).skeleton).toBe(false);
  await expect(loading(page)).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveAttribute(PROBE, "same");
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await expect(opener).toBeFocused();
}

test("sopra la pagina (Oggi): aprire Aggiungi e chiudere con Esc non riparte la pagina", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  await shortViewport(page);
  await page.goto("/oggi");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await markNode(page);
  const scroll = await scrollDown(page);
  // On the phone the quick field sits under the floating bar once scrolled:
  // the opener is the «Aggiungi» of the bar.
  const opener = isMobileProject()
    ? page.getByRole("link", { name: "Aggiungi", exact: true })
    : page.getByRole("main").locator("a.campo-rapido");
  await openAndEscape(page, opener, scroll);
});

test("sopra la pagina (Calendario giorno, giornata libera): aprire Aggiungi e chiudere con Esc non riparte la pagina", async ({
  page,
  baseURL,
  casa,
}) => {
  await casa.signIn(page, baseURL, "Marco");
  // A day with nothing in it: the page has its own «Aggiungi qualcosa».
  const freeDay = addDays(romeDay(), 3);
  await page.goto(`/calendario/giorno?giorno=${freeDay}`);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await markNode(page);
  const opener = page
    .getByRole("main")
    .getByRole("link", { name: "Aggiungi qualcosa" });
  // The page below stays on the day of the query (today + 3), with the sheet
  // open and after Esc.
  const dayNumber = String(Number(freeDay.slice(8, 10)));
  const stillOnDay = async () => {
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { level: 1, includeHidden: true }),
    ).toHaveText(new RegExp(`\\b${dayNumber}\\b`));
  };
  await stillOnDay();
  await openAndEscape(page, opener, 0, stillOnDay);
});

test("sopra la pagina (Calendario giorno, con impegni): aprire Aggiungi e chiudere con Esc non riparte la pagina", async ({
  page,
  baseURL,
  casa,
}) => {
  const day = romeDay();
  await createEvent(casa, "Marco", {
    title: "Impegno sotto il foglio",
    day,
    from: "10:00",
    to: "10:30",
    members: ["Marco"],
  });
  await casa.signIn(page, baseURL, "Marco");
  await shortViewport(page);
  await page.goto(`/calendario/giorno?giorno=${day}`);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await markNode(page);
  const scroll = await scrollDown(page);
  const opener = page.getByRole("link", { name: "Aggiungi", exact: true });
  await openAndEscape(page, opener, scroll);
});

test("sopra la pagina (dettaglio impegno): dopo un salvataggio, aprire e chiudere Aggiungi mostra i dati nuovi", async ({
  page,
  baseURL,
  casa,
}) => {
  const title = "Prova sopra prima";
  const newTitle = "Prova sopra dopo";
  const day = romeDay();
  const newDay = addDays(day, 1);
  const id = await createEvent(casa, "Marco", {
    title,
    day,
    from: "10:00",
    to: "10:30",
    members: ["Marco"],
  });
  await casa.signIn(page, baseURL, "Marco");
  await page.goto(`/impegni/${id}?giorno=${day}`);
  await expect(h1(page, title)).toBeVisible({ timeout: 20_000 });

  // 1. Save a new title and a new day (the address changes in place).
  const dialog = await openForm(page);
  await fieldOf(dialog, "Titolo").fill(newTitle);
  await fieldOf(dialog, "Giorno").fill(newDay);
  await pressSave(page);
  await expect(editDialog(page)).toBeHidden();
  await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
  await expect(h1(page, newTitle)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`giorno=${newDay}`));

  // 2. Open Add from the navigation and close it.
  const opener = page.getByRole("link", { name: "Aggiungi", exact: true });
  await waitHydrated(opener);
  await markNode(page);
  await watchFlashes(page);
  await expect(async () => {
    if (!(await addDialog(page).isVisible())) await opener.click();
    await expect(addDialog(page)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  // With the sheet still open, nothing «gone» or loading shows below.
  await expect(h1(page, newTitle)).toBeVisible();
  expect(await flashes(page)).toEqual({ skeleton: false, gone: false });
  await page.keyboard.press("Escape");
  await expect(addDialog(page)).toHaveCount(0);

  // 3. The new values, not the old occurrence and not «non c'è più»; the
  // page was not mounted again.
  await expect(h1(page, newTitle)).toHaveAttribute(PROBE, "same");
  expect(await flashes(page)).toEqual({ skeleton: false, gone: false });
  await expect(h1(page, newTitle)).toBeVisible();
  await expect(card(page)).toContainText(textRx(dayLabel(newDay), false));
  await expect(page.getByText("Questo impegno non c'è più")).toHaveCount(0);
  await expect(loading(page)).toHaveCount(0);
});
