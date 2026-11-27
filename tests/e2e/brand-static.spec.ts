import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BRAND, askNest, nestEnergy, pageTitle, yourNest } from "@/lib/brand";
import { brandTexts } from "@/lib/brand";
import { baseMessages } from "@/lib/i18n";
import { sourceFiles, textsOf } from "../fixtures/brand-scan";

// The product name in one place (#502): static checks (CA-1 ... CA-5, CA-12,
// CA-13). They read files and call pure functions: no browser, no database.

const ROOT = process.cwd();
const BRAND_FILE = "src/lib/brand.ts";

/** §3 of docs/specifiche/502-nome-prodotto.md: identifiers that never change. */
const TECHNICAL: Record<string, string[]> = {
  "src/components/aggiungi/coordination.ts": [
    "familynest:lists-changed",
    "familynest:lists-refreshed",
  ],
  "src/components/ricerca/from-app.ts": ["familynest:search-from-app"],
  "src/components/membri/texts.ts": ["familynest:focus-invite"],
  "src/lib/public-wishlist.ts": [
    "familynest.wishlist.giver-key",
    "familynest.wishlist.giver-name",
  ],
  "src/lib/events-changed.ts": ["familynest:events-changed"],
  "src/lib/auth/recovery-cookie.ts": ["familynest_recupero"],
  "src/lib/invitations.ts": ["familynest_invito"],
  "src/lib/lens.ts": ["familynest.lens"],
  "src/lib/recent-searches.ts": ["familynest:recent-searches:"],
  "src/lib/calendar-sync/oauth.ts": ["familynest:calendar-oauth-cookie"],
  "src/lib/calendar-sync/crypto.ts": ["familynest:calendar-credentials:v"],
  "src/lib/calendar-sync/fake-provider.ts": [
    "familynest.calendar-fake-provider",
  ],
};

function messageStrings(tree: unknown, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  if (tree && typeof tree === "object")
    return Object.entries(tree).flatMap(([key, value]) =>
      messageStrings(value, path ? `${path}.${key}` : key),
    );
  return [];
}

test.describe("nome del prodotto: controllo statico", () => {
  test("CA-1: «FamilyNest» e «familynest» nei testi di src/ solo in brand.ts e nei valori di §3", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      if (file === BRAND_FILE) continue;
      const allowed = TECHNICAL[file] ?? [];
      for (const node of textsOf(ROOT, file)) {
        if (!/familynest/i.test(node.text) && !node.text.includes("FamilyNest"))
          continue;
        if (!allowed.some((value) => node.text.includes(value)))
          offenders.push(`${file}:${node.line} ${JSON.stringify(node.text)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("CA-2: i 12 file di §3 hanno ogni valore identico, scritto a mano", () => {
    expect(Object.keys(TECHNICAL)).toHaveLength(12);
    for (const [file, values] of Object.entries(TECHNICAL)) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source, `${file} non deve usare BRAND`).not.toMatch(/\bBRAND\b/);
      const texts = textsOf(ROOT, file).map((node) => node.text);
      for (const value of values) {
        expect(
          texts.some((text) => text.includes(value)),
          `${file}: ${value}`,
        ).toBe(true);
      }
    }
  });

  test("CA-3: BRAND e le funzioni dicono i valori attuali", () => {
    expect(BRAND.full).toBe("FamilyNest");
    expect(BRAND.short).toBe("Nest");
    expect(BRAND.slug).toBe("familynest");
    expect(yourNest()).toBe("Il tuo Nest");
    expect(askNest()).toBe("Chiedi a Nest");
    expect(nestEnergy()).toBe("Energia di Nest");
    expect(pageTitle("Casa", "Spesa")).toBe("FamilyNest · Casa · Spesa");
  });

  test("CA-4: con un altro nome cambiano tutte le formule e non resta traccia del vecchio", () => {
    const texts = brandTexts({ full: "Prova", short: "Casetta" });
    const results = {
      description: texts.description,
      yourNest: texts.yourNest,
      askNest: texts.askNest,
      nestEnergy: texts.nestEnergy,
      title: texts.pageTitle("Oggi"),
    };
    expect(results.description).toBe("Prova — l'organizer per la tua famiglia");
    expect(results.yourNest).toBe("Il tuo Casetta");
    expect(results.askNest).toBe("Chiedi a Casetta");
    expect(results.nestEnergy).toBe("Energia di Casetta");
    expect(results.title).toBe("Prova · Oggi");
    for (const value of Object.values(results)) {
      expect(value).not.toContain("FamilyNest");
      expect(value).not.toMatch(/\bNest\b/);
    }
  });

  test("CA-5: nessun messaggio di it.ts contiene il nome o la parola «Nest»; le chiavi di §1 ci sono", () => {
    const messages = baseMessages.it;
    const strings = messageStrings(messages);
    const offenders = strings
      .filter(
        ([, text]) => text.includes("FamilyNest") || /\bNest\b/.test(text),
      )
      .map(([key, text]) => `${key}: ${text}`);
    expect(offenders).toEqual([]);
    expect(messages.brand.description).toBe(
      "{app} — l'organizer per la tua famiglia",
    );
    expect(messages.brand.yourNest).toBe("Il tuo {nest}");
    expect(messages.brand.yourNestLower).toBe("il tuo {nest}");
    expect(messages.brand.askNest).toBe("Chiedi a {nest}");
    expect(messages.brand.nestEnergy).toBe("Energia di {nest}");
    expect(messages.brand.titleSeparator).toBe("·");
  });

  test("CA-12: nessun file supera la linea di base di «Nest» e nessun file nuovo ne ha", () => {
    const baseline = JSON.parse(
      readFileSync(
        join(ROOT, "tests/fixtures/brand-nest-baseline.json"),
        "utf8",
      ),
    ) as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const file of sourceFiles(ROOT)) {
      const count = textsOf(ROOT, file).filter((node) =>
        /\bNest\b/.test(node.text),
      ).length;
      if (count > 0) counts[file] = count;
    }
    const over = Object.entries(counts)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(
        ([file, count]) =>
          `${file}: ${count} (linea di base ${baseline[file] ?? "assente"})`,
      );
    expect(over).toEqual([]);
    // Every file of the baseline still exists and does not carry stale rows.
    const missing = Object.keys(baseline).filter(
      (file) => !existsSync(join(ROOT, file)),
    );
    expect(missing).toEqual([]);
  });

  test("CA-13: config.toml e i modelli di mail di Supabase contengono ancora il nome", () => {
    for (const file of [
      "supabase/config.toml",
      "supabase/templates/conferma.html",
      "supabase/templates/nuova-password.html",
    ]) {
      expect(readFileSync(join(ROOT, file), "utf8"), file).toContain(
        BRAND.full,
      );
    }
  });
});
