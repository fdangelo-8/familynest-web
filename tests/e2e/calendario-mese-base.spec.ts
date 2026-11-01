import { expect, test } from "@playwright/test";
import {
  getMonthGridDays,
  getNextMonthKey,
  getPreviousMonthKey,
  parseMonthParam,
} from "../../src/lib/datetime";
import { easterSunday, holidayName } from "../../src/lib/holidays";

// Pure functions of the base of Calendario · Mese (#189): no browser needed.

test.describe("festività nazionali", () => {
  test("Pasqua e Pasquetta calcolate", () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2028)).toEqual({ month: 4, day: 16 });
    expect(holidayName("2026-04-05")).toBe("Pasqua");
    expect(holidayName("2026-04-06")).toBe("Pasquetta");
    expect(holidayName("2027-03-28")).toBe("Pasqua");
    expect(holidayName("2027-03-29")).toBe("Pasquetta");
    expect(holidayName("2028-04-17")).toBe("Pasquetta");
  });

  test("le date fisse e i nomi del requisito", () => {
    const expected: Record<string, string> = {
      "2026-01-01": "Capodanno",
      "2026-01-06": "Epifania",
      "2026-04-25": "Festa della Liberazione",
      "2026-05-01": "Festa del Lavoro",
      "2026-06-02": "Festa della Repubblica",
      "2026-08-15": "Ferragosto",
      "2026-11-01": "Ognissanti",
      "2026-12-08": "Immacolata",
      "2026-12-25": "Natale",
      "2026-12-26": "Santo Stefano",
    };
    for (const [day, name] of Object.entries(expected)) {
      expect(holidayName(day), day).toBe(name);
    }
  });

  test("il 4 ottobre è San Francesco dal 2026, non prima", () => {
    expect(holidayName("2026-10-04")).toBe("San Francesco");
    expect(holidayName("2027-10-04")).toBe("San Francesco");
    expect(holidayName("2025-10-04")).toBeNull();
  });

  test("i giorni normali e le date non valide non sono feste", () => {
    expect(holidayName("2026-10-03")).toBeNull();
    expect(holidayName("2026-10-20")).toBeNull();
    expect(holidayName("non-una-data")).toBeNull();
  });
});

test.describe("mese in ora di Roma", () => {
  const NOW = new Date("2026-10-20T13:52:00Z");

  test("lettura di ?mese=", () => {
    expect(parseMonthParam("2026-12", NOW)).toBe("2026-12-01");
    expect(parseMonthParam(["2027-03", "2026-01"], NOW)).toBe("2027-03-01");
    for (const bad of ["2026-13", "2026-00", "2026-1", "ottobre", "", null]) {
      expect(parseMonthParam(bad, NOW), String(bad)).toBe("2026-10-01");
    }
    expect(parseMonthParam(undefined, NOW)).toBe("2026-10-01");
  });

  test("a cavallo di mezzanotte conta il giorno di Roma", () => {
    // 31 ottobre 2026 23:30 a Roma = 22:30 UTC; 1 novembre 00:30 a Roma = 23:30 UTC del 31
    expect(parseMonthParam(null, new Date("2026-10-31T22:30:00Z"))).toBe(
      "2026-10-01",
    );
    expect(parseMonthParam(null, new Date("2026-10-31T23:30:00Z"))).toBe(
      "2026-11-01",
    );
  });

  test("mese prima e mese dopo", () => {
    expect(getPreviousMonthKey("2026-01-01")).toBe("2025-12-01");
    expect(getNextMonthKey("2026-12-01")).toBe("2027-01-01");
    expect(getNextMonthKey("2026-02-15")).toBe("2026-03-01");
    expect(getPreviousMonthKey("2026-03-31")).toBe("2026-02-01");
  });

  test("giorni della griglia: 28, 35 o 42, dal lunedì alla domenica", () => {
    const keys = (month: string) => getMonthGridDays(month).map((d) => d.key);
    // febbraio 2027 comincia di lunedì e finisce di domenica: 4 settimane
    const feb = keys("2027-02-01");
    expect(feb).toHaveLength(28);
    expect(feb[0]).toBe("2027-02-01");
    expect(feb[27]).toBe("2027-02-28");
    // ottobre 2026: da lunedì 28 settembre a domenica 1 novembre
    const oct = keys("2026-10-15");
    expect(oct).toHaveLength(35);
    expect(oct[0]).toBe("2026-09-28");
    expect(oct[34]).toBe("2026-11-01");
    // agosto 2026: 6 settimane, da lunedì 27 luglio a domenica 6 settembre
    const aug = keys("2026-08-01");
    expect(aug).toHaveLength(42);
    expect(aug[0]).toBe("2026-07-27");
    expect(aug[41]).toBe("2026-09-06");
  });

  test("la griglia di 6 settimane col cambio dell'ora resta nei 42 giorni", () => {
    // ottobre 2028: il cambio dell'ora è il 29 ottobre
    const days = getMonthGridDays("2028-10-01");
    expect(days).toHaveLength(42);
    const first = days[0]!;
    const last = days[41]!;
    const hours = (last.end.getTime() - first.start.getTime()) / 3_600_000;
    // un giorno di 25 ore: 42 giorni di Roma durano 1009 ore
    expect(hours).toBe(42 * 24 + 1);
  });
});
