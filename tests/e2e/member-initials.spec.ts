import { expect, test } from "@playwright/test";
import { memberInitials } from "../../src/lib/member-initials";

// #504 (F4b), CA-22, CA-23, CA-24: the initials of the people of one Nest.
// Pure function, no browser.

const NEST = "nest-a";

const member = (
  id: string,
  name: string,
  createdAt: string,
  householdId = NEST,
) => ({ id, householdId, name, createdAt });

test.describe("memberInitials", () => {
  test("CA-22: chi arriva dopo con la stessa iniziale prende due lettere", () => {
    const marco = member("1", "Marco", "2026-11-01T10:00:00Z");
    const miele = member("2", "Miele", "2026-11-02T10:00:00Z");
    // Miele is passed first: the order of the array does not matter.
    const two = memberInitials([miele, marco]);
    expect(two.get("1")).toBe("M");
    expect(two.get("2")).toBe("Mi");

    const mia = member("3", "Mia", "2026-11-03T10:00:00Z");
    const three = memberInitials([mia, miele, marco]);
    expect(three.get("1")).toBe("M");
    expect(three.get("2")).toBe("Mi");
    expect(three.get("3")).toBe("Ma");
  });

  test("a parità di data decide l'id", () => {
    const a = member("a", "Anna", "2026-11-01T10:00:00Z");
    const b = member("b", "Aldo", "2026-11-01T10:00:00Z");
    const result = memberInitials([b, a]);
    expect(result.get("a")).toBe("A");
    expect(result.get("b")).toBe("Al");
  });

  test("se nessuna lettera rende la coppia unica: prima e seconda lettera", () => {
    const first = member("1", "Mi", "2026-11-01T10:00:00Z");
    const second = member("2", "Mi", "2026-11-02T10:00:00Z");
    const third = member("3", "Mi", "2026-11-03T10:00:00Z");
    const result = memberInitials([first, second, third]);
    expect(result.get("1")).toBe("M");
    expect(result.get("2")).toBe("Mi");
    expect(result.get("3")).toBe("Mi");
  });

  test("CA-23: prima lettera vera, in maiuscolo, senza spazi iniziali", () => {
    const result = memberInitials([
      member("1", "Élodie", "2026-11-01T10:00:00Z"),
      member("2", "  anna", "2026-11-02T10:00:00Z"),
      member("3", "Sofia", "2026-11-03T10:00:00Z"),
    ]);
    expect(result.get("1")).toBe("É");
    expect(result.get("2")).toBe("A");
    expect(result.get("3")).toBe("S");
  });

  test("CA-24: due Nest insieme sono un errore che non nomina nessuno", () => {
    const people = [
      member("1", "Marco", "2026-11-01T10:00:00Z", "nest-a"),
      member("2", "Paolo", "2026-11-01T10:00:00Z", "nest-b"),
    ];
    let message = "";
    try {
      memberInitials(people);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toBe("");
    expect(message).not.toContain("Marco");
    expect(message).not.toContain("Paolo");
  });

  test("una lista vuota dà una mappa vuota", () => {
    expect(memberInitials([]).size).toBe(0);
  });
});
