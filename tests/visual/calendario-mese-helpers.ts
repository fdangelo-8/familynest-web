import { expect, type Page } from "@playwright/test";
import type { CasaNest, Day } from "../fixtures/casa";
import {
  MON,
  TUE,
  WED,
  THU,
  FRI,
  SAT,
  SUN,
  chooseLens,
  NOW,
  type EventSpec,
} from "./calendario-settimana-helpers";

// Helpers of the visual and accessibility tests of Calendario · Mese (#27).
// Same Nest as the mockup (Casa D'Angelo, seen by Marco) and the month of the
// mockup 14-calendario-mese: October 2026 (grid 28 September - 1 November),
// clock Tuesday 20 October 2026, 15:52 (Rome). No health-related event (D1).

export const MONTH_TITLE = "Ottobre 2026";
export const PATH = "/calendario/mese";

const day = (n: number): Day => `2026-10-${String(n).padStart(2, "0")}`;
const ALL = ["Marco", "Laura", "Sofia", "Tommaso"];

function ev(
  who: string,
  title: string,
  d: Day,
  from: string,
  to: string,
  extra: Partial<EventSpec> = {},
): EventSpec {
  return { who, title, day: d, from, to, ...extra };
}

/**
 * Dots of the mockup (normal state): who has something each day. The 20th is
 * the day of the list (Call, Nuoto Sofia, Cena dai nonni, then «Liberi
 * insieme» at 21:30).
 */
export const MONTH_EVENTS: EventSpec[] = [
  ev("Marco", "Inglese", day(2), "16:30", "17:30", { participants: ["Sofia"] }),
  ev("Marco", "Judo", day(5), "17:00", "18:00", { participants: ["Tommaso"] }),
  ev("Marco", "Cena con amici", day(6), "20:00", "22:00", {
    participants: ["Marco", "Laura"],
  }),
  ev("Marco", "Riunione di team", day(8), "10:00", "11:00"),
  ev("Marco", "Gita al lago", day(10), "10:00", "17:00", {
    participants: ALL,
  }),
  ev("Marco", "Compiti di gruppo", day(13), "16:00", "17:00", {
    participants: ["Sofia"],
  }),
  ev("Laura", "Yoga", day(14), "20:30", "22:00"),
  ev("Marco", "Inglese", day(15), "16:30", "17:30", {
    participants: ["Sofia"],
  }),
  ev("Marco", "Workshop cliente", day(16), "9:00", "13:00"),
  ev("Marco", "Pranzo dai nonni", day(19), "12:30", "15:00", {
    participants: ALL,
  }),
  ev("Marco", "Call con Acme", TUE, "16:00", "17:00", { location: "Teams" }),
  ev("Marco", "Nuoto Sofia", TUE, "17:00", "18:30", {
    participants: ["Sofia"],
    escort: "Laura",
    location: "Piscina comunale",
  }),
  ev("Marco", "Cena dai nonni", TUE, "19:30", "21:30", {
    participants: ALL,
    location: "Monza",
  }),
  ev("Marco", "Gita in bici", WED, "10:00", "12:00", { participants: ALL }),
  ev("Marco", "Festa a scuola", THU, "17:00", "19:00", { participants: ALL }),
  ev("Marco", "Calcetto", FRI, "20:00", "21:30", {
    participants: ["Marco", "Sofia", "Tommaso"],
    location: "Campo comunale",
  }),
  ev("Marco", "Mercato", SAT, "10:00", "11:30", { participants: ALL }),
  ev("Marco", "Pranzo dai nonni", SUN, "12:30", "15:00", {
    participants: ALL,
  }),
  ev("Marco", "Compiti di gruppo", day(27), "16:00", "17:00", {
    participants: ["Sofia"],
  }),
  ev("Marco", "Riunione di team", day(28), "10:00", "11:00"),
  ev("Laura", "Yoga", day(29), "20:30", "22:00"),
  ev("Marco", "Visita alla mostra", day(30), "15:00", "17:00", {
    participants: ["Marco", "Sofia"],
  }),
  ev("Marco", "Cena da Marta", day(31), "20:00", "23:00", {
    participants: ["Marco", "Laura"],
  }),
];

/** The month plus five people on the 7th: on a phone the grey «e altri» dot. */
export const CROWD_EVENTS: EventSpec[] = [
  ...MONTH_EVENTS,
  ev("Marco", "Gita al lago", day(7), "10:00", "17:00", {
    participants: [...ALL, "Biscotto"],
  }),
];

export { MON, TUE, WED, THU, FRI, SAT, SUN, NOW };

/**
 * Signs Marco in with the clock at the time of the mockup and opens the month
 * page (or `path`). It does not wait for the data.
 */
export async function openMonth(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: { lens?: "io" | "nest"; path?: string } = {},
) {
  await chooseLens(page, options.lens ?? "nest");
  await page.clock.setFixedTime(NOW);
  await nest.signIn(page, baseURL, "Marco");
  await page.goto(options.path ?? PATH);
}

/** The grid is on screen and no loading container is left. */
export async function waitForMonth(page: Page, title = MONTH_TITLE) {
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("grid")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30_000,
  });
}
