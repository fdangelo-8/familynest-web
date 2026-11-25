import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LOCALES,
  capitalize,
  compareText,
  formatCurrency,
  formatList,
  formatNumber,
  getLocale,
  plural,
  rich,
  t,
} from "../../src/lib/i18n";
import { formatTime } from "../../src/lib/datetime";

// Functions of src/lib/i18n (issue #477, phase 0): no browser needed, except
// CA-8 and CA-2 ... CA-4 that read the DOM.

const DAYS = {
  zero: "Nessun giorno",
  one: "{count} giorno",
  other: "{count} giorni",
};

/** Runs `run` with another NODE_ENV and puts the old value back. */
function withEnv<T>(value: string, run: () => T): T {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  env.NODE_ENV = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
}

test.describe("funzioni i18n", () => {
  test("CA-1: getLocale() restituisce sempre it e LOCALES vale [it]", () => {
    expect(getLocale()).toBe("it");
    expect([...LOCALES]).toEqual(["it"]);
  });

  test("CA-5: t riempie i segnaposto, anche ripetuti", () => {
    expect(t("Ciao {nome}, {nome}!", { nome: "Anna" })).toBe(
      "Ciao Anna, Anna!",
    );
    expect(t("Nessun segnaposto")).toBe("Nessun segnaposto");
    expect(t("Hai {n} impegni", { n: 3 })).toBe("Hai 3 impegni");
  });

  test("CA-6: parametro mancante: errore nei test, segnaposto in produzione", () => {
    expect(() => t("Ciao {nome}", {})).toThrow('i18n: missing param "nome"');
    expect(() => t("Ciao {nome}")).toThrow('i18n: missing param "nome"');
    // Names every object has (constructor, toString) are not parameters.
    expect(() => t("Ciao {constructor}", {})).toThrow(
      'i18n: missing param "constructor"',
    );
    expect(withEnv("production", () => t("Ciao {nome}", {}))).toBe(
      "Ciao {nome}",
    );
  });

  test("CA-7: plural sceglie la forma e formatta il numero", () => {
    expect(plural(DAYS, 0)).toBe("Nessun giorno");
    expect(plural(DAYS, 1)).toBe("1 giorno");
    expect(plural(DAYS, 2)).toBe("2 giorni");
    expect(plural(DAYS, 10000)).toBe("10.000 giorni");
    expect(plural({ one: DAYS.one, other: DAYS.other }, 0)).toBe("0 giorni");
  });

  test("CA-9: numeri, maiuscole, elenchi ed euro in italiano", () => {
    expect(formatNumber(12345.5)).toBe("12.345,5");
    expect(capitalize("oggi")).toBe("Oggi");
    expect(capitalize("")).toBe("");
    expect(formatList(["Anna", "Marco", "Luca"])).toBe("Anna, Marco e Luca");
    expect(formatList(["Anna", "Marco"])).toBe("Anna e Marco");
    expect(formatList(["Anna"])).toBe("Anna");
    expect(formatCurrency(34.99)).toBe("34,99 €");
  });

  test("CA-9: capitalize con caratteri composti e lettere accentate", () => {
    // Two-unit characters (emoji) stay whole, the rest is untouched.
    expect(capitalize("🎈 festa")).toBe("🎈 festa");
    expect(capitalize("è tardi")).toBe("È tardi");
    expect(capitalize("àb")).toBe("Àb");
    expect(capitalize("oGGI")).toBe("OGGI");
    // The first letter of a combined sequence is a single character.
    expect(capitalize("école")).toBe("École");
  });

  test("CA-9: compareText ignora maiuscole e accenti", () => {
    expect(compareText("a", "A")).toBe(0);
    expect(compareText("è", "e")).toBe(0);
    expect(compareText("anna", "Marco")).toBeLessThan(0);
    expect(["Marco", "anna", "Èva", "Luca"].sort(compareText)).toEqual([
      "anna",
      "Èva",
      "Luca",
      "Marco",
    ]);
  });

  test("CA-28: l'errore di t non contiene testo né valori", () => {
    let message = "";
    try {
      t("Ciao {nome}, {email}", { email: "a@b.it" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('i18n: missing param "nome"');
    expect(message).not.toContain("a@b.it");
    expect(message).not.toContain("Ciao");
  });

  test("CA-11: formatTime usa il fuso di Roma (estate), come prima della fase 0", () => {
    // The criterion says "00:30", but formatTime has never padded the hour
    // (CA-40 of datetime.spec.ts expects "8:30"), and the PR keeps it that
    // way. The time zone is what this test protects: 22:30 UTC is 00:30 in Rome.
    expect(formatTime("2026-07-01T22:30:00Z")).toBe("0:30");
  });

  test("CA-2: <html lang> viene da getLocale()", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).toMatch(/lang=\{getLocale\(\)\}/);
    expect(layout).not.toMatch(/lang="[a-z-]+"/);
  });

  test("CA-8: rich mostra il valore come testo, mai come elemento", async ({
    page,
  }) => {
    const html = renderToStaticMarkup(
      rich(
        "Ciao <b>{nome}</b>",
        { nome: "<i>x</i>" },
        { b: (children) => createElement("strong", null, children) },
      ),
    );
    await page.setContent(`<main id="out">${html}</main>`);
    await expect(page.locator("#out strong")).toHaveCount(1);
    await expect(page.locator("#out strong")).toHaveText("<i>x</i>");
    await expect(page.locator("#out i")).toHaveCount(0);
    await expect(page.locator("#out")).toHaveText("Ciao <i>x</i>");
  });

  test("CA-8: rich lascia come testo i tag che non conosce", () => {
    const html = renderToStaticMarkup(
      createElement("p", null, rich("A <u>b</u> c", {}, {})),
    );
    expect(html).toBe("<p>A &lt;u&gt;b&lt;/u&gt; c</p>");
  });
});
