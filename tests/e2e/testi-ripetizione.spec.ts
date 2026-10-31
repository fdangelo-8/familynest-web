import { expect, test } from "@playwright/test";
import {
  deleteDialogText,
  deleteToast,
  formatRecurrence,
  formatRepeatSentence,
  joinNames,
  saveAllText,
  saveChoiceText,
  saveNewRuleText,
  type RecurrenceInfo,
} from "../../src/lib/event-texts";

// Texts of repeated events (#165, texts of #19): pure functions.

const NOW = "2026-10-15T10:00:00Z";

const NUOTO: RecurrenceInfo = {
  recurrence: "weekly",
  weekdays: [4, 2],
  seriesDay: "2026-10-06",
  until: null,
};

test.describe("elenchi di nomi", () => {
  test("A, A e B, A, B e C", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Laura"])).toBe("Laura");
    expect(joinNames(["Laura", "Sofia"])).toBe("Laura e Sofia");
    expect(joinNames(["Tu", "Laura", "Sofia"])).toBe("Tu, Laura e Sofia");
  });
});

test.describe("riga «Ripete»", () => {
  test("giorni della settimana, nell'ordine da lunedì", () => {
    expect(formatRecurrence(NUOTO, NOW)).toBe("Ogni martedì e giovedì");
    expect(formatRecurrence({ ...NUOTO, weekdays: [5, 1, 3] }, NOW)).toBe(
      "Ogni lunedì, mercoledì e venerdì",
    );
    expect(formatRecurrence({ ...NUOTO, weekdays: [2] }, NOW)).toBe(
      "Ogni martedì",
    );
  });
  test("tutti e 7 i giorni: Ogni giorno", () => {
    expect(
      formatRecurrence({ ...NUOTO, weekdays: [1, 2, 3, 4, 5, 6, 7] }, NOW),
    ).toBe("Ogni giorno");
  });
  test("ogni mese, con «l'» per 1, 8 e 11", () => {
    const monthly = (seriesDay: string): RecurrenceInfo => ({
      recurrence: "monthly",
      weekdays: [],
      seriesDay,
      until: null,
    });
    expect(formatRecurrence(monthly("2026-10-20"), NOW)).toBe(
      "Ogni mese, il 20",
    );
    expect(formatRecurrence(monthly("2026-10-08"), NOW)).toBe("Ogni mese, l'8");
    expect(formatRecurrence(monthly("2026-10-01"), NOW)).toBe("Ogni mese, l'1");
    expect(formatRecurrence(monthly("2026-10-11"), NOW)).toBe(
      "Ogni mese, l'11",
    );
  });
  test("ultimo giorno: «, fino al 21 ottobre», con l'anno se è diverso", () => {
    expect(formatRecurrence({ ...NUOTO, until: "2026-10-21" }, NOW)).toBe(
      "Ogni martedì e giovedì, fino al 21 ottobre",
    );
    expect(formatRecurrence({ ...NUOTO, until: "2026-12-08" }, NOW)).toBe(
      "Ogni martedì e giovedì, fino all'8 dicembre",
    );
    expect(formatRecurrence({ ...NUOTO, until: "2027-01-15" }, NOW)).toBe(
      "Ogni martedì e giovedì, fino al 15 gennaio 2027",
    );
  });
  test("minuscolo e senza ultimo giorno", () => {
    const info = { ...NUOTO, until: "2026-10-21" };
    expect(
      formatRecurrence(info, NOW, { capitalized: false, withUntil: false }),
    ).toBe("ogni martedì e giovedì");
    expect(formatRepeatSentence(info, NOW)).toBe(
      "Si ripete ogni martedì e giovedì.",
    );
  });
  test("«Mai» non ha testo", () => {
    expect(formatRecurrence({ ...NUOTO, recurrence: "none" }, NOW)).toBe("");
    expect(formatRepeatSentence({ ...NUOTO, recurrence: "none" }, NOW)).toBe(
      "",
    );
  });
});

test.describe("dialogo e toast di eliminazione", () => {
  test("ripetizione e persone", () => {
    expect(deleteDialogText(NUOTO, ["Laura", "Sofia"], NOW)).toBe(
      "Si ripete ogni martedì e giovedì. Laura e Sofia non lo vedranno più nel calendario.",
    );
    expect(deleteDialogText(NUOTO, ["Laura"], NOW)).toBe(
      "Si ripete ogni martedì e giovedì. Laura non lo vedrà più nel calendario.",
    );
  });
  test("senza ripetizione e senza altri: Sparisce dal calendario.", () => {
    const none = { ...NUOTO, recurrence: "none" as const };
    expect(deleteDialogText(none, [], NOW)).toBe("Sparisce dal calendario.");
    expect(deleteDialogText(none, ["Laura"], NOW)).toBe(
      "Laura non lo vedrà più nel calendario.",
    );
  });
  test("toast per ogni bottone", () => {
    expect(deleteToast("all", "Nuoto Sofia", "2026-10-20", false, NOW)).toEqual(
      { text: "Eliminato:", emphasis: "Nuoto Sofia", after: "." },
    );
    expect(deleteToast("one", "Nuoto Sofia", "2026-10-20", false, NOW)).toEqual(
      {
        text: "Eliminato martedì 20 ottobre:",
        emphasis: "Nuoto Sofia",
        after: ".",
      },
    );
    expect(
      deleteToast("following", "Nuoto Sofia", "2026-10-20", false, NOW),
    ).toEqual({
      text: "Eliminato da martedì 20 ottobre in poi:",
      emphasis: "Nuoto Sofia",
      after: ".",
    });
    expect(
      deleteToast("following", "Nuoto Sofia", "2026-10-06", true, NOW).text,
    ).toBe("Eliminato:");
    expect(deleteToast("one", "X", "2027-01-05", false, NOW).text).toBe(
      "Eliminato martedì 5 gennaio 2027:",
    );
  });
});

test.describe("dialoghi di salvataggio", () => {
  test("due scelte: esempio completo del designer", () => {
    expect(
      saveChoiceText({
        info: NUOTO,
        openDay: "2026-10-22",
        isFirst: false,
        now: NOW,
      }),
    ).toBe(
      "Si ripete ogni martedì e giovedì. Puoi cambiare solo giovedì 22 ottobre oppure anche tutte le volte dopo, comprese quelle già cambiate a parte. Le volte prima restano come sono.",
    );
  });
  test("due scelte: prima volta e volta spostata da sola", () => {
    expect(
      saveChoiceText({
        info: NUOTO,
        openDay: "2026-10-06",
        isFirst: true,
        now: NOW,
      }),
    ).not.toContain("Le volte prima");
    expect(
      saveChoiceText({
        info: NUOTO,
        openDay: "2026-10-21",
        isFirst: false,
        movedAloneTo: "2026-10-20",
        now: NOW,
      }),
    ).toContain(
      "Questa volta era stata spostata da sola: con «Salva tutti i prossimi» va a martedì 20 ottobre, nel giorno della serie.",
    );
  });
  test("una scelta: chi cambiato", () => {
    expect(
      saveAllText({
        info: NUOTO,
        fromDay: "2026-10-22",
        isFirst: false,
        changes: ["members"],
        now: NOW,
      }),
    ).toBe(
      "Si ripete ogni martedì e giovedì. Hai cambiato chi partecipa: vale per tutte le volte da giovedì 22 ottobre in poi. Le volte prima restano come sono.",
    );
  });
  test("una scelta: elenco nell'ordine del modulo, dalla prima volta", () => {
    expect(
      saveAllText({
        info: NUOTO,
        fromDay: "2026-10-06",
        isFirst: true,
        changes: ["visibility", "members"],
        now: NOW,
      }),
    ).toBe(
      "Si ripete ogni martedì e giovedì. Hai cambiato chi partecipa e chi lo vede: vale per tutte le volte da martedì 6 ottobre in poi.",
    );
  });
  test("una scelta: «Mai» e La porta", () => {
    expect(
      saveAllText({
        info: NUOTO,
        fromDay: "2026-10-22",
        isFirst: false,
        changes: ["recurrence"],
        toNever: true,
        now: NOW,
      }),
    ).toBe(
      "Si ripete ogni martedì e giovedì. Con «Mai» resta solo giovedì 22 ottobre: le volte dopo spariscono dal calendario. Le volte prima restano come sono.",
    );
    expect(
      saveAllText({
        info: { ...NUOTO, weekdays: [1] },
        fromDay: "2026-10-26",
        isFirst: false,
        changes: [],
        escortUnseen: "Anna",
        now: NOW,
      }),
    ).toBe(
      "Si ripete ogni lunedì. Anna ora non vede questo impegno: se la scegli in «La porta», lo vedrà da lunedì 26 ottobre in poi. Le volte prima restano come sono.",
    );
  });
  test("ripetizione cambiata: solo «Salva tutti i prossimi»", () => {
    expect(saveNewRuleText(NUOTO, "2026-10-20", NOW)).toBe(
      "Si ripete ogni martedì e giovedì. La nuova ripetizione vale da martedì 20 ottobre in poi.",
    );
  });
});
