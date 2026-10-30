import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  avatarGroupLabel,
  avatarItems,
  claimLead,
  colorHelp,
  expiryLead,
  oneLine,
} from "../../src/components/invito/invite-text";

// Pure texts of the invitation pages (#16): no browser, no database.

const member = (initial: string) => ({ initial, color: "salvia" as const });

test.describe("ingresso con invito: testi", () => {
  test("gruppo di avatar: mai i nomi degli altri (D-1)", () => {
    expect(avatarGroupLabel("Marco", 4)).toBe("Marco e altri 3 nel Nest");
    expect(avatarGroupLabel("Marco", 2)).toBe("Marco e un altro nel Nest");
    expect(avatarGroupLabel("Marco", 1)).toBe("Marco");
    expect(avatarGroupLabel(null, 3)).toBe("Già nel Nest: 3");
    expect(avatarGroupLabel(null, 0)).toBeNull();
  });

  test("avatar: fino a 4 tutti, da 5 i primi 3 e «+N»", () => {
    const four = ["M", "S", "T", "B"].map(member);
    expect(avatarItems(four)).toHaveLength(4);
    const nine = "ABCDEFGHI".split("").map(member);
    const items = avatarItems(nine);
    expect(items).toHaveLength(4);
    expect(items[3]).toEqual({ kind: "more", count: 6 });
    expect(avatarItems("ABCDE".split("").map(member))[3]).toEqual({
      kind: "more",
      count: 2,
    });
  });

  test("claim senza chi invita", () => {
    expect(claimLead("Marco")).toBe("Marco ti aspetta");
    expect(claimLead(null)).toBe("Ti aspettano");
  });

  test("scadenza: giorni, ultimo giorno e oggi, a Roma", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    expect(expiryLead("2026-10-26T10:00:00Z", now)).toBe(
      "Invito valido ancora 6 giorni.",
    );
    expect(expiryLead("2026-10-21T10:00:00Z", now)).toBe(
      "Invito valido fino a domani alle 12:00.",
    );
    expect(expiryLead("2026-10-20T21:59:00Z", now)).toBe(
      "Invito valido fino a oggi alle 23:59.",
    );
  });

  test("messaggio su una riga e aiuto del colore", () => {
    expect(oneLine("Entra\nanche  tu!\r\n")).toBe("Entra anche  tu!");
    expect(colorHelp("Marco", "glicine")).toBe(
      "Marco ti aveva dato il glicine. I colori spenti sono già di qualcun altro.",
    );
    expect(colorHelp(null, "zafferano")).toBe(
      "Ti era stato dato lo zafferano. I colori spenti sono già di qualcun altro.",
    );
  });

  test("la server action non importa valori da moduli client", () => {
    // ColorChoice is "use client": on the server a value imported from it is a
    // client reference, not an array (CHOOSABLE_COLORS.includes failed).
    const source = readFileSync("src/app/invito/actions.ts", "utf8");
    expect(source).not.toMatch(/^import (?!type)[^;]*ColorChoice/m);
    expect(source).toMatch(/import type \{[^}]*\} from "[^"]*ColorChoice/);
    expect(source).not.toContain("CHOOSABLE_COLORS");
  });

  test("le pagine del membro non importano valori da moduli client", () => {
    for (const file of [
      "src/app/(app)/membri/[id]/page.tsx",
      "src/app/(app)/membri/[id]/actions.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/^import (?!type)[^;]*ColorChoice/m);
      expect(source, file).not.toContain("CHOOSABLE_COLORS");
    }
  });
});
