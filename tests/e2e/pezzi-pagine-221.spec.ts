import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ICON_PATHS } from "../../src/components/ui/Icon/icon-paths";
import {
  getActiveNavItem,
  getBarConfig,
  getNavAriaCurrent,
  hasBottomNav,
  isSpaceRoute,
} from "../../src/lib/app-routes";
import { daysUntilBirthday, formatSchoolDays } from "../../src/lib/datetime";
import {
  DELETE_HOUSEHOLD_LABEL,
  getLeaveButtonLabel,
  getLeaveDialogCopy,
  getLeaveDoneToast,
} from "../../src/lib/leave-dialog";
import {
  MEMBER_FAILURE_TEXT,
  MEMBER_KIND_OPTIONS,
  MEMBER_NAME_ERROR,
  MEMBER_NAME_MAX_LENGTH,
} from "../../src/lib/member-texts";
import { getPinLabel, getPinToastText } from "../../src/lib/pin-texts";
import {
  addSpaceInterest,
  getSpaceInterests,
  removeSpaceInterest,
} from "../../src/lib/space-interests";
import { SPACES, getSpaceByHref } from "../../src/lib/spaces";

// Shared pieces for the pages #29, #31, #38 and #41 (request #221). Pure
// functions and CSS text: no browser, no database.

test.describe("barra di dettaglio con titolo (#41, #38)", () => {
  test("/profilo e /impostazioni hanno il titolo, le altre no", () => {
    expect(getBarConfig("/profilo")).toEqual({
      kind: "detail",
      fallback: "/nest",
      title: "Il tuo profilo",
    });
    expect(getBarConfig("/impostazioni")).toEqual({
      kind: "detail",
      fallback: "/nest",
      title: "Impostazioni",
    });
    expect(getBarConfig("/membri/abc")).toEqual({
      kind: "detail",
      fallback: "/nest",
    });
    expect(getBarConfig("/calendari-collegati")).toEqual({
      kind: "detail",
      fallback: "/nest",
    });
  });

  test("AppBar scrive il titolo come p.barra__titolo, mai come heading", () => {
    const source = readFileSync(
      "src/components/ui/AppFrame/AppBar.tsx",
      "utf8",
    );
    expect(source).toContain('<p className="barra__titolo">{config.title}</p>');
  });
});

test.describe("barra e navigazione di /figli e /esplora/<spazio> (#31, #29)", () => {
  test("/figli/<id>: Indietro con ripiego /nest", () => {
    expect(getBarConfig("/figli/abc")).toEqual({
      kind: "detail",
      fallback: "/nest",
    });
    expect(hasBottomNav("/figli/abc")).toBe(true);
  });

  test("/esplora/<spazio>: Indietro a /esplora, senza «Cerca nel Nest»", () => {
    for (const space of SPACES) {
      const config = getBarConfig(space.href);
      expect(config, space.href).toEqual({
        kind: "detail",
        fallback: "/esplora",
      });
    }
    expect(getBarConfig("/esplora")).toEqual({
      kind: "detail",
      fallback: "/nest",
      search: true,
    });
  });

  test("«Oggi» evidenziata solo per /esplora e i dieci indirizzi", () => {
    for (const path of ["/esplora", ...SPACES.map((space) => space.href)]) {
      expect(getActiveNavItem(path, "mobile"), path).toBe("oggi");
      expect(getActiveNavItem(path, "desktop"), path).toBeNull();
    }
    expect(getNavAriaCurrent("/esplora/a-tavola", "mobile", "oggi")).toBe(
      "true",
    );
    for (const path of [
      "/esplora/palestra",
      "/esplora/a-tavola/altro",
      "/esplora/",
      "/esploraxyz",
    ]) {
      expect(getActiveNavItem(path, "mobile"), path).toBeNull();
    }
    expect(isSpaceRoute("/esplora/zampe")).toBe(true);
    expect(isSpaceRoute("/esplora")).toBe(false);
  });
});

test.describe("catalogo degli spazi: righe di «In arrivo» (#29, CA-4)", () => {
  test("solo A tavola ha le tre righe, gli altri nove nessuna", () => {
    for (const space of SPACES) {
      expect(space.rows, space.name).toHaveLength(
        space.key === "meals" ? 3 : 0,
      );
      for (const row of space.rows) {
        expect(ICON_PATHS, row.icon).toHaveProperty(row.icon);
      }
    }
  });

  test("A tavola ha le righe del mockup", () => {
    expect(SPACES[0]?.rows).toEqual([
      { icon: "calendar-range", text: "Il piano dei pasti della settimana" },
      { icon: "book-open", text: "Ricette adatte a chi vive con te" },
      { icon: "shopping-basket", text: "La spesa che si scrive da sola" },
    ]);
  });

  test("getSpaceByHref trova solo i dieci indirizzi", () => {
    expect(getSpaceByHref("/esplora/noi-due")?.key).toBe("couple");
    expect(getSpaceByHref("/esplora/altro")).toBeUndefined();
    expect(getSpaceByHref("/esplora")).toBeUndefined();
  });
});

test.describe("frasi della puntina in un solo posto (#29, #28)", () => {
  test("testi esatti della specifica", () => {
    expect(getPinToastText("pinned", "A tavola")).toEqual({
      icon: "pin",
      lead: "A tavola",
      text: "fissato in fondo a Oggi.",
    });
    expect(getPinToastText("unpinned", "A tavola")).toEqual({
      icon: "pin",
      lead: "A tavola",
      text: "tolto da Oggi.",
    });
    expect(getPinToastText("limit", "Zampe")).toEqual({
      icon: null,
      text: "Puoi fissare al massimo sei spazi: togline uno per fissare",
      emphasis: "Zampe",
      after: ".",
    });
    const flat = (kind: Parameters<typeof getPinToastText>[0]) => {
      const t = getPinToastText(kind, "Noi due");
      return `${t.lead ?? ""} ${t.text} ${t.emphasis ?? ""}${t.after ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
    };
    expect(flat("pin-failed")).toBe(
      "Non siamo riusciti a fissare Noi due. Riprova tra qualche secondo.",
    );
    expect(flat("unpin-failed")).toBe(
      "Non siamo riusciti a togliere Noi due. Riprova tra qualche secondo.",
    );
    expect(flat("undo-failed-stays")).toBe(
      "Non siamo riusciti ad annullare: Noi due resta in Oggi.",
    );
    expect(flat("undo-failed-gone")).toBe(
      "Non siamo riusciti ad annullare: Noi due non è più in Oggi.",
    );
  });

  test("nome accessibile della puntina", () => {
    expect(getPinLabel("A tavola", false)).toBe("Fissa A tavola in Oggi");
    expect(getPinLabel("A tavola", true)).toBe("Togli A tavola da Oggi");
  });

  test("Esplora usa le stesse funzioni, senza frasi scritte a mano", () => {
    const hook = readFileSync("src/components/esplora/useSpaces.ts", "utf8");
    const page = readFileSync("src/components/esplora/EsploraPage.tsx", "utf8");
    expect(hook).not.toContain("Non siamo riusciti");
    expect(hook).not.toContain("Puoi fissare");
    expect(page).not.toContain("Fissa ${");
  });
});

test.describe("giorni al compleanno (#31)", () => {
  const now = "2026-11-04T10:00:00Z";

  test("oggi, domani, il giorno prima dell'anno dopo", () => {
    expect(daysUntilBirthday("2020-11-04", now)).toBe(0);
    expect(daysUntilBirthday("2020-11-05", now)).toBe(1);
    expect(daysUntilBirthday("2020-11-03", now)).toBe(364);
  });

  test("tiene conto del fuso di Roma", () => {
    // 23:30 UTC of the 3rd is already the 4th in Rome
    expect(daysUntilBirthday("2020-11-04", "2026-11-03T23:30:00Z")).toBe(0);
    expect(daysUntilBirthday("2020-11-04", "2026-11-04T23:30:00Z")).toBe(364);
  });

  test("nato il 29 febbraio: il 28 negli anni non bisestili", () => {
    expect(daysUntilBirthday("2020-02-29", now)).toBe(116);
    expect(daysUntilBirthday("2020-02-29", "2027-02-28T10:00:00Z")).toBe(0);
    expect(daysUntilBirthday("2020-02-29", "2027-03-01T10:00:00Z")).toBe(365);
    expect(daysUntilBirthday("2020-02-29", "2028-02-28T10:00:00Z")).toBe(1);
    expect(daysUntilBirthday("2020-02-29", "2028-02-29T10:00:00Z")).toBe(0);
  });

  test("data non valida: null", () => {
    expect(daysUntilBirthday("2026-02-30", now)).toBeNull();
    expect(daysUntilBirthday("", now)).toBeNull();
  });
});

test.describe("giorni di scuola (#31)", () => {
  test("un giorno solo", () => {
    expect(formatSchoolDays([1])).toBe("Il lunedì");
    expect(formatSchoolDays([6])).toBe("Il sabato");
    expect(formatSchoolDays([7])).toBe("La domenica");
  });

  test("tre o più giorni di fila", () => {
    expect(formatSchoolDays([1, 2, 3, 4, 5])).toBe("Dal lunedì al venerdì");
    expect(formatSchoolDays([1, 2, 3, 4, 5, 6])).toBe("Dal lunedì al sabato");
    expect(formatSchoolDays([1, 2, 3, 4, 5, 6, 7])).toBe(
      "Dal lunedì alla domenica",
    );
    expect(formatSchoolDays([2, 3, 4])).toBe("Dal martedì al giovedì");
    expect(formatSchoolDays([5, 6, 7])).toBe("Dal venerdì alla domenica");
  });

  test("tutti gli altri casi: elenco con «e»", () => {
    expect(formatSchoolDays([1, 2])).toBe("Lunedì e martedì");
    expect(formatSchoolDays([1, 3, 5])).toBe("Lunedì, mercoledì e venerdì");
    expect(formatSchoolDays([1, 2, 4, 5])).toBe(
      "Lunedì, martedì, giovedì e venerdì",
    );
  });

  test("ordine e doppioni non contano, valori strani si ignorano", () => {
    expect(formatSchoolDays([5, 3, 4, 3])).toBe("Dal mercoledì al venerdì");
    expect(formatSchoolDays([0, 8, 2])).toBe("Il martedì");
    expect(formatSchoolDays([])).toBe("");
  });
});

test.describe("dialogo di uscita e di eliminazione (#38, #41)", () => {
  const nest = "Casa D'Angelo";

  test("«Esci da…»: l'ultimo adulto con account cancella la casa", () => {
    const copy = getLeaveDialogCopy({
      action: "leave",
      householdName: nest,
      isLastAdultWithAccount: true,
    });
    expect(copy.title).toBe("Uscire da Casa D'Angelo?");
    expect(copy.confirmLabel).toBe("Esci e cancella la casa");
    expect(copy.confirmLabel).toBe(DELETE_HOUSEHOLD_LABEL);
    expect(copy.deletesHousehold).toBe(true);
    expect(copy.text).not.toContain("rientrare");
  });

  test("«Esci da…» negli altri casi: testo del mockup", () => {
    const copy = getLeaveDialogCopy({
      action: "leave",
      householdName: nest,
      isLastAdultWithAccount: false,
    });
    expect(copy).toMatchObject({
      title: "Uscire da Casa D'Angelo?",
      text: "Non vedrai più il calendario, la spesa e le cose da fare della casa. Potrai rientrare solo con un nuovo invito.",
      confirmLabel: "Esci dalla casa",
      deletesHousehold: false,
    });
    expect(copy.errorText.network).toBe(
      "Non siamo riusciti a farti uscire dalla casa. Controlla la connessione e riprova.",
    );
    expect(copy.errorText.server).toBe(
      "Non siamo riusciti a farti uscire dalla casa per un problema nostro. Riprova tra qualche minuto.",
    );
  });

  test("«Elimina l'account»: i tre casi di #38 v2.1", () => {
    const stays = getLeaveDialogCopy({
      action: "delete-account",
      householdName: nest,
      isLastAdultWithAccount: false,
      remainingNames: ["Laura", "Sofia", "Tommaso"],
    });
    expect(stays).toMatchObject({
      title: "Eliminare il tuo account?",
      text: "Perderai impegni, liste e impostazioni. Casa D'Angelo resterà a Laura, Sofia e Tommaso. Non si può annullare.",
      confirmLabel: "Elimina l'account",
    });
    const handover = getLeaveDialogCopy({
      action: "delete-account",
      householdName: nest,
      isLastAdultWithAccount: false,
      remainingNames: ["Laura", "Sofia", "Tommaso"],
      newAdministratorName: "Laura",
    });
    expect(handover.text).toBe(
      "Perderai impegni, liste e impostazioni. Casa D'Angelo resterà a Laura, Sofia e Tommaso, e da ora la gestirà Laura. Non si può annullare.",
    );
    const last = getLeaveDialogCopy({
      action: "delete-account",
      householdName: nest,
      isLastAdultWithAccount: true,
      remainingNames: ["Laura"],
    });
    expect(last).toMatchObject({
      title: "Eliminare il tuo account?",
      text: "Perderai impegni, liste e impostazioni. Non si può annullare.",
      confirmLabel: "Esci e cancella la casa",
      deletesHousehold: true,
    });
    expect(last.errorText.server).toBe(
      "Non siamo riusciti a eliminare l'account per un problema nostro. Non è cambiato niente: riprova tra qualche minuto.",
    );
  });

  test("toast dopo l'uscita e testo del bottone", () => {
    expect(getLeaveDoneToast(nest, false)).toEqual({
      text: "Non fai più parte di",
      emphasis: nest,
      after: ".",
    });
    expect(getLeaveDoneToast(nest, true)).toEqual({
      lead: nest,
      text: "è stata cancellata.",
    });
    expect(getLeaveButtonLabel(nest)).toBe("Esci da Casa D'Angelo");
  });
});

test.describe("testi di MemberSheet fuori dal modulo client (#31)", () => {
  test("il modulo dei testi non è un modulo client e MemberSheet lo usa", () => {
    const texts = readFileSync("src/lib/member-texts.ts", "utf8");
    expect(texts).not.toMatch(/^"use client"/m);
    expect(MEMBER_NAME_ERROR).toBe("Scrivi il nome per continuare.");
    expect(MEMBER_NAME_MAX_LENGTH).toBe(40);
    expect(MEMBER_FAILURE_TEXT.network).toBe(
      "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
    );
    expect(MEMBER_KIND_OPTIONS.map((option) => option.label)).toEqual([
      "Adulto",
      "Figlio o figlia",
      "Animale",
    ]);
    const sheet = readFileSync(
      "src/components/ui/MemberSheet/MemberSheet.tsx",
      "utf8",
    );
    expect(sheet).not.toContain('"Scrivi il nome per continuare."');
    expect(sheet).not.toContain("Non siamo riusciti a salvare");
  });
});

test.describe("CSS nuovo nel blocco del designer (#221)", () => {
  const css = readFileSync("src/app/components.css", "utf8");
  const designerBlock = css.slice(
    css.indexOf("STATI AGGIUNTI DAL DESIGNER"),
    css.indexOf("CORNICE DELL'APP"),
  );

  test("le classi nuove stanno nel blocco, prima della cornice", () => {
    for (const rule of [
      ".sezione--ancora {",
      ".profilo-testa .t-titolo-pagina,",
      ".sezione__link {",
      ".profilo-testa__azione {",
      ".modulo-gruppo {",
      ".modulo-gruppo--sezione {",
      ".campo-doppio--tre {",
      ".spazio-arrivo {",
      ".spazio-arrivo__alto {",
      ".spazio-arrivo__desktop {",
      ".skeleton--bottone {",
      '.btn-icona[aria-pressed="true"] {',
    ]) {
      expect(designerBlock, rule).toContain(rule);
    }
  });

  test("le regole nuove usano solo variabili del design system", () => {
    const start = designerBlock.indexOf("Impostazioni della casa (#41)");
    expect(start).toBeGreaterThan(0);
    const added = designerBlock.slice(start);
    expect(added).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(added).not.toMatch(/\brgba?\(/);
    // media queries are the only place where a px width is allowed
    const withoutMedia = added.replace(/@media \([^)]*\)/g, "@media");
    expect(withoutMedia).not.toMatch(/\b\d+(\.\d+)?px\b/);
  });

  test("la puntina premuta vince sul passaggio del mouse di .btn-icona", () => {
    const normalized = designerBlock.replace(/\s+/g, " ");
    expect(normalized).toContain(
      '.btn-icona[aria-pressed="true"]:hover:not(:disabled, [aria-disabled="true"]) { background: var(--color-notte-2); }',
    );
    expect(normalized).toContain(
      '.btn-icona[aria-pressed="true"]:active:not(:disabled, [aria-disabled="true"]) { background: var(--color-notte-2); }',
    );
  });
});

test.describe("avvisi degli spazi (#29, space-interests.ts)", () => {
  type Call = { fn: string; args: unknown };
  function fakeClient(
    result: { data?: unknown; error: unknown },
    calls: Call[],
  ) {
    return {
      rpc: (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return Promise.resolve({ error: result.error });
      },
      from: () => ({
        select: () => Promise.resolve(result),
      }),
    } as never;
  }

  test("registrare e togliere mandano solo la chiave dello spazio", async () => {
    const calls: Call[] = [];
    const client = fakeClient({ error: null }, calls);
    expect(await addSpaceInterest(client, "meals")).toEqual({ error: null });
    expect(await removeSpaceInterest(client, "meals")).toEqual({ error: null });
    expect(calls).toEqual([
      { fn: "add_space_interest", args: { p_space: "meals" } },
      { fn: "remove_space_interest", args: { p_space: "meals" } },
    ]);
  });

  test("l'errore (FN002) viene restituito, non nascosto", async () => {
    const error = { code: "FN002" };
    const client = fakeClient({ error }, []);
    expect(await addSpaceInterest(client, "pets")).toEqual({ error });
  });

  test("leggere gli avvisi: elenco o errore", async () => {
    const ok = fakeClient(
      { data: [{ space: "meals" }, { space: "couple" }], error: null },
      [],
    );
    expect(await getSpaceInterests(ok)).toEqual({
      error: null,
      spaces: ["meals", "couple"],
    });
    const error = { code: "X" };
    const ko = fakeClient({ data: null, error }, []);
    expect(await getSpaceInterests(ko)).toEqual({ error, spaces: null });
  });
});
