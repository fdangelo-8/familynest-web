import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  EXCLUDED_PATHS,
  LEGACY_AREAS,
  checkMessagesFile,
  describeFindings,
  scanLocaleLiterals,
  scanRepo,
  scanSource,
} from "../fixtures/i18n-scan";

// Static check of the texts (issue #477, CA-10, CA-12 ... CA-22). Pure
// functions on files: no browser needed. The text rules for pages not yet
// migrated apply to each area from its own phase (CA-23 ... CA-27): until
// then the area is in LEGACY_AREAS and is not scanned.

const ROOT = process.cwd();

const rules = (source: string, path?: string) =>
  scanSource(source, path ? { path } : {}).map((finding) => finding.rule);

/** Writes the given files under a new temporary root and cleans it up. */
function withTree(
  files: Record<string, string>,
  run: (root: string) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "i18n-scan-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const MESSAGES = `export const it = { save: "Salva" };\n`;

test.describe("controllo statico dei testi", () => {
  test("CA-10: lingua e fuso orario solo in src/lib/i18n/config.ts", () => {
    for (const file of [
      "src/lib/datetime.ts",
      "src/lib/calendar-sync/google-provider.ts",
      "src/app/layout.tsx",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text, file).not.toContain("it-IT");
      expect(text, file).not.toContain("Europe/Rome");
    }
    const config = readFileSync(join(ROOT, "src/lib/i18n/config.ts"), "utf8");
    expect(config).toContain("it-IT");
    expect(config).toContain("Europe/Rome");
  });

  test("CA-10: nessun nome di lingua o fuso fuori da config.ts (elenco di eccezioni esplicito)", () => {
    expect(describeFindings(scanLocaleLiterals(ROOT))).toEqual([]);
    // The check really finds them: without the exceptions the legacy files show up.
    expect(scanLocaleLiterals(ROOT, { exceptions: [] }).length).toBeGreaterThan(
      0,
    );
  });

  test("CA-12: il testo nel JSX è segnalato, simboli e numeri no", () => {
    const found = scanSource(
      `export function A() {\n  return (\n    <div>\n      <p>Salva</p>\n    </div>\n  );\n}\n`,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: "jsx-text", line: 4 });
    expect(scanSource(`const a = <span>·</span>;`)).toEqual([]);
    expect(scanSource(`const a = <span>2</span>;`)).toEqual([]);
    expect(scanSource(`const a = <span>&nbsp;</span>;`)).toEqual([]);
  });

  test("CA-13: attributi letti dall'utente, ternario nel JSX e metadata", () => {
    const cases: Array<[string, string]> = [
      [`const a = <button aria-label="Chiudi" />;`, "jsx-attr"],
      [`const a = <input placeholder="Cerca" />;`, "jsx-attr"],
      [`const a = <img alt="Foto" src="/a.png" />;`, "jsx-attr"],
      [`const a = <p>{ok ? "Sì" : "No"}</p>;`, "jsx-text"],
      [`export const metadata = { title: "Oggi" };`, "metadata"],
    ];
    for (const [source, rule] of cases) {
      const found = scanSource(source);
      expect(found, source).not.toEqual([]);
      expect(
        found.map((finding) => finding.rule),
        source,
      ).toContain(rule);
    }
  });

  test("CA-14: frasi fuori dal JSX sono segnalate come literal", () => {
    const source = [
      `const a = "Nessun impegno oggi";`,
      `const b = "Già fatto";`,
      `const c = "«Casa»";`,
    ].join("\n");
    const found = scanSource(source);
    expect(found.map((finding) => [finding.rule, finding.line])).toEqual([
      ["literal", 1],
      ["literal", 2],
      ["literal", 3],
    ]);
  });

  test("CA-15: import, direttive, tipi, classi, errori e log non sono testi", () => {
    const source = [
      `"use client";`,
      `import { x } from "@/lib/supabase/server";`,
      `type Mode = "login" | "register";`,
      `export function A() {`,
      `  if (!x) throw new Error("permission denied for row");`,
      `  console.warn("sync failed twice");`,
      `  return <div className="fn-card fn-card--muted" />;`,
      `}`,
    ].join("\n");
    expect(describeFindings(scanSource(source))).toEqual([]);
  });

  test("CA-16: // i18n-ignore con motivo salta la riga, senza motivo no", () => {
    expect(
      scanSource(
        `// i18n-ignore: nome del marchio, non si traduce\nconst a = "Nessun impegno oggi";`,
      ),
    ).toEqual([]);
    expect(
      scanSource(
        `const a = "Nessun impegno oggi"; // i18n-ignore: nome del marchio\n`,
      ),
    ).toEqual([]);
    expect(rules(`// i18n-ignore\nconst a = "Nessun impegno oggi";`)).toContain(
      "ignore-without-reason",
    );
    expect(
      rules(`// i18n-ignore: troppo\nconst a = "Nessun impegno oggi";`),
    ).toContain("ignore-without-reason");
    // A short reason does not hide the phrase either.
    expect(
      rules(`// i18n-ignore: troppo\nconst a = "Nessun impegno oggi";`),
    ).toContain("literal");
  });

  test("CA-17: lingua e fuso scritti a mano sono locale-literal, tranne in config.ts", () => {
    const cases = [
      `const f = new Intl.NumberFormat("it-IT");`,
      `const u = text.toLocaleUpperCase("it");`,
      `const z = "Europe/Rome";`,
    ];
    for (const source of cases) {
      expect(rules(source, "src/components/prova/model.ts"), source).toEqual([
        "locale-literal",
      ]);
      expect(rules(source, "src/lib/i18n/config.ts"), source).toEqual([]);
    }
  });

  test("CA-18: un file dei testi non conforme dà messages-shape", () => {
    expect(
      checkMessagesFile(`export const it = { save: "" };`).map((f) => f.rule),
    ).toContain("messages-shape");
    expect(
      checkMessagesFile(`export const it = { save: () => "Salva" };`).map(
        (f) => f.rule,
      ),
    ).toContain("messages-shape");
    expect(
      checkMessagesFile(
        `"use client";\nexport const it = { save: "Salva" };`,
      ).map((f) => f.rule),
    ).toContain("messages-shape");
    expect(
      checkMessagesFile(
        `export const it = { days: { one: "{count} giorno", other: "{count} giorni" }, group: { save: "Salva" } };`,
      ),
    ).toEqual([]);
  });

  test("CA-19: un file dei testi può importare solo @/lib/i18n e altri messages/it", () => {
    const bad = checkMessagesFile(
      `import { createClient } from "@/lib/supabase/server";\nexport const it = { save: "Salva" };`,
    );
    expect(bad.map((finding) => finding.rule)).toContain("messages-import");
    expect(
      checkMessagesFile(
        `import type { MessageTree } from "@/lib/i18n";\nimport { it as base } from "@/components/ui/messages/it";\nexport const it = { save: "Salva" } satisfies MessageTree;`,
      ),
    ).toEqual([]);
  });

  test("CA-20: la sottocartella con page.tsx e senza testi non è controllata", () => {
    withTree(
      {
        "src/components/prova/messages/it.ts": MESSAGES,
        "src/components/prova/A.tsx": `export const A = () => <p>Ciao</p>;`,
        "src/components/prova/da-fare/page.tsx": `export default () => <p>Ciao</p>;`,
        "src/components/prova/gia-fatto/B.tsx": `export const B = () => <p>Ciao</p>;`,
      },
      (root) => {
        const files = scanRepo(root, { legacyAreas: [] }).map(
          (finding) => finding.file,
        );
        expect(files).toContain("src/components/prova/A.tsx");
        expect(files).toContain("src/components/prova/gia-fatto/B.tsx");
        expect(files.filter((file) => file.includes("/da-fare/"))).toEqual([]);
      },
    );
  });

  test("CA-21: una cartella nuova senza messages/it.ts fallisce, con i testi passa", () => {
    withTree(
      {
        "src/components/prova/A.tsx": `export const A = () => null;`,
        "src/app/nuova/page.tsx": `export default () => null;`,
        "src/components/vecchia/A.tsx": `export const A = () => null;`,
      },
      (root) => {
        const found = scanRepo(root, {
          legacyAreas: ["src/components/vecchia"],
        });
        expect(
          found.map((finding) => [finding.rule, finding.file]).sort(),
        ).toEqual([
          ["new-area-unmarked", "src/app/nuova"],
          ["new-area-unmarked", "src/components/prova"],
        ]);
      },
    );
    withTree(
      {
        "src/components/prova/messages/it.ts": MESSAGES,
        "src/components/prova/A.tsx": `export const A = () => null;`,
        "src/app/nuova/messages/it.ts": MESSAGES,
        "src/app/nuova/page.tsx": `export default () => null;`,
      },
      (root) => {
        expect(describeFindings(scanRepo(root, { legacyAreas: [] }))).toEqual(
          [],
        );
      },
    );
  });

  test("CA-22: il controllo passa su src/ e non riguarda design-system, fornitore-finto, types", () => {
    const found = scanRepo(ROOT);
    expect(describeFindings(found)).toEqual([]);
    for (const excluded of EXCLUDED_PATHS) {
      expect(
        [...found, ...scanLocaleLiterals(ROOT, { exceptions: [] })].filter(
          (finding) => finding.file.startsWith(excluded),
        ),
        excluded,
      ).toEqual([]);
    }
  });

  test("CA-22: l'elenco LEGACY_AREAS non ha doppioni", () => {
    expect(new Set(LEGACY_AREAS).size).toBe(LEGACY_AREAS.length);
  });

  test("CA-27: da applicare nell'ultima fase, quando LEGACY_AREAS sarà vuoto", () => {
    // Until the final phase the list holds the areas still to migrate. The
    // check below documents the condition without failing main: when the list
    // is empty, every folder must have its messages (see CA-21 and CA-22).
    test.skip(
      LEGACY_AREAS.length > 0,
      "fase finale: LEGACY_AREAS ancora non vuoto",
    );
    expect(describeFindings(scanRepo(ROOT))).toEqual([]);
  });
});
