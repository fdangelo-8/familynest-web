import { expect, type Page } from "@playwright/test";
import {
  buildNest,
  romeInstant,
  type CasaNest,
  type Day,
  type MemberSpec,
} from "../fixtures/casa";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Helpers of the visual and accessibility tests of Calendario · Settimana (#25).
// Every test builds its own throwaway Nest (fixtures/casa.ts), creates its own
// events in the week 19-25 October 2026 and deletes the Nest at the end: nothing
// is written in the seed Nests. Clock: Tuesday 20 October 2026, 15:52 in Rome,
// the time of the mockup. No health-related event (D1).

export const NOW = new Date("2026-10-20T15:52:00+02:00");

export const MON: Day = "2026-10-19";
export const TUE: Day = "2026-10-20";
export const WED: Day = "2026-10-21";
export const THU: Day = "2026-10-22";
export const FRI: Day = "2026-10-23";
export const SAT: Day = "2026-10-24";
export const SUN: Day = "2026-10-25";

export const WEEK_TITLE = "19 – 25 ottobre";

export { throwawayConfigured, throwawaySkipReason };

/**
 * Casa D'Angelo of the mockup: Marco (signs in, «Io») and Laura are adults with
 * an account (Laura writes the «Occupato» of the others), Sofia and Tommaso are
 * children, Biscotto is the dog.
 */
export const MOCKUP_NEST: MemberSpec[] = [
  { name: "Marco", kind: "adult", color: "pomodoro", account: true },
  { name: "Laura", kind: "adult", color: "glicine", account: true },
  { name: "Sofia", kind: "child", color: "salvia" },
  { name: "Tommaso", kind: "child", color: "cobalto" },
  { name: "Biscotto", kind: "pet", color: "zafferano" },
];

export type Visibility = "household" | "busy" | "private";

export type EventSpec = {
  who: string;
  title: string;
  day: Day;
  /** "H:MM" in Europe/Rome */
  from: string;
  to: string;
  visibility?: Visibility;
  participants?: string[];
  escort?: string;
  location?: string;
};

function instant(day: Day, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  return romeInstant(day, hour!, minute!);
}

/**
 * Creates an event with the session of its author (RLS applies, the database
 * sets the author) and adds its participants with the administrative key.
 */
async function createEvent(nest: CasaNest, spec: EventSpec): Promise<void> {
  const user = nest.users[spec.who];
  if (!user) throw new Error(`${spec.who} non ha un account di prova`);
  const memberId = (name: string) => {
    const id = nest.members[name];
    if (!id) throw new Error(`Membro di prova sconosciuto: ${name}`);
    return id;
  };
  const startsAt = instant(spec.day, spec.from).toISOString();
  const endsAt = instant(spec.day, spec.to).toISOString();
  const { error } = await user.client.from("events").insert({
    title: spec.title,
    location: spec.location ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    visibility: spec.visibility ?? "household",
    escort_member_id: spec.escort ? memberId(spec.escort) : null,
  });
  if (error) throw new Error("Impegno di prova non creato");
  // No chained select after a write (LEZIONI): the id is read separately.
  const { data, error: readError } = await user.admin
    .from("events")
    .select("id")
    .eq("household_id", nest.householdId)
    .eq("title", spec.title)
    .eq("starts_at", startsAt);
  if (readError || !data || data.length === 0)
    throw new Error("Impegno di prova non trovato");
  const id = data[data.length - 1]!.id as string;
  const people = spec.participants ?? [spec.who];
  if (people.length > 0) {
    const { error: peopleError } = await user.admin
      .from("event_members")
      .insert(
        people.map((name) => ({
          event_id: id,
          member_id: memberId(name),
          household_id: nest.householdId,
        })),
      );
    if (peopleError) throw new Error("Partecipanti di prova non aggiunti");
  }
}

/** Creates the events in small batches (the local pool is small, LEZIONI). */
export async function createEvents(
  nest: CasaNest,
  specs: EventSpec[],
): Promise<void> {
  for (let i = 0; i < specs.length; i += 4) {
    await Promise.all(specs.slice(i, i + 4).map((s) => createEvent(nest, s)));
  }
}

const ALL = ["Marco", "Laura", "Sofia", "Tommaso"];
const KIDS = ["Sofia", "Tommaso"];

/** The week of the mockup (12-calendario-settimana), without health events. */
export const FULL_WEEK: EventSpec[] = [
  // Monday 19
  {
    who: "Marco",
    title: "Scuola",
    day: MON,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
    escort: "Marco",
  },
  {
    who: "Marco",
    title: "Riunione di team",
    day: MON,
    from: "10:00",
    to: "11:00",
  },
  {
    who: "Marco",
    title: "Inglese",
    day: MON,
    from: "16:30",
    to: "17:30",
    participants: ["Sofia"],
    location: "Via Dante 4",
  },
  {
    who: "Laura",
    title: "Cena con le colleghe",
    day: MON,
    from: "19:30",
    to: "22:00",
  },
  // Tuesday 20 (today)
  {
    who: "Marco",
    title: "Scuola",
    day: TUE,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
    escort: "Marco",
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
    visibility: "private",
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
    who: "Marco",
    title: "Nuoto Sofia",
    day: TUE,
    from: "17:00",
    to: "18:30",
    participants: ["Sofia"],
    escort: "Laura",
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
  // Wednesday 21
  {
    who: "Marco",
    title: "Scuola",
    day: WED,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
    escort: "Marco",
  },
  {
    who: "Laura",
    title: "Lavoro",
    day: WED,
    from: "10:00",
    to: "14:00",
    visibility: "busy",
  },
  {
    who: "Marco",
    title: "Inglese",
    day: WED,
    from: "16:30",
    to: "17:30",
    participants: ["Sofia"],
    location: "Via Dante 4",
  },
  {
    who: "Laura",
    title: "Riunione di classe",
    day: WED,
    from: "18:00",
    to: "19:30",
    location: "scuola Manzoni",
  },
  {
    who: "Marco",
    title: "Tennis",
    day: WED,
    from: "20:00",
    to: "22:30",
    location: "Centro sportivo",
  },
  // Thursday 22
  {
    who: "Marco",
    title: "Scuola",
    day: THU,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
    escort: "Marco",
  },
  {
    who: "Marco",
    title: "Workshop cliente",
    day: THU,
    from: "9:00",
    to: "13:00",
    location: "Milano, sede Acme",
  },
  {
    who: "Laura",
    title: "Colloquio con la maestra",
    day: THU,
    from: "16:30",
    to: "17:15",
    participants: ["Tommaso", "Laura"],
    location: "scuola Manzoni",
  },
  {
    who: "Marco",
    title: "Nuoto Sofia",
    day: THU,
    from: "17:00",
    to: "18:30",
    participants: ["Sofia"],
    escort: "Laura",
    location: "Piscina comunale",
  },
  {
    who: "Laura",
    title: "Yoga",
    day: THU,
    from: "20:30",
    to: "22:30",
    location: "Studio Respiro",
  },
  // Friday 23
  {
    who: "Marco",
    title: "Scuola",
    day: FRI,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
    escort: "Marco",
  },
  {
    who: "Marco",
    title: "Calcetto",
    day: FRI,
    from: "20:00",
    to: "21:30",
    location: "Campo comunale",
  },
  // Saturday 24
  {
    who: "Marco",
    title: "Mercato",
    day: SAT,
    from: "10:00",
    to: "11:30",
    participants: ["Marco", "Tommaso"],
  },
  {
    who: "Marco",
    title: "Festa di compleanno",
    day: SAT,
    from: "16:00",
    to: "19:00",
    participants: ["Sofia"],
  },
  {
    who: "Marco",
    title: "Cena da Marta",
    day: SAT,
    from: "20:00",
    to: "23:00",
    participants: ["Marco", "Laura"],
    location: "Via Roma 1",
  },
  // Sunday 25 (the clocks go back at 3:00)
  {
    who: "Marco",
    title: "Pranzo dai nonni",
    day: SUN,
    from: "12:30",
    to: "15:00",
    participants: ALL,
  },
];

/** A few events, enough for the states that only need a week with data. */
export const SMALL_WEEK: EventSpec[] = [
  {
    who: "Marco",
    title: "Scuola",
    day: TUE,
    from: "8:15",
    to: "8:45",
    participants: KIDS,
    escort: "Marco",
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
    title: "Call con Acme",
    day: TUE,
    from: "16:00",
    to: "17:00",
    location: "Teams",
  },
  {
    who: "Marco",
    title: "Nuoto Sofia",
    day: TUE,
    from: "17:00",
    to: "18:30",
    participants: ["Sofia"],
    escort: "Laura",
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
  {
    who: "Marco",
    title: "Tennis",
    day: WED,
    from: "20:00",
    to: "22:30",
    location: "Centro sportivo",
  },
];

/** Runs `body` with a throwaway Nest of the mockup and deletes it afterwards. */
export async function withNest(
  events: EventSpec[],
  body: (nest: CasaNest) => Promise<void>,
): Promise<void> {
  const { nest, cleanup } = await buildNest("Casa D'Angelo", MOCKUP_NEST);
  try {
    await createEvents(nest, events);
    await body(nest);
  } finally {
    await cleanup();
  }
}

export const isMobile = (page: Page) =>
  (page.viewportSize()?.width ?? 0) < 1024;

/** The lens is kept in the session of the tab: it is set before the page starts. */
export async function chooseLens(page: Page, lens: "io" | "nest") {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("familynest.lens", value);
  }, lens);
}

/**
 * Signs Marco in with the clock at the time of the mockup and opens
 * `/calendario` (or `path`). It does not wait for the data.
 */
export async function openWeek(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  options: { lens?: "io" | "nest"; path?: string } = {},
) {
  await chooseLens(page, options.lens ?? "nest");
  await page.clock.setFixedTime(NOW);
  await nest.signIn(page, baseURL, "Marco");
  await page.goto(options.path ?? "/calendario");
}

/** The page has its data: no loading container is left. */
export async function waitForData(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: WEEK_TITLE }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30_000,
  });
}

/**
 * The window as tall as the page, like the frames of the mockup: the fixed bar
 * and navigation then sit at the top and at the bottom of the whole page.
 */
export async function fit(page: Page) {
  const base = page.viewportSize()!;
  for (let i = 0; i < 2; i++) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({
      width: base.width,
      height: Math.max(base.height, height),
    });
  }
}

/** The pointer away from everything: the shot shows the resting state. */
export async function shoot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await fit(page);
  await expect(page).toHaveScreenshot(name);
}
