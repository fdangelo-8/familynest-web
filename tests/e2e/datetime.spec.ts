import { expect, test } from "@playwright/test";
import {
  formatDayRange,
  formatDaysUntil,
  formatLongDay,
  formatMonthYear,
  formatShortWeekday,
  formatTime,
  formatTimeUntil,
  fromFieldValues,
  toDateFieldValue,
  toTimeFieldValue,
} from "../../src/lib/datetime";

// Pure functions: no browser needed (CA-40 ... CA-45).

test.describe("date e ore", () => {
  test("CA-40: ora a Roma, anche dopo il cambio d'ora", () => {
    expect(formatTime("2026-10-20T15:00:00Z")).toBe("17:00");
    expect(formatTime("2026-10-26T07:30:00Z")).toBe("8:30");
  });

  test("CA-41: giorno lungo nel fuso di Roma", () => {
    expect(formatLongDay("2026-10-20T08:00:00Z")).toBe("Martedì 20 ottobre");
    expect(formatLongDay("2026-10-20T08:00:00Z", { capitalized: false })).toBe(
      "martedì 20 ottobre",
    );
    expect(formatLongDay("2026-10-20T22:30:00Z")).toBe("Mercoledì 21 ottobre");
  });

  test("CA-42: mese, intervallo e giorno breve", () => {
    expect(formatMonthYear("2026-10-15T10:00:00Z")).toBe("Ottobre 2026");
    expect(formatDayRange("2026-10-19T10:00:00Z", "2026-10-25T10:00:00Z")).toBe(
      "19 – 25 ottobre",
    );
    expect(formatShortWeekday("2026-10-19T10:00:00Z")).toBe("Lun");
    expect(formatDayRange("2026-09-28T10:00:00Z", "2026-10-04T10:00:00Z")).toBe(
      "28 settembre – 4 ottobre",
    );
    expect(formatDayRange("2026-12-29T10:00:00Z", "2027-01-04T10:00:00Z")).toBe(
      "29 dicembre 2026 – 4 gennaio 2027",
    );
  });

  test("CA-43: tempo che manca", () => {
    const now = "2026-10-20T14:52:00Z";
    expect(formatTimeUntil("2026-10-20T15:00:00Z", now)).toBe("tra 8 minuti");
    expect(formatTimeUntil("2026-10-20T16:00:00Z", now)).toBe("tra 1 h 8 min");
    expect(formatTimeUntil("2026-10-20T14:53:00Z", now)).toBe("tra 1 minuto");
    expect(formatTimeUntil("2026-10-20T14:52:30Z", now)).toBe(
      "tra meno di un minuto",
    );
    expect(formatTimeUntil("2026-10-20T16:52:00Z", now)).toBe("tra 2 h");
  });

  test("CA-44: giorni di calendario a Roma", () => {
    const now = "2026-10-20T21:30:00Z";
    expect(formatDaysUntil("2026-10-20T22:30:00Z", now)).toBe("domani");
    expect(formatDaysUntil("2026-11-03T10:00:00Z", now)).toBe("tra 14 giorni");
    expect(formatDaysUntil("2026-10-19T10:00:00Z", now)).toBe("ieri");
    expect(formatDaysUntil("2026-10-26T10:00:00Z", now)).toBe("tra 6 giorni");
  });

  test("CA-45: conversione campo <-> istante, anche al cambio d'ora", () => {
    const instant = fromFieldValues("2026-10-20", "17:00");
    expect(instant.toISOString()).toBe("2026-10-20T15:00:00.000Z");
    expect(toDateFieldValue(instant)).toBe("2026-10-20");
    expect(toTimeFieldValue(instant)).toBe("17:00");

    expect(fromFieldValues("2026-03-29", "02:30").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
    expect(fromFieldValues("2026-10-25", "02:30").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });
});
