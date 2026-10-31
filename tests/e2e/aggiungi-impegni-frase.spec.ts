import { expect, test } from "@playwright/test";
import {
  dayLabel,
  submitLabel,
  validatePhrase,
} from "../../src/components/aggiungi/labels";
import {
  parsePhrase,
  slotOf,
  type PhraseMember,
} from "../../src/components/aggiungi/parse-phrase";

// Reading of the phrase of Add · Impegni (#20, §4): pure functions, no browser.
// «Today» is Tuesday 20 October 2026; the members follow the seed of Casa D'Angelo.

const TODAY = "2026-10-20";
const MEMBERS: PhraseMember[] = [
  { id: "marco", name: "Marco" },
  { id: "laura", name: "Laura" },
  { id: "sofia", name: "Sofia" },
  { id: "tommaso", name: "Tommaso" },
  { id: "biscotto", name: "Biscotto" },
];

const clockFormat = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

function read(phrase: string) {
  const parsed = parsePhrase(phrase, TODAY, MEMBERS);
  return { parsed, slot: slotOf(parsed, TODAY) };
}

test.describe("Aggiungi · riconoscimento della frase", () => {
  test("CA-8: giorno, ora, persona e titolo di «Nuoto Sofia giovedì alle 17»", () => {
    const { parsed, slot } = read("Nuoto Sofia giovedì alle 17");
    expect(parsed.title).toBe("Nuoto Sofia");
    expect(parsed.dayKey).toBe("2026-10-22");
    expect(parsed.memberIds).toEqual(["sofia"]);
    expect(dayLabel("2026-10-22", TODAY)).toBe("Giovedì 22");
    expect(submitLabel("Nuoto Sofia giovedì alle 17", parsed, TODAY)).toBe(
      "Metti in giovedì 22",
    );
    // 17:00 Rome (CEST) = 15:00 UTC, one hour long
    expect(slot?.startsAt.toISOString()).toBe("2026-10-22T15:00:00.000Z");
    expect(slot?.endsAt.toISOString()).toBe("2026-10-22T16:00:00.000Z");
  });

  const days: Array<[string, string | null]> = [
    ["oggi", "Martedì 20"],
    ["domani", "Mercoledì 21"],
    ["dopodomani", "Giovedì 22"],
    ["martedì", "Martedì 20"],
    ["lunedi", "Lunedì 26"],
    ["DOMENICA", "Domenica 25"],
    ["7 novembre", "Sabato 7 novembre"],
    ["3/11", "Martedì 3 novembre"],
    ["7 ottobre", "Giovedì 7 ottobre 2027"],
    ["31/11", null],
  ];
  for (const [written, label] of days) {
    test(`CA-9: «${written}»`, () => {
      const { parsed } = read(`prova ${written}`);
      expect(parsed.dayKey ? dayLabel(parsed.dayKey, TODAY) : null).toBe(label);
    });
  }

  const times: Array<[string, string | null]> = [
    ["alle 9", "9:00"],
    ["alle 17:30", "17:30"],
    ["alle 17.30", "17:30"],
    ["ore 8", "8:00"],
    ["alle ore 21", "21:00"],
    ["alle 0", "0:00"],
    ["dalle 17 alle 18:30", "17:00 – 18:30"],
    ["alle 25", null],
  ];
  for (const [written, label] of times) {
    test(`CA-10: «${written}»`, () => {
      const { parsed, slot } = read(`prova domani ${written}`);
      let shown: string | null = null;
      if (slot) {
        shown = clockFormat.format(slot.startsAt);
        if (parsed.time?.end !== null) {
          shown += ` – ${clockFormat.format(slot.endsAt)}`;
        }
      }
      expect(shown).toBe(label);
    });
  }

  test("CA-11: persone in ordine dei membri, solo parole intere", () => {
    expect(
      read("cena con TOMMASO e laura e Biscotto domani alle 20").parsed
        .memberIds,
    ).toEqual(["laura", "tommaso", "biscotto"]);
    expect(read("Sofiamaria domani alle 20").parsed.memberIds).toEqual([]);
  });

  test("CA-14: «dentista il 7 novembre alle 16»", () => {
    const { parsed, slot } = read("dentista il 7 novembre alle 16");
    expect(parsed.title).toBe("Dentista");
    expect(parsed.memberIds).toEqual([]);
    expect(slot?.startsAt.toISOString()).toBe("2026-11-07T15:00:00.000Z");
  });

  test("CA-15: «dalle 22 alle 1» finisce il giorno dopo", () => {
    const { slot } = read("festa sabato dalle 22 alle 1");
    expect(slot?.startsAt.toISOString()).toBe("2026-10-24T20:00:00.000Z");
    expect(slot?.endsAt.toISOString()).toBe("2026-10-24T23:00:00.000Z");
  });

  test("CA-16: il giorno del cambio dell'ora si legge a Roma", () => {
    const { slot } = read("cena domenica alle 20");
    expect(slot?.startsAt.toISOString()).toBe("2026-10-25T19:00:00.000Z");
  });

  test("CA-17: solo l'ora vuol dire oggi", () => {
    const { parsed, slot } = read("calcetto alle 18");
    expect(parsed.dayKey).toBeNull();
    expect(slot?.dayKey).toBe(TODAY);
    expect(submitLabel("calcetto alle 18", parsed, TODAY)).toBe(
      "Metti in martedì 20",
    );
    expect(slot?.startsAt.toISOString()).toBe("2026-10-20T16:00:00.000Z");
  });

  test("CA-22, CA-23, CA-24: messaggi sotto il campo", () => {
    const hint = "scrivi per esempio «dentista giovedì alle 16».";
    expect(validatePhrase(read("giovedì").parsed)).toBe(
      `Manca cosa c'è da fare: ${hint}`,
    );
    expect(validatePhrase(read("dentista giovedì").parsed)).toBe(
      `Manca l'ora: ${hint}`,
    );
    expect(validatePhrase(read("dentista").parsed)).toBe(
      `Mancano il giorno e l'ora: ${hint}`,
    );
    const long100 = read(`${"a".repeat(100)} domani alle 10`).parsed;
    expect(validatePhrase(long100)).toBe(null);
    expect(long100.title).toMatch(/^A/);
    expect(
      validatePhrase(read(`${"a".repeat(101)} domani alle 10`).parsed),
    ).toBe("Il titolo può avere al massimo 100 caratteri.");
  });

  test("CA-25: solo spazi, il bottone resta «Aggiungi»", () => {
    expect(submitLabel("   ", read("   ").parsed, TODAY)).toBe("Aggiungi");
  });
});
