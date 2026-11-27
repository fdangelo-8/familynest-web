import type { Locator } from "@playwright/test";

// F4c (#505): the date field is a button that opens a month calendar and the
// time field is a text field read on leaving it. These two helpers are the
// only way the tests choose a day or write a time: a test never fills a date
// by hand.

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/**
 * Chooses `dayKey` (`YYYY-MM-DD`) in a date field: opens the calendar from
 * `field` (the button of the field, found by label), goes to the month with the
 * arrows and taps the day. One tap chooses it and closes the calendar.
 */
export async function pickDay(field: Locator, dayKey: string): Promise<void> {
  const page = field.page();
  await field.click();
  const cell = page.locator(`[role="gridcell"][data-day="${dayKey}"]`);
  const grid = page.getByRole("grid");
  const [year, month] = dayKey.split("-").map(Number) as [number, number];
  for (let step = 0; step < 120; step += 1) {
    if ((await cell.count()) > 0) break;
    const name = (await grid.getAttribute("aria-label")) ?? "";
    const [shownMonth = "", shownYear = "0"] = name.toLowerCase().split(" ");
    const shown = Number(shownYear) * 12 + MONTHS.indexOf(shownMonth);
    const wanted = year * 12 + (month - 1);
    await page
      .getByRole("button", {
        name: wanted > shown ? "Mese successivo" : "Mese precedente",
      })
      .click();
  }
  await cell.click();
}

/**
 * Writes a time in a time field and leaves it, so the value is read:
 * `typeTime(field, "17:30")`, also «1730», «17» or «17.30».
 */
export async function typeTime(field: Locator, text: string): Promise<void> {
  await field.fill(text);
  await field.blur();
}
