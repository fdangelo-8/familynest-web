import { expect, test } from "@playwright/test";
import { getBarConfig } from "../../src/lib/app-routes";
import {
  MAX_PINNED_SPACES,
  SPACES,
  countPinnedAvailable,
  getAvailableSpaces,
  getSpacePromise,
  isPinLimitError,
  isSpaceUnavailableError,
} from "../../src/lib/spaces";

// Pure logic of the catalogue of spaces (#188): no browser, no database.
test.describe("catalogo degli spazi", () => {
  test("dieci spazi nell'ordine della specifica, con chiavi e indirizzi", () => {
    expect(SPACES.map((s) => s.name)).toEqual([
      "A tavola",
      "Noi due",
      "Stare bene",
      "Tempo insieme",
      "Passioni",
      "Casa in ordine",
      "Progetti",
      "Conti chiari",
      "Crescere",
      "Zampe",
    ]);
    expect(SPACES.map((s) => s.key)).toEqual([
      "meals",
      "couple",
      "wellbeing",
      "together",
      "hobbies",
      "chores",
      "projects",
      "expenses",
      "children",
      "pets",
    ]);
    expect(SPACES[0]?.href).toBe("/esplora/a-tavola");
    expect(SPACES[5]?.href).toBe("/esplora/casa-in-ordine");
    expect(SPACES.filter((s) => s.wide).map((s) => s.name)).toEqual([
      "A tavola",
      "Progetti",
    ]);
    expect(SPACES.filter((s) => s.dark).map((s) => s.name)).toEqual([
      "Noi due",
    ]);
    expect(MAX_PINNED_SPACES).toBe(6);
  });

  test("disponibilità dai conteggi", () => {
    const names = (adults: number, children: number, pets: number) =>
      getAvailableSpaces({ adults, children, pets }).map((s) => s.name);
    expect(names(1, 0, 0)).toEqual([
      "A tavola",
      "Stare bene",
      "Tempo insieme",
      "Passioni",
      "Casa in ordine",
      "Progetti",
    ]);
    expect(names(2, 2, 1)).toHaveLength(10);
    expect(names(1, 1, 0)).toContain("Crescere");
    expect(names(1, 1, 0)).not.toContain("Noi due");
    expect(names(2, 0, 1)).toContain("Conti chiari");
    expect(names(2, 0, 1)).not.toContain("Crescere");
  });

  test("promesse con i nomi", () => {
    expect(getSpacePromise("children", { childNames: ["Leo"] })).toBe(
      "Tutto su Leo, in un posto solo.",
    );
    expect(
      getSpacePromise("children", { childNames: ["Sofia", "Tommaso"] }),
    ).toBe("Tutto su Sofia e Tommaso, in un posto solo.");
    expect(
      getSpacePromise("children", { childNames: ["Anna", "Bea", "Carlo"] }),
    ).toBe("Tutto su Anna, Bea e Carlo, in un posto solo.");
    expect(getSpacePromise("pets", { petNames: ["Biscotto"] })).toBe(
      "Per Biscotto e per chi ha quattro zampe.",
    );
    expect(getSpacePromise("pets", { petNames: ["Fido", "Micia"] })).toBe(
      "Per Fido, Micia e per chi ha quattro zampe.",
    );
    // without names: a sensible text, never a placeholder
    for (const key of ["children", "pets"] as const) {
      expect(getSpacePromise(key)).not.toMatch(/[‹›]/);
      expect(
        getSpacePromise(key, { childNames: [], petNames: [] }),
      ).not.toMatch(/[‹›]/);
    }
    expect(getSpacePromise("meals")).toBe(
      "Cosa mangiamo questa settimana, senza pensarci ogni sera.",
    );
  });

  test("errori del database e limite sui soli spazi disponibili", () => {
    expect(isPinLimitError({ code: "FN001" })).toBe(true);
    expect(isPinLimitError({ code: "FN002" })).toBe(false);
    expect(isPinLimitError(null)).toBe(false);
    expect(isSpaceUnavailableError({ code: "FN002" })).toBe(true);
    expect(isSpaceUnavailableError({ code: "P0001" })).toBe(false);
    expect(
      countPinnedAvailable(["meals", "pets", "couple"], {
        adults: 1,
        children: 0,
        pets: 0,
      }),
    ).toBe(1);
  });

  test("barra di Esplora: Indietro verso /nest e link di ricerca", () => {
    expect(getBarConfig("/esplora")).toEqual({
      kind: "detail",
      fallback: "/nest",
      search: true,
    });
  });
});
