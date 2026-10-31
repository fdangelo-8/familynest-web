import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BUSY_TITLE,
  VISIBILITY_LABELS,
  computeFreeEvenings,
  eventsOfDay,
  filterByLens,
  findFreeEvening,
  busyIntervals,
  formatBusyLabel,
  formatFreeEveningRow,
  formatFreeEveningWindow,
  formatHiddenCount,
  formatWithYou,
  hiddenByLens,
  isInvolved,
} from "../../src/lib/calendar";
import {
  addDaysToDayKey,
  formatDayNumber,
  formatDeadline,
  formatFirstDeadline,
  formatGreeting,
  formatMonthParam,
  formatTimeRange,
  formatWeekParam,
  getCalendarDay,
  getWeekDays,
  getWeekStart,
  isValidDayKey,
  parseWeekParam,
  toDateFieldValue,
} from "../../src/lib/datetime";
import {
  listHouseholdEvents,
  type FullEvent,
  type HouseholdEvent,
  type MaskedEvent,
} from "../../src/lib/household-events";
import { PLACEHOLDERS } from "../../src/lib/app-routes";
import type { Database } from "../../src/types/database";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";

// Pure functions and a fake database client: no browser, no remote project.
// Issue #88 (for #25 and #30).

/* ---------- Dates ---------- */

test.describe("settimana e giorni a Roma", () => {
  test("inizio settimana: lunedì 00:00 di Roma", () => {
    // Tuesday 20 October 2026, 15:52 in Rome (13:52 UTC)
    const start = getWeekStart("2026-10-20T13:52:00Z");
    expect(toDateFieldValue(start)).toBe("2026-10-19");
    expect(start.toISOString()).toBe("2026-10-18T22:00:00.000Z");
    // Sunday late evening belongs to the week that ends that day
    expect(toDateFieldValue(getWeekStart("2026-10-25T20:30:00Z"))).toBe(
      "2026-10-19",
    );
    // Monday 26 October 00:30 UTC is 01:30 in Rome (winter time): a new week
    expect(toDateFieldValue(getWeekStart("2026-10-26T00:30:00Z"))).toBe(
      "2026-10-26",
    );
  });

  test("il cambio dell'ora: la settimana del 25 ottobre 2026 ha un giorno di 25 ore", () => {
    const days = getWeekDays("2026-10-21");
    expect(days.map((d) => d.key)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    const hours = days.map(
      (d) => (d.end.getTime() - d.start.getTime()) / 3_600_000,
    );
    expect(hours).toEqual([24, 24, 24, 24, 24, 24, 25]);
    // each day starts where the previous one ends
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.start.getTime()).toBe(days[i - 1]!.end.getTime());
    }
    // the week after is all 24 hours, starting at 00:00 winter time
    expect(getCalendarDay("2026-10-26").start.toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });

  test("il cambio dell'ora di primavera: giorno di 23 ore", () => {
    const day = getCalendarDay("2026-03-29");
    expect((day.end.getTime() - day.start.getTime()) / 3_600_000).toBe(23);
    expect(getWeekDays("2026-03-29")[0]!.key).toBe("2026-03-23");
  });

  test("una settimana a cavallo dell'anno", () => {
    const keys = getWeekDays("2027-01-01").map((d) => d.key);
    expect(keys[0]).toBe("2026-12-28");
    expect(keys[6]).toBe("2027-01-03");
    expect(addDaysToDayKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("parametro settimana: data valida, non lunedì, non valido", () => {
    const now = "2026-10-20T13:52:00Z";
    expect(formatWeekParam(parseWeekParam("2026-10-26", now))).toBe(
      "2026-10-26",
    );
    expect(formatWeekParam(parseWeekParam("2026-10-21", now))).toBe(
      "2026-10-19",
    );
    for (const bad of [
      "xyz",
      "2026-02-30",
      "2026-13-01",
      "",
      undefined,
      null,
    ]) {
      expect(formatWeekParam(parseWeekParam(bad, now))).toBe("2026-10-19");
    }
    expect(formatWeekParam(parseWeekParam(["2026-11-02", "x"], now))).toBe(
      "2026-11-02",
    );
    expect(isValidDayKey("2026-10-20")).toBe(true);
    expect(isValidDayKey("2026-10-2")).toBe(false);
    expect(formatMonthParam("2026-10-22T10:00:00Z")).toBe("2026-10");
  });

  test("formatTimeRange e «Martedì 20»", () => {
    expect(
      formatTimeRange("2026-10-19T08:00:00Z", "2026-10-19T09:00:00Z"),
    ).toBe("10:00 – 11:00");
    expect(
      formatTimeRange("2026-10-20T07:00:00Z", "2026-10-20T13:00:00Z"),
    ).toBe("9:00 – 15:00");
    expect(formatDayNumber("2026-10-20T08:00:00Z")).toBe("Martedì 20");
    expect(
      formatDayNumber("2026-10-20T08:00:00Z", { capitalized: false }),
    ).toBe("martedì 20");
    expect(formatDayNumber("2026-10-31T23:30:00Z", { withMonth: true })).toBe(
      "Domenica 1 novembre",
    );
  });

  test("saluto: fasce orarie a Roma", () => {
    expect(formatGreeting("2026-10-20T03:59:00Z")).toBe("Buongiorno"); // 05:59
    expect(formatGreeting("2026-10-20T02:59:00Z")).toBe("Buonasera"); // 04:59
    expect(formatGreeting("2026-10-20T13:52:00Z")).toBe("Buon pomeriggio");
    expect(formatGreeting("2026-10-20T10:59:00Z")).toBe("Buongiorno"); // 12:59
    expect(formatGreeting("2026-10-20T11:00:00Z")).toBe("Buon pomeriggio"); // 13:00
    expect(formatGreeting("2026-10-20T15:59:00Z")).toBe("Buon pomeriggio"); // 17:59
    expect(formatGreeting("2026-10-20T16:00:00Z")).toBe("Buonasera"); // 18:00
    expect(formatGreeting("2026-10-20T22:30:00Z")).toBe("Buonasera");
    // the clock change does not move the thresholds
    expect(formatGreeting("2026-10-25T03:59:00Z")).toBe("Buonasera"); // 04:59 CET
    expect(formatGreeting("2026-10-25T04:00:00Z")).toBe("Buongiorno"); // 05:00 CET
  });

  test("scadenze in parole (tabella della #23)", () => {
    const now = "2026-10-20T13:52:00Z"; // martedì 20 ottobre
    const d = (due: string, capitalized = true) =>
      formatDeadline(due, now, { capitalized });
    expect(d("2026-10-20T20:00:00Z")).toBe("Entro oggi");
    expect(d("2026-10-21T08:00:00Z")).toBe("Entro domani");
    expect(d("2026-10-21T08:00:00Z", false)).toBe("entro domani");
    expect(d("2026-10-23T08:00:00Z")).toBe("Entro venerdì");
    expect(d("2026-10-23T08:00:00Z", false)).toBe("entro venerdì");
    // Sunday 25 is the last weekday word; Monday 26 is a date
    expect(d("2026-10-25T12:00:00Z")).toBe("Entro domenica");
    expect(d("2026-10-26T08:00:00Z")).toBe("Entro 26 ottobre");
    expect(d("2026-10-27T08:00:00Z", false)).toBe("entro 27 ottobre");
    expect(d("2027-01-15T10:00:00Z")).toBe("Entro 15 gennaio 2027");
    // last day of a month
    expect(d("2026-10-31T10:00:00Z")).toBe("Entro fine mese");
    expect(d("2026-11-30T10:00:00Z")).toBe("Entro fine novembre");
    expect(d("2026-11-30T10:00:00Z", false)).toBe("entro fine novembre");
    expect(d("2027-01-31T10:00:00Z")).toBe("Entro fine gennaio 2027");
    // already gone
    expect(d("2026-10-19T10:00:00Z")).toBe("Scaduto ieri");
    expect(d("2026-10-19T10:00:00Z", false)).toBe("scaduto ieri");
    expect(d("2026-10-15T10:00:00Z")).toBe("Scaduto il 15 ottobre");
    // the day is the Rome day: 23:30 UTC on the 20th is already the 21st
    expect(d("2026-10-20T23:30:00Z")).toBe("Entro domani");
    // end of month inside this week reads as a weekday
    expect(formatDeadline("2026-10-31T10:00:00Z", "2026-10-27T10:00:00Z")).toBe(
      "Entro sabato",
    );
  });

  test("articolo davanti ai giorni 1, 8 e 11", () => {
    const now = "2026-10-20T13:52:00Z";
    expect(formatFirstDeadline("2026-11-08T10:00:00Z", now)).toBe(
      "Il primo scade l'8 novembre",
    );
    expect(formatFirstDeadline("2026-11-11T10:00:00Z", now)).toBe(
      "Il primo scade l'11 novembre",
    );
    expect(formatFirstDeadline("2026-11-01T10:00:00Z", now)).toBe(
      "Il primo scade l'1 novembre",
    );
    expect(formatFirstDeadline("2026-11-18T10:00:00Z", now)).toBe(
      "Il primo scade il 18 novembre",
    );
    // «entro» has no article
    expect(formatDeadline("2026-11-08T10:00:00Z", now)).toBe(
      "Entro 8 novembre",
    );
    const later = "2026-11-20T13:52:00Z";
    expect(formatDeadline("2026-11-08T10:00:00Z", later)).toBe(
      "Scaduto l'8 novembre",
    );
    expect(formatDeadline("2026-11-11T10:00:00Z", later)).toBe(
      "Scaduto l'11 novembre",
    );
    expect(formatDeadline("2026-11-01T10:00:00Z", later)).toBe(
      "Scaduto l'1 novembre",
    );
    expect(formatFirstDeadline("2026-11-08T10:00:00Z", later)).toBe(
      "Il primo è scaduto l'8 novembre",
    );
    expect(
      formatDeadline("2026-11-15T10:00:00Z", later, { capitalized: false }),
    ).toBe("scaduto il 15 novembre");
  });

  test("«Il primo scade ...»", () => {
    const now = "2026-10-20T13:52:00Z";
    const f = (due: string, capitalized = true) =>
      formatFirstDeadline(due, now, { capitalized });
    expect(f("2026-10-20T10:00:00Z")).toBe("Il primo scade oggi");
    expect(f("2026-10-21T10:00:00Z")).toBe("Il primo scade domani");
    expect(f("2026-10-23T10:00:00Z")).toBe("Il primo scade venerdì");
    expect(f("2026-10-23T10:00:00Z", false)).toBe("il primo scade venerdì");
    expect(f("2026-10-28T10:00:00Z")).toBe("Il primo scade il 28 ottobre");
    expect(f("2026-10-31T10:00:00Z")).toBe("Il primo scade a fine mese");
    expect(f("2026-10-19T10:00:00Z")).toBe("Il primo è scaduto ieri");
    expect(f("2026-11-30T10:00:00Z")).toBe("Il primo scade a fine novembre");
    expect(f("2027-01-31T10:00:00Z")).toBe(
      "Il primo scade a fine gennaio 2027",
    );
  });

  test("scadenze attraverso il cambio dell'ora", () => {
    // Saturday 24 Oct 22:30 UTC = Sunday 25 Oct 00:30 Rome (still summer time)
    const now = "2026-10-24T20:00:00Z";
    expect(formatDeadline("2026-10-25T12:00:00Z", now)).toBe("Entro domani");
    expect(formatDeadline("2026-10-26T12:00:00Z", now)).toBe(
      "Entro 26 ottobre",
    );
  });
});

/* ---------- Visibility and lens ---------- */

const ME = "m-giulia";
const PAOLO = "m-paolo";
const ANNA = "m-anna";
const LEO = "m-leo";
const ADULTS = [ME, PAOLO, ANNA];

/** Rome time on 20-26 October 2026 as UTC (CEST until the 25th, then CET). */
function at(dayKey: string, time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const [y, m, d] = dayKey.split("-").map(Number);
  const offset = Date.UTC(y!, m! - 1, d!) < Date.UTC(2026, 9, 25) ? 2 : 1;
  return new Date(
    Date.UTC(y!, m! - 1, d!, hour! - offset, minute!),
  ).toISOString();
}

let counter = 0;
function full(
  dayKey: string,
  from: string,
  to: string,
  extra: Partial<FullEvent> = {},
): FullEvent {
  counter += 1;
  return {
    masked: false,
    id: `e-${counter}`,
    startsAt: at(dayKey, from),
    endsAt: at(dayKey, to),
    visibility: "household",
    authorMemberId: ME,
    title: `Impegno ${counter}`,
    location: null,
    escortMemberId: null,
    memberIds: [ME],
    ...extra,
  };
}
function masked(
  dayKey: string,
  from: string,
  to: string,
  author = PAOLO,
): MaskedEvent {
  return {
    masked: true,
    startsAt: at(dayKey, from),
    endsAt: at(dayKey, to),
    visibility: "busy",
    authorMemberId: author,
  };
}

test.describe("testi comuni e lente", () => {
  test("parole della visibilità e riga «Occupato»", () => {
    expect(VISIBILITY_LABELS).toEqual({
      household: "Tutto il Nest",
      busy: "Occupato",
      private: "Solo io",
    });
    expect(BUSY_TITLE).toBe("Occupato");
    expect(formatBusyLabel("Paolo")).toBe("Paolo ha un impegno");
    expect(formatHiddenCount(1)).toBe("1 impegno degli altri nascosto");
    expect(formatHiddenCount(3)).toBe("3 impegni degli altri nascosti");
  });

  test("lente «Io»: partecipante, accompagnatore o autore; mai gli «Occupato» degli altri", () => {
    const mine = full("2026-10-20", "18:00", "19:00");
    const participant = full("2026-10-20", "17:00", "18:00", {
      authorMemberId: PAOLO,
      memberIds: [PAOLO, ME],
    });
    const escort = full("2026-10-20", "16:00", "17:00", {
      authorMemberId: PAOLO,
      memberIds: [LEO],
      escortMemberId: ME,
    });
    const others = full("2026-10-20", "17:00", "18:00", {
      authorMemberId: PAOLO,
      memberIds: [PAOLO, LEO],
    });
    const busyOther = masked("2026-10-20", "9:00", "15:00");
    const all: HouseholdEvent[] = [
      mine,
      participant,
      escort,
      others,
      busyOther,
    ];
    expect(filterByLens(all, "io", ME)).toEqual([mine, participant, escort]);
    expect(filterByLens(all, "nest", ME)).toHaveLength(5);
    expect(hiddenByLens(all, ME)).toEqual([others, busyOther]);
  });

  test("righe del giorno: ordine per inizio, durata, titolo; un impegno in ogni giorno che tocca", () => {
    const [monday, tuesday] = getWeekDays("2026-10-19");
    const late = full("2026-10-19", "23:00", "23:30", { title: "Tardi" });
    late.endsAt = at("2026-10-20", "1:00");
    const bravo = full("2026-10-21", "18:00", "19:00", { title: "Bravo" });
    const alfa = full("2026-10-21", "18:00", "18:30", { title: "Alfa" });
    const zeta = full("2026-10-21", "9:00", "10:00", { title: "Zeta" });
    const wednesday = getWeekDays("2026-10-21")[2]!;
    expect(
      eventsOfDay([bravo, alfa, zeta], wednesday).map((e) =>
        e.masked ? "" : e.title,
      ),
    ).toEqual(["Zeta", "Alfa", "Bravo"]);
    expect(eventsOfDay([late], monday!)).toHaveLength(1);
    expect(eventsOfDay([late], tuesday!)).toHaveLength(1);
    expect(eventsOfDay([late], wednesday)).toHaveLength(0);
    // an event ending exactly at midnight does not touch the next day
    const toMidnight = full("2026-10-19", "22:00", "23:00");
    toMidnight.endsAt = tuesday!.start.toISOString();
    expect(eventsOfDay([toMidnight], tuesday!)).toHaveLength(0);
  });
});

/* ---------- Liberi insieme ---------- */

const WEEK = getWeekDays("2026-10-19");

function evening(events: HouseholdEvent[], day: string, adults = ADULTS) {
  return computeFreeEvenings(WEEK, adults, events).get(day) ?? null;
}

test.describe("Liberi insieme", () => {
  test("CA-21: libero dalle 20:00 a fine serata", () => {
    const events = [
      full("2026-10-20", "18:00", "20:00", { memberIds: [ME, PAOLO, ANNA] }),
    ];
    const free = evening(events, "2026-10-20");
    expect(free?.untilEndOfEvening).toBe(true);
    expect(free?.wholeEvening).toBe(false);
    expect(formatFreeEveningWindow(free!)).toBe("Dalle 20:00 a fine serata");
    expect(formatFreeEveningRow(free!, ["Paolo", "Anna"])).toBe(
      "Tu, Paolo e Anna, fino a fine serata",
    );
  });

  test("CA-22: serata intera, e finestra che finisce prima delle 23:00", () => {
    const events = [
      full("2026-10-20", "18:00", "20:00", { memberIds: [ME, PAOLO, ANNA] }),
      full("2026-10-21", "20:00", "23:00", {
        authorMemberId: PAOLO,
        memberIds: [PAOLO],
      }),
    ];
    const wednesday = evening(events, "2026-10-21");
    expect(formatFreeEveningWindow(wednesday!)).toBe("Dalle 18:00 alle 20:00");
    expect(formatFreeEveningRow(wednesday!, ["Paolo", "Anna"])).toBe(
      "Tu, Paolo e Anna, fino alle 20:00",
    );
    const thursday = evening(events, "2026-10-22");
    expect(formatFreeEveningWindow(thursday!)).toBe(
      "Tutta la sera, dalle 18:00",
    );
    expect(computeFreeEvenings(WEEK, ADULTS, events).size).toBe(7);
  });

  test("CA-23: 45 minuti non bastano, 60 sì", () => {
    const short = [
      full("2026-10-22", "18:00", "22:15", {
        authorMemberId: PAOLO,
        memberIds: [PAOLO],
      }),
    ];
    expect(evening(short, "2026-10-22")).toBeNull();
    const enough = [
      full("2026-10-22", "18:00", "22:00", {
        authorMemberId: PAOLO,
        memberIds: [PAOLO],
      }),
    ];
    expect(formatFreeEveningWindow(evening(enough, "2026-10-22")!)).toBe(
      "Dalle 22:00 a fine serata",
    );
  });

  test("CA-24: vince la finestra più lunga, a parità la più presto", () => {
    const middle = [
      full("2026-10-23", "19:00", "20:30", {
        authorMemberId: PAOLO,
        memberIds: [PAOLO],
      }),
    ];
    expect(formatFreeEveningWindow(evening(middle, "2026-10-23")!)).toBe(
      "Dalle 20:30 a fine serata",
    );
    const tie = [
      full("2026-10-23", "19:30", "21:30", {
        authorMemberId: PAOLO,
        memberIds: [PAOLO],
      }),
    ];
    expect(formatFreeEveningWindow(evening(tie, "2026-10-23")!)).toBe(
      "Dalle 18:00 alle 19:30",
    );
  });

  test("CA-25: Occupato, Solo io, figli senza e con accompagnatore", () => {
    const base = full("2026-10-19", "10:00", "11:00");
    const day = "2026-10-24";
    expect(evening([base, masked(day, "18:00", "23:00")], day)).toBeNull();
    const soloIo = full(day, "18:00", "23:00", {
      authorMemberId: PAOLO,
      visibility: "private",
      memberIds: [PAOLO],
    });
    expect(formatFreeEveningWindow(evening([base, soloIo], day)!)).toBe(
      "Tutta la sera, dalle 18:00",
    );
    const child = full(day, "18:00", "23:00", {
      authorMemberId: PAOLO,
      memberIds: [LEO],
    });
    expect(formatFreeEveningWindow(evening([base, child], day)!)).toBe(
      "Tutta la sera, dalle 18:00",
    );
    const childWithEscort = { ...child, escortMemberId: ANNA };
    expect(evening([base, childWithEscort], day)).toBeNull();
  });

  test("CA-26: con un solo adulto, o senza impegni, non c'è mai", () => {
    const events = [full("2026-10-20", "9:00", "10:00")];
    expect(computeFreeEvenings(WEEK, [ME], events).size).toBe(0);
    expect(computeFreeEvenings(WEEK, ADULTS, []).size).toBe(0);
    expect(computeFreeEvenings(WEEK, ADULTS, events).size).toBe(7);
  });

  test("finestra 18:00-23:00 nel giorno del cambio dell'ora", () => {
    const sunday = "2026-10-25";
    const free = findFreeEvening(sunday, []);
    expect(free?.wholeEvening).toBe(true);
    // 18:00 CET = 17:00 UTC
    expect(free?.start.toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(free?.end.toISOString()).toBe("2026-10-25T22:00:00.000Z");
    const busy = [
      {
        start: new Date("2026-10-25T17:00:00Z").getTime(),
        end: new Date("2026-10-25T19:00:00Z").getTime(),
      },
    ];
    expect(formatFreeEveningWindow(findFreeEvening(sunday, busy)!)).toBe(
      "Dalle 20:00 a fine serata",
    );
  });

  test("un impegno che inizia prima delle 18:00 o finisce dopo le 23:00 conta solo nella fascia", () => {
    const events = [
      full("2026-10-20", "14:00", "19:00", {
        authorMemberId: PAOLO,
        memberIds: [PAOLO],
      }),
    ];
    expect(formatFreeEveningWindow(evening(events, "2026-10-20")!)).toBe(
      "Dalle 19:00 a fine serata",
    );
  });

  test("testo «Tu e ...»", () => {
    expect(formatWithYou(["Laura"])).toBe("Tu e Laura");
    expect(formatWithYou(["Laura", "Paolo"])).toBe("Tu, Laura e Paolo");
    expect(formatWithYou(["A", "B", "C", "D"])).toBe("Tu e altri 4");
  });
});

/* ---------- listHouseholdEvents ---------- */

type Row =
  Database["public"]["Functions"]["list_household_events"]["Returns"][number];

function fakeClient(
  response: { data: unknown; error: unknown } | (() => never),
  calls: Array<{ fn: string; args: unknown }> = [],
) {
  return {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (typeof response === "function") return response();
      return response;
    },
  } as unknown as SupabaseClient<Database>;
}

const FROM = "2026-10-18T22:00:00Z";
const TO = "2026-10-25T22:00:00Z";

test.describe("listHouseholdEvents", () => {
  test("chiama l'RPC con il periodo in UTC e distingue righe mascherate e complete", async () => {
    const rows = [
      {
        id: "e-1",
        starts_at: "2026-10-20T07:00:00+00:00",
        ends_at: "2026-10-20T08:00:00+00:00",
        visibility: "household",
        author_member_id: "m-1",
        is_masked: false,
        title: "Cena da Marta",
        location: "Via Roma 1",
        escort_member_id: null,
        member_ids: ["m-1", "m-2"],
      },
      {
        id: null,
        starts_at: "2026-10-20T07:00:00+00:00",
        ends_at: "2026-10-20T13:00:00+00:00",
        visibility: "busy",
        author_member_id: "m-2",
        is_masked: true,
        title: null,
        location: null,
        escort_member_id: null,
        member_ids: null,
      },
    ];
    const calls: Array<{ fn: string; args: unknown }> = [];
    const result = await listHouseholdEvents(
      new Date(FROM),
      TO,
      fakeClient({ data: rows, error: null }, calls),
    );
    expect(calls).toEqual([
      {
        fn: "list_household_events",
        args: {
          p_from: "2026-10-18T22:00:00.000Z",
          p_to: "2026-10-25T22:00:00.000Z",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [complete, hidden] = result.events;
    expect(complete).toEqual({
      masked: false,
      id: "e-1",
      startsAt: "2026-10-20T07:00:00+00:00",
      endsAt: "2026-10-20T08:00:00+00:00",
      visibility: "household",
      authorMemberId: "m-1",
      title: "Cena da Marta",
      location: "Via Roma 1",
      escortMemberId: null,
      memberIds: ["m-1", "m-2"],
    });
    expect(hidden).toEqual({
      masked: true,
      startsAt: "2026-10-20T07:00:00+00:00",
      endsAt: "2026-10-20T13:00:00+00:00",
      visibility: "busy",
      authorMemberId: "m-2",
    });
    // the masked row has no detail field at all, not even as null
    expect(Object.keys(hidden!).sort()).toEqual([
      "authorMemberId",
      "endsAt",
      "masked",
      "startsAt",
      "visibility",
    ]);
  });

  test("una riga mascherata non porta mai dettagli, anche se arrivassero", async () => {
    const row = {
      id: "e-9",
      starts_at: "2026-10-20T07:00:00Z",
      ends_at: "2026-10-20T08:00:00Z",
      visibility: "busy",
      author_member_id: "m-2",
      is_masked: true,
      title: "Riunione segreta",
      location: "Ufficio Nord",
      escort_member_id: "m-3",
      member_ids: ["m-3"],
    } satisfies Row;
    const result = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient({ data: [row], error: null }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.events)).not.toContain("Riunione segreta");
    expect(JSON.stringify(result.events)).not.toContain("Ufficio Nord");
    expect(JSON.stringify(result.events)).not.toContain("e-9");
    expect(result.events[0]?.masked).toBe(true);
  });

  test("una riga senza dettagli ma non dichiarata mascherata resta mascherata; un «Solo io» scartato", async () => {
    const base = {
      id: null,
      starts_at: "2026-10-20T07:00:00Z",
      ends_at: "2026-10-20T08:00:00Z",
      author_member_id: "m-2",
      is_masked: false,
      title: null,
      location: null,
      escort_member_id: null,
      member_ids: null,
    };
    const result = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient({
        data: [
          { ...base, visibility: "busy" },
          { ...base, visibility: "private" },
        ],
        error: null,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.masked).toBe(true);
  });

  test("errore del database, eccezione, risposta strana, periodo non valido: ok false, senza dettagli", async () => {
    const failing = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient({
        data: null,
        error: { message: "the period cannot last more than 42 days" },
      }),
    );
    expect(failing).toEqual({ ok: false });
    const throwing = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient(() => {
        throw new Error("Failed to fetch");
      }),
    );
    expect(throwing).toEqual({ ok: false });
    const strange = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient({ data: { not: "a list" }, error: null }),
    );
    expect(strange).toEqual({ ok: false });
    const calls: Array<{ fn: string; args: unknown }> = [];
    const client = fakeClient({ data: [], error: null }, calls);
    expect(await listHouseholdEvents(TO, FROM, client)).toEqual({ ok: false });
    expect(await listHouseholdEvents("non una data", TO, client)).toEqual({
      ok: false,
    });
    expect(calls).toHaveLength(0);
  });

  test("un «Tutto il Nest» con l'autore uscito dal Nest arriva completo con autore null", async () => {
    const result = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient({
        data: [
          {
            id: "e-5",
            starts_at: "2026-10-20T16:00:00Z",
            ends_at: "2026-10-20T18:00:00Z",
            visibility: "household",
            author_member_id: null,
            is_masked: false,
            title: "Cena",
            location: null,
            escort_member_id: null,
            member_ids: ["m-1"],
          },
          // impossible rows: masked without author, null instead of a row
          {
            id: null,
            starts_at: "2026-10-20T07:00:00Z",
            ends_at: "2026-10-20T08:00:00Z",
            visibility: "busy",
            author_member_id: null,
            is_masked: true,
            title: null,
            location: null,
            escort_member_id: null,
            member_ids: null,
          },
          null,
        ],
        error: null,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    const event = result.events[0]!;
    expect(event.masked).toBe(false);
    expect(event.masked ? null : event.authorMemberId).toBeNull();
    // the shared rules cope with a missing author
    expect(isInvolved(event, "m-2")).toBe(false);
    expect(isInvolved(event, "m-1")).toBe(true);
    expect(busyIntervals(result.events, ["m-1", "m-2"])).toHaveLength(1);
  });

  test("nessuna riga: ok con elenco vuoto", async () => {
    const result = await listHouseholdEvents(
      FROM,
      TO,
      fakeClient({ data: [], error: null }),
    );
    expect(result).toEqual({ ok: true, events: [] });
  });
});

/* ---------- CSS and placeholders ---------- */

const css = readFileSync("src/app/components.css", "utf8");
const designerBlock = css.slice(
  css.indexOf("STATI AGGIUNTI DAL DESIGNER"),
  css.indexOf("CORNICE DELL'APP"),
);

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");
}

test.describe("stati CSS", () => {
  test("le regole nuove stanno nel blocco del designer", () => {
    const block = normalize(designerBlock);
    for (const rule of [
      "a.riga-evento:not(.riga-evento--insieme, .riga-evento--occupato):hover",
      "a.scheda.prossimo:hover",
      ".striscia-giorni__giorno:not(.is-selezionato):hover",
      "a.blocco-orario:not(.blocco-orario--insieme, .blocco-orario--occupato):hover",
      "div.blocco-orario { cursor: default; }",
      ".linea-adesso { top: calc(var(--h) * var(--adesso-ore, 0)); }",
      '.riga-gia-fatti[aria-expanded="true"] .icona:last-child { scale: 1 -1; }',
    ]) {
      expect(block, rule).toContain(rule);
    }
    // press state uses the same background as hover
    expect(block).toContain("a.scheda.prossimo:active");
  });

  test("le nuove regole usano solo variabili del design system", () => {
    const start = designerBlock.indexOf("Righe, schede, striscia e blocchi");
    const end = designerBlock.indexOf("Caricamento: il bottone");
    const added = designerBlock.slice(start, end);
    // no colour, px length or hand-written font: only var(...) and keywords
    expect(added).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(added).not.toMatch(/\brgba?\(/);
    expect(added).not.toMatch(/\b\d+(\.\d+)?px\b/);
  });

  test("la linea di adesso del mockup resta com'è", () => {
    expect(css).toContain(".linea-adesso.da-15-52 {");
  });
});

// /impegni/[id] has no placeholder any more: the page of issue #19 replaces it
// (its tests are in dettaglio-impegno*.spec.ts).
test.describe("segnaposto del calendario", () => {
  test("voci di PLACEHOLDERS", () => {
    for (const key of [
      "calendario-giorno",
      "calendario-mese",
      "impegno",
    ] as const) {
      const def = PLACEHOLDERS[key];
      expect(def.browserTitle).toBe(`FamilyNest · ${def.title}`);
      expect(def.icon).toBe("calendar");
    }
    expect(PLACEHOLDERS["calendario-giorno"].title).toBe("Calendario");
    expect(PLACEHOLDERS["calendario-mese"].title).toBe("Calendario");
  });

  // /calendario/giorno is the real page of issue #26 (calendario-giorno*.spec.ts).
  for (const [dir, key] of [["calendario/mese", "calendario-mese"]] as const) {
    test(`la pagina ${dir} chiama requireNest e mostra il segnaposto`, () => {
      const file = `src/app/(app)/${dir}/page.tsx`;
      expect(existsSync(file)).toBe(true);
      const source = readFileSync(file, "utf8");
      expect(source).toContain("await requireNest()");
      expect(source).toContain(`<PlaceholderPage pageKey="${key}"`);
      expect(source).toContain(`PLACEHOLDERS["${key}"].browserTitle`);
    });
  }
});

test.describe("segnaposto con l'utente (Supabase locale)", () => {
  for (const route of ["/calendario/mese?mese=2026-10"]) {
    test(`${route}: «In arrivo» con la voce Calendario attiva`, async ({
      page,
      baseURL,
    }, testInfo) => {
      test.skip(!usersConfigured("B"), skipReason("B"));
      await signInAs(page.context(), baseURL as string, "B");
      await page.goto(route);
      await expect(page.getByText("In arrivo")).toBeVisible();
      if (route.startsWith("/calendario/")) {
        await expect(
          page.getByRole("group", {
            name: "Punto di vista: solo tu o tutto il Nest",
          }),
        ).toBeVisible();
      }
      await expect(page.getByRole("main")).toHaveCount(1);
      if (testInfo.project.name === "mobile") {
        const nav = page.getByRole("navigation", {
          name: "Navigazione principale",
        });
        await expect(
          nav.getByRole("link", { name: "Calendario" }),
        ).toHaveAttribute("aria-current", "true");
      }
    });
  }
});

/* ---------- Stati CSS in un browser vero ---------- */

test.describe("stati CSS nel browser", () => {
  const styles = [readFileSync("src/app/globals.css", "utf8"), css].join("\n");

  async function render(page: import("@playwright/test").Page, body: string) {
    await page.setContent(
      `<!doctype html><html lang="it"><head><style>${styles}</style></head>` +
        `<body>${body}</body></html>`,
    );
  }

  test("passaggio del mouse e premuto: stesso fondo, solo sui cliccabili", async ({
    page,
  }) => {
    await render(
      page,
      `<a id="riga" class="riga-evento" href="#">Riga</a>
       <a id="insieme" class="riga-evento riga-evento--insieme" href="#">Insieme</a>
       <a id="occupato" class="riga-evento riga-evento--occupato" href="#">Occ</a>
       <a id="prossimo" class="scheda prossimo" href="#">Prossimo</a>
       <button id="giorno" class="striscia-giorni__giorno" type="button">22</button>
       <button id="giorno-sel" class="striscia-giorni__giorno is-selezionato" type="button">23</button>
       <a id="blocco" class="blocco-orario" style="position:static" href="#">Blocco</a>
       <div id="blocco-div" class="blocco-orario blocco-orario--occupato" style="position:static">Occupato</div>
       <div id="blocco-ins" class="blocco-orario blocco-orario--insieme" style="position:static">Insieme</div>
       <a id="passo" class="passo-partenza" href="#">Passo</a>
       <button id="fatti" class="riga-gia-fatti" type="button" aria-expanded="false">Già fatti</button>`,
    );
    const bg = (id: string) =>
      page
        .locator(`#${id}`)
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    // Colours are resolved by the browser: never compared as strings of CSS.
    const resolved = (name: string) =>
      page.evaluate((n) => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = `var(${n})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      }, name);
    const carta = await resolved("--color-carta");
    const carta2 = await resolved("--color-carta-2");

    for (const id of ["riga", "prossimo", "blocco", "passo", "giorno-sel"]) {
      await page.locator(`#${id}`).hover();
      await expect
        .poll(() => bg(id), { message: `${id} in hover` })
        .toBe(carta);
    }
    for (const id of ["giorno", "fatti"]) {
      await page.locator(`#${id}`).hover();
      await expect
        .poll(() => bg(id), { message: `${id} in hover` })
        .toBe(carta2);
    }
    // not clickable: no change
    for (const id of ["insieme", "occupato", "blocco-div", "blocco-ins"]) {
      const before = await bg(id);
      await page.locator(`#${id}`).hover();
      expect(await bg(id), `${id} non cambia`).toBe(before);
    }
    await page.mouse.move(0, 0);
    // the pressed state is the same as hover
    for (const [id, expected] of [
      ["riga", carta],
      ["prossimo", carta],
      ["giorno", carta2],
    ] as const) {
      await page.locator(`#${id}`).hover();
      await page.mouse.down();
      await expect
        .poll(() => bg(id), { message: `${id} premuto` })
        .toBe(expected);
      await page.mouse.up();
    }
  });

  test("cursore normale sui blocchi non cliccabili, non sui link", async ({
    page,
  }) => {
    await render(
      page,
      `<div id="div" class="blocco-orario blocco-orario--occupato">Occupato</div>
       <a id="link" class="blocco-orario" href="#">Blocco</a>`,
    );
    await expect(page.locator("#div")).toHaveCSS("cursor", "default");
    await expect(page.locator("#link")).not.toHaveCSS("cursor", "default");
  });

  test("linea di adesso: la posizione segue --adesso-ore", async ({ page }) => {
    await render(
      page,
      `<div style="position:relative;--h:50px;height:900px">
         <div id="linea" class="linea-adesso" style="--adesso-ore:7.8"></div>
       </div>`,
    );
    await expect(page.locator("#linea")).toHaveCSS("top", "390px");
    await page
      .locator("#linea")
      .evaluate((el) => el.style.setProperty("--adesso-ore", "2"));
    await expect(page.locator("#linea")).toHaveCSS("top", "100px");
  });

  test("freccia di «Già fatti» capovolta solo da aperta", async ({ page }) => {
    await render(
      page,
      `<button id="chiuso" class="riga-gia-fatti" type="button" aria-expanded="false"><span class="icona"></span><span class="icona"></span></button>
       <button id="aperto" class="riga-gia-fatti" type="button" aria-expanded="true"><span class="icona"></span><span class="icona"></span></button>`,
    );
    const scale = (id: string) =>
      page
        .locator(`#${id} .icona:last-child`)
        .evaluate((el) => getComputedStyle(el).scale);
    expect(await scale("chiuso")).toBe("none");
    expect(await scale("aperto")).toBe("1 -1");
  });
});

/* ---------- listHouseholdEvents contro la RPC vera (Supabase locale) ---------- */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// Members of the seeded Nests (scripts/seed-test-users.ts)
const GIULIA = "b1000000-0000-4000-8000-000000000001";
const PAOLO_ID = "b1000000-0000-4000-8000-000000000002";
const LEO_ID = "b1000000-0000-4000-8000-000000000003";
const ANNA_ID = "b1000000-0000-4000-8000-000000000004";

async function clientFor(key: "A" | "B" | "B2" | "C") {
  const client = createClient<Database>(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
    password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
  });
  if (error) throw new Error(`Accesso di prova fallito per ${key}`);
  return client;
}

// One free winter day (CET, no clock change) per test, never shared between
// workers: parallel tests and the two projects cannot see each other's events.
let dayCounter = 0;
function freshDay(parallelIndex: number): string {
  dayCounter += 1;
  const date = new Date(Date.UTC(2027, 0, 5 + parallelIndex * 8 + dayCounter));
  return date.toISOString().slice(0, 10);
}
const rome = (day: string, time: string) => `${day}T${time}:00+01:00`;

async function addEvent(
  client: SupabaseClient<Database>,
  event: {
    title: string;
    day: string;
    from: string;
    to: string;
    visibility: "household" | "busy" | "private";
    recurrence?: "none" | "weekly";
    weekdays?: number[];
    members?: string[];
  },
) {
  const { error } = await client.from("events").insert({
    title: event.title,
    starts_at: rome(event.day, event.from),
    ends_at: rome(event.day, event.to),
    visibility: event.visibility,
    recurrence: event.recurrence ?? "none",
    recurrence_weekdays: event.weekdays ?? null,
  });
  if (error) throw new Error("Creazione impegno di prova fallita");
  if (event.members?.length) {
    const { data } = await client
      .from("events")
      .select("id")
      .eq("title", event.title);
    const id = data?.[0]?.id;
    if (!id) throw new Error("Impegno di prova non trovato");
    const { error: peopleError } = await client
      .from("event_members")
      .insert(event.members.map((member_id) => ({ event_id: id, member_id })));
    if (peopleError) throw new Error("Partecipanti di prova non aggiunti");
  }
}

async function removeEvents(client: SupabaseClient<Database>, tag: string) {
  await client.from("events").delete().like("title", `${tag}%`);
}

test.describe("listHouseholdEvents contro la RPC vera (#88)", () => {
  test.beforeEach(() => {
    test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
  });

  test("impegno per tutto il Nest, Occupato e Solo io: ognuno vede quello che deve", async ({}, testInfo) => {
    const tag = `T88-${randomUUID().slice(0, 8)}`;
    const day = freshDay(testInfo.parallelIndex);
    const giulia = await clientFor("B");
    const paolo = await clientFor("B2");
    const marco = await clientFor("A");
    try {
      await addEvent(giulia, {
        title: `${tag} Cena`,
        day,
        from: "09:00",
        to: "10:00",
        visibility: "household",
        members: [GIULIA, LEO_ID],
      });
      await addEvent(giulia, {
        title: `${tag} Riunione riservata`,
        day,
        from: "12:00",
        to: "14:00",
        visibility: "busy",
      });
      await addEvent(giulia, {
        title: `${tag} Medico personale`,
        day,
        from: "16:00",
        to: "17:00",
        visibility: "private",
      });
      const from = rome(day, "00:00");
      const to = rome(addDaysToDayKey(day, 1), "00:00");

      // Paolo, same Nest: full household event, masked «Occupato», no «Solo io»
      const seen = await listHouseholdEvents(from, to, paolo);
      expect(seen.ok).toBe(true);
      if (!seen.ok) return;
      expect(seen.events).toHaveLength(2);
      const [dinner, busy] = seen.events;
      expect(dinner).toMatchObject({
        masked: false,
        title: `${tag} Cena`,
        visibility: "household",
        authorMemberId: GIULIA,
        memberIds: [GIULIA, LEO_ID],
        location: null,
        escortMemberId: null,
      });
      expect(new Date(dinner!.startsAt).toISOString()).toBe(
        new Date(rome(day, "09:00")).toISOString(),
      );
      expect(busy).toEqual({
        masked: true,
        startsAt: expect.any(String),
        endsAt: expect.any(String),
        visibility: "busy",
        authorMemberId: GIULIA,
      });
      expect(Object.keys(busy!).sort()).toEqual([
        "authorMemberId",
        "endsAt",
        "masked",
        "startsAt",
        "visibility",
      ]);
      expect(new Date(busy!.startsAt).toISOString()).toBe(
        new Date(rome(day, "12:00")).toISOString(),
      );
      const text = JSON.stringify(seen.events);
      expect(text).not.toContain("Riunione riservata");
      expect(text).not.toContain("Medico personale");

      // the lens «Io» works on real ids
      expect(filterByLens(seen.events, "io", PAOLO_ID)).toEqual([]);
      expect(hiddenByLens(seen.events, PAOLO_ID)).toHaveLength(2);
      expect(filterByLens(seen.events, "io", LEO_ID)).toEqual([dinner]);

      // Giulia sees all three in full, in order
      const own = await listHouseholdEvents(from, to, giulia);
      expect(own.ok).toBe(true);
      if (!own.ok) return;
      expect(own.events.map((e) => (e.masked ? null : e.title))).toEqual([
        `${tag} Cena`,
        `${tag} Riunione riservata`,
        `${tag} Medico personale`,
      ]);

      // another Nest (Marco, Casa D'Angelo) sees nothing at all
      expect(await listHouseholdEvents(from, to, marco)).toEqual({
        ok: true,
        events: [],
      });
    } finally {
      await removeEvents(giulia, tag);
    }
  });

  test("Liberi insieme con dati veri: l'Occupato di Giulia toglie la sera anche a Paolo", async ({}, testInfo) => {
    const tag = `T88-${randomUUID().slice(0, 8)}`;
    const day = freshDay(testInfo.parallelIndex);
    const giulia = await clientFor("B");
    const paolo = await clientFor("B2");
    try {
      await addEvent(giulia, {
        title: `${tag} Serata`,
        day,
        from: "18:00",
        to: "23:00",
        visibility: "busy",
      });
      const week = getWeekDays(day);
      const adults = [GIULIA, PAOLO_ID, ANNA_ID];
      for (const reader of [giulia, paolo]) {
        const result = await listHouseholdEvents(
          week[0]!.start,
          week[6]!.end,
          reader,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const evenings = computeFreeEvenings(week, adults, result.events);
        // the busy evening is gone for both; the other days are free
        expect(evenings.has(day)).toBe(false);
        expect(evenings.size).toBe(6);
      }
    } finally {
      await removeEvents(giulia, tag);
    }
  });

  test("impegno ripetuto: una riga per ogni occorrenza, stesso id", async ({}, testInfo) => {
    const tag = `T88-${randomUUID().slice(0, 8)}`;
    const day = freshDay(testInfo.parallelIndex);
    const giulia = await clientFor("B");
    try {
      const isoDay = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
      await addEvent(giulia, {
        title: `${tag} Nuoto`,
        day,
        from: "17:00",
        to: "18:00",
        visibility: "household",
        recurrence: "weekly",
        weekdays: [isoDay],
      });
      // 15 days: the first day plus two repetitions
      const result = await listHouseholdEvents(
        rome(day, "00:00"),
        rome(addDaysToDayKey(day, 15), "00:00"),
        giulia,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const mine = result.events.filter(
        (e) => !e.masked && e.title.startsWith(tag),
      );
      expect(mine).toHaveLength(3);
      expect(new Set(mine.map((e) => (e.masked ? "" : e.id))).size).toBe(1);
      expect(new Set(mine.map((e) => e.startsAt)).size).toBe(3);
    } finally {
      await removeEvents(giulia, tag);
    }
  });

  test("stato vuoto: giorno senza impegni e utente senza Nest danno ok con elenco vuoto", async ({}, testInfo) => {
    const day = freshDay(testInfo.parallelIndex);
    const from = rome(day, "00:00");
    const to = rome(addDaysToDayKey(day, 1), "00:00");
    const giulia = await clientFor("B");
    expect(await listHouseholdEvents(from, to, giulia)).toEqual({
      ok: true,
      events: [],
    });
    const chiara = await clientFor("C");
    expect(await listHouseholdEvents(from, to, chiara)).toEqual({
      ok: true,
      events: [],
    });
  });

  test("errore: periodo oltre 42 giorni, senza accesso, database non raggiungibile", async ({}, testInfo) => {
    const day = freshDay(testInfo.parallelIndex);
    const from = rome(day, "00:00");
    const oneDay = rome(addDaysToDayKey(day, 1), "00:00");
    const giulia = await clientFor("B");
    expect(
      await listHouseholdEvents(
        from,
        rome(addDaysToDayKey(day, 50), "00:00"),
        giulia,
      ),
    ).toEqual({ ok: false });
    // exactly 42 days is the limit and works
    const edge = await listHouseholdEvents(
      from,
      rome(addDaysToDayKey(day, 42), "00:00"),
      giulia,
    );
    expect(edge.ok).toBe(true);
    // not signed in: the database refuses, the function does not throw
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const anonymous = createClient<Database>(
      supabaseUrl,
      publishableKey,
      options,
    );
    expect(await listHouseholdEvents(from, oneDay, anonymous)).toEqual({
      ok: false,
    });
    // unreachable server
    const unreachable = createClient<Database>(
      "http://127.0.0.1:9",
      publishableKey,
      options,
    );
    expect(await listHouseholdEvents(from, oneDay, unreachable)).toEqual({
      ok: false,
    });
  });
});
