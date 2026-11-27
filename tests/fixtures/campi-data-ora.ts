import { expect, type Locator, type Page } from "@playwright/test";

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The date field with that label, with or without a day: its name is the label
 * alone when empty and «<label>, <day>» when it has a day.
 */
export function dateField(scope: Page | Locator, label: string): Locator {
  return scope.getByLabel(label, { exact: true }).or(
    scope.getByRole("button", {
      name: new RegExp(`^${escapeRegExp(label)}, `),
    }),
  );
}

/** «Giovedì 22 ottobre» for `2026-10-22` (the year only if it is not this one). */
function dayText(dayKey: string): string {
  const text = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dayKey}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The field shows this day (value `YYYY-MM-DD` of the old native field). */
export async function expectDay(field: Locator, dayKey: string) {
  await expect(field.locator(".campo__valore")).toHaveText(
    new RegExp(`^${escapeRegExp(dayText(dayKey))}( \\d{4})?$`),
  );
}

/** The field shows no day. */
export async function expectNoDay(field: Locator) {
  await expect(field.locator(".campo__valore")).toHaveText("");
}

/** Opens the calendar and taps «Togli la data» (optional fields only). */
export async function clearDay(field: Locator): Promise<void> {
  await field.click();
  await field.page().getByTestId("calendario-togli").click();
}

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
 * `field` (the button of the field, found by label), goes to the month with
 * Page up and Page down (a year at a time with Shift) and taps the day. One tap
 * chooses it and closes the calendar.
 */
export async function pickDay(field: Locator, dayKey: string): Promise<void> {
  const page = field.page();
  await field.click();
  const calendar = page.getByTestId("calendario");
  const grid = calendar.getByRole("grid");
  await grid.waitFor();
  const cell = calendar.locator(`[role="gridcell"][data-day="${dayKey}"]`);
  const [year, month] = dayKey.split("-").map(Number) as [number, number];
  const wanted = year * 12 + (month - 1);
  for (let step = 0; step < 150; step += 1) {
    if ((await cell.count()) > 0) break;
    const name = (await grid.getAttribute("aria-label")) ?? "";
    const [shownMonth = "", shownYear = "0"] = name.toLowerCase().split(" ");
    const shown = Number(shownYear) * 12 + MONTHS.indexOf(shownMonth);
    const far = Math.abs(wanted - shown) >= 12;
    const key = wanted > shown ? "PageDown" : "PageUp";
    await page.keyboard.press(far ? `Shift+${key}` : key);
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
