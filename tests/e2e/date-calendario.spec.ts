import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUSY_TITLE,
  VISIBILITY_LABELS,
  computeFreeEvenings,
  eventsOfDay,
  filterByLens,
  findFreeEvening,
  formatBusyLabel,
  formatFreeEveningRow,
  formatFreeEveningWindow,
  formatHiddenCount,
  formatWithYou,
  hiddenByLens,
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
    // Sunday 00:30 UTC is already Sunday 01:30 in Rome; Monday 22:30 UTC is Tuesday
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

  test("scadenze in parole", () => {
    const now = "2026-10-20T13:52:00Z"; // martedì 20 ottobre
    expect(formatDeadline("2026-10-20T20:00:00Z", now)).toBe("Entro oggi");
    expect(formatDeadline("2026-10-21T08:00:00Z", now)).toBe("Entro domani");
    expect(formatDeadline("2026-10-23T08:00:00Z", now)).toBe("Entro venerdì");
    expect(formatDeadline("2026-10-26T08:00:00Z", now)).toBe("Entro lunedì");
    expect(formatDeadline("2026-10-27T08:00:00Z", now)).toBe(
      "Entro il 27 ottobre",
    );
    expect(formatDeadline("2026-10-31T10:00:00Z", now)).toBe(
      "Entro il 31 ottobre",
    );
    expect(formatDeadline("2027-01-05T10:00:00Z", now)).toBe(
      "Entro il 5 gennaio 2027",
    );
    expect(formatDeadline("2026-10-19T10:00:00Z", now)).toBe(
      "Scaduto il 19 ottobre",
    );
    // the day is the Rome day: 23:30 UTC on the 20th is already the 21st
    expect(formatDeadline("2026-10-20T23:30:00Z", now)).toBe("Entro domani");
    expect(formatFirstDeadline("2026-10-20T10:00:00Z", now)).toBe(
      "Il primo scade oggi",
    );
    expect(formatFirstDeadline("2026-10-21T10:00:00Z", now)).toBe(
      "Il primo scade domani",
    );
    expect(formatFirstDeadline("2026-10-23T10:00:00Z", now)).toBe(
      "Il primo scade venerdì",
    );
    expect(formatFirstDeadline("2026-10-31T10:00:00Z", now)).toBe(
      "Il primo scade il 31 ottobre",
    );
  });

  test("scadenze attraverso il cambio dell'ora", () => {
    // Saturday 24 Oct 22:30 UTC = Sunday 25 Oct 00:30 Rome (still summer time)
    const now = "2026-10-24T20:00:00Z";
    expect(formatDeadline("2026-10-25T12:00:00Z", now)).toBe("Entro domani");
    expect(formatDeadline("2026-10-26T12:00:00Z", now)).toBe("Entro lunedì");
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
    // the author of a «Tutto il Nest» who is not a participant is not busy
    const hosted = full(day, "18:00", "23:00", {
      authorMemberId: PAOLO,
      memberIds: [LEO],
    });
    expect(evening([base, hosted], day)).not.toBeNull();
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

  for (const [dir, key] of [
    ["calendario/giorno", "calendario-giorno"],
    ["calendario/mese", "calendario-mese"],
    ["impegni/[id]", "impegno"],
  ] as const) {
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
  for (const route of [
    "/calendario/giorno?giorno=2026-10-22",
    "/calendario/mese?mese=2026-10",
    "/impegni/00000000-0000-0000-0000-000000000000",
  ]) {
    test(`${route}: «In arrivo» con la voce Calendario attiva`, async ({
      page,
      baseURL,
    }, testInfo) => {
      test.skip(!usersConfigured("B"), skipReason("B"));
      await signInAs(page.context(), baseURL as string, "B");
      await page.goto(route);
      await expect(page.getByText("In arrivo")).toBeVisible();
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
