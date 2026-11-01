import { expect, type Locator, type Page } from "@playwright/test";
import {
  buildNest,
  capitalise,
  dayNumber,
  monthName,
  weekdayName,
  type CasaNest,
  type Day,
  type MemberSpec,
} from "../fixtures/casa";
import {
  FULL_WEEK,
  MOCKUP_NEST,
  NOW,
  SUN,
  TUE,
  chooseLens,
  createEvents,
  isMobile,
  throwawayConfigured,
  throwawaySkipReason,
  type EventSpec,
} from "./calendario-settimana-helpers";

// Helpers of the visual and accessibility tests of Calendario · Giorno (#26).
// Every test builds its own throwaway Nest (fixtures/casa.ts), creates its own
// events in the week 19-25 October 2026 and deletes the Nest at the end: nothing
// is written in the seed Nests. Clock: Tuesday 20 October 2026, 15:52 in Rome,
// the time of the mockup (13-calendario-giorno). No health-related event (D1).

export {
  NOW,
  TUE,
  SUN,
  isMobile,
  throwawayConfigured,
  throwawaySkipReason,
  MOCKUP_NEST,
};
export type { EventSpec };

const ALL = ["Marco", "Laura", "Sofia", "Tommaso"];
const KIDS = ["Sofia", "Tommaso"];

/** The day of the mockup (13-calendario-giorno, state «normale»), Tuesday 20. */
export const TUESDAY: EventSpec[] = [
  // «Scuola» and «Nuoto Sofia» are on the children only, like in the mockup
  // (no escort): Laura writes them, so the lens «Io» of Marco does not show them.
  {
    who: "Laura",
    title: "Scuola",
    day: TUE,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
  },
  {
    who: "Laura",
    title: "Lavoro",
    day: TUE,
    from: "9:00",
    to: "15:00",
    visibility: "busy",
  },
  {
    who: "Marco",
    title: "Palestra",
    day: TUE,
    from: "13:00",
    to: "14:00",
  },
  {
    who: "Marco",
    title: "Call con Acme",
    day: TUE,
    from: "16:00",
    to: "17:00",
    location: "Teams",
  },
  {
    who: "Laura",
    title: "Nuoto Sofia",
    day: TUE,
    from: "17:00",
    to: "18:30",
    participants: ["Sofia"],
    location: "Piscina comunale",
  },
  {
    who: "Marco",
    title: "Cena dai nonni",
    day: TUE,
    from: "19:30",
    to: "21:30",
    participants: ALL,
    location: "Monza",
  },
];

/**
 * The week of the mockup: Tuesday 20 as in the day mockup, the other days from
 * the week mockup (so the panel «Serate libere insieme» has its three evenings).
 */
export const DAY_WEEK: EventSpec[] = [
  ...FULL_WEEK.filter((event) => event.day !== TUE),
  ...TUESDAY,
];

/** The five colors added with #74 are not in the type of the fixture. */
const extra = (
  name: string,
  kind: MemberSpec["kind"],
  color: string,
): MemberSpec => ({ name, kind, color: color as MemberSpec["color"] });

/** Seven people with a column (6 or more: the view scrolls sideways on a phone). */
export const SEVEN: MemberSpec[] = [
  { name: "Marco", kind: "adult", color: "pomodoro", account: true },
  { name: "Laura", kind: "adult", color: "glicine", account: true },
  { name: "Anna", kind: "adult", color: "cobalto" },
  { name: "Sofia", kind: "child", color: "salvia" },
  { name: "Tommaso", kind: "child", color: "zafferano" },
  extra("Giada", "child", "lampone"),
  extra("Pietro", "child", "ceruleo"),
];

/** Ten people, the limit of a Nest (#74). */
export const TEN: MemberSpec[] = [
  ...SEVEN,
  extra("Elena", "child", "peonia"),
  extra("Luca", "child", "basilico"),
  extra("Marta", "child", "cannella"),
];

/** Runs `body` with a throwaway Nest and deletes it afterwards. */
export async function withDayNest(
  members: MemberSpec[],
  events: EventSpec[],
  body: (nest: CasaNest) => Promise<void>,
): Promise<void> {
  const { nest, cleanup } = await buildNest("Casa D'Angelo", members);
  try {
    await createEvents(nest, events);
    await body(nest);
  } finally {
    await cleanup();
  }
}

/** Casa D'Angelo of the mockup. */
export const withMockupNest = (
  events: EventSpec[],
  body: (nest: CasaNest) => Promise<void>,
) => withDayNest(MOCKUP_NEST, events, body);

/** The title of the page for a day: «Martedì 20» (phone) or «Martedì 20 ottobre». */
export function dayTitle(page: Page, day: Day): string {
  const short = capitalise(`${weekdayName(day)} ${dayNumber(day)}`);
  return isMobile(page) ? short : `${short} ${monthName(day)}`;
}

export const dayHeading = (page: Page, day: Day) =>
  page.getByRole("heading", {
    level: 1,
    name: dayTitle(page, day),
    exact: true,
  });

/** The grid of the day (the region that scrolls). */
export const dayView = (page: Page) =>
  page.getByRole("region", { name: "Chi è dove, dalle 8:00 alle 23:00" });

/**
 * Signs Marco in with the clock at the time of the mockup and opens
 * `/calendario/giorno` (or the given day). It does not wait for the data.
 */
export async function openDay(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: { lens?: "io" | "nest"; day?: Day; who?: string } = {},
) {
  await chooseLens(page, options.lens ?? "nest");
  await page.clock.setFixedTime(NOW);
  await nest.signIn(page, baseURL, options.who ?? "Marco");
  await page.goto(
    options.day
      ? `/calendario/giorno?giorno=${options.day}`
      : "/calendario/giorno",
  );
}

/** The page has its data: the title is there and no loading container is left. */
export async function waitForDayData(page: Page, day: Day = TUE) {
  await expect(dayHeading(page, day)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30_000,
  });
}

/** The size of the frames of the mockup: the whole day fits, nothing scrolls. */
export async function mockupFrame(page: Page) {
  await page.setViewportSize(
    isMobile(page)
      ? { width: 390, height: 1164 }
      : { width: 1280, height: 1040 },
  );
}

/** The pointer away from everything: the shot shows the resting state. */
export async function shootDay(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name);
}

/** Box of an element relative to the line of the 8:00 (the top of the hours area). */
export async function boxIn(target: Locator, area: Locator) {
  const [b, a] = await Promise.all([target.boundingBox(), area.boundingBox()]);
  if (!b || !a) throw new Error("elemento non visibile");
  return { top: b.y - a.y, height: b.height, left: b.x, width: b.width };
}

/**
 * True when the 44 x 44 px square around the centre of the control hits the
 * control (or something inside it): the touch area is the whole square
 * (elementFromPoint, not boundingBox: LEZIONI #78).
 */
export async function hasTouchArea(target: Locator, size = 44) {
  return target.evaluate((el, s) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const half = s / 2 - 1;
    const points = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
      [cx, cy],
    ];
    return points.every(([x, y]) => {
      const hit = document.elementFromPoint(x!, y!);
      return hit !== null && (hit === el || el.contains(hit));
    });
  }, size);
}

/** WCAG contrast ratio of the text of an element against its background. */
export async function contrastOf(target: Locator, backgroundToken?: string) {
  return target.evaluate((el, token) => {
    const parse = (value: string) => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) throw new Error(`colore non riconosciuto: ${value}`);
      const [r, g, b, a] = m[1]!
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: r!, g: g!, b: b!, a: a ?? 1 };
    };
    const solid = (value: string) => {
      const c = parse(value);
      return c.a > 0.99 ? c : null;
    };
    const resolveToken = (name: string) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${name})`;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return parse(color);
    };
    let background = token ? resolveToken(token) : null;
    for (
      let node: HTMLElement | null = el as HTMLElement;
      !background && node;
      node = node.parentElement
    ) {
      background = solid(getComputedStyle(node).backgroundColor);
    }
    if (!background) background = { r: 255, g: 255, b: 255, a: 1 };
    const fg = parse(getComputedStyle(el).color);
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const l1 = lum(fg);
    const l2 = lum(background);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }, backgroundToken);
}
