import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  MEMBER_COLOR_CODES,
  MEMBER_COLOR_SHADES,
} from "../../src/lib/member-colors";

// #196 (F2 token e font): criteria that only need the source files.

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test("CA-1: layout.tsx carica solo Figtree e in src/ non resta traccia dei vecchi font", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const imports = [
    ...layout.matchAll(/import\s*\{([^}]*)\}\s*from\s*"next\/font\/google"/g),
  ];
  expect(imports).toHaveLength(1);
  const names = imports[0]![1]!
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  expect(names).toEqual(["Figtree"]);

  const call = /Figtree\(\s*\{([\s\S]*?)\}\s*\)/.exec(layout);
  expect(call).not.toBeNull();
  const options = call![1]!.replace(/\s+/g, " ");
  expect(options).toMatch(/subsets:\s*\["latin",\s*"latin-ext"\]/);
  expect(options).toMatch(/display:\s*"swap"/);
  expect(options).toMatch(/variable:\s*"--font-figtree"/);
  expect(options).not.toMatch(/\bweight\b/);

  const offenders: string[] = [];
  for (const file of files("src")) {
    if (!/\.(tsx?|css)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const old of [
      "Parkinsans",
      "Host_Grotesk",
      "--font-parkinsans",
      "--font-host-grotesk",
    ]) {
      if (text.includes(old)) offenders.push(`${file}: ${old}`);
    }
  }
  expect(offenders).toEqual([]);
});

test("CA-14: MEMBER_COLOR_CODES e MEMBER_COLOR_SHADES seguono l'enum e la tabella", () => {
  const types = readFileSync("src/types/database.ts", "utf8");
  const block = /member_color: \[([^\]]*)\]/.exec(types);
  expect(block).not.toBeNull();
  const enumValues = [...block![1]!.matchAll(/"([a-z]+)"/g)].map(
    (match) => match[1]!,
  );
  expect([...MEMBER_COLOR_CODES]).toEqual(enumValues);
  expect([...MEMBER_COLOR_CODES]).toEqual([
    "pomodoro",
    "glicine",
    "salvia",
    "cobalto",
    "zafferano",
    "lampone",
    "ceruleo",
    "peonia",
    "basilico",
    "cannella",
  ]);
  expect(MEMBER_COLOR_SHADES).toEqual({
    pomodoro: "corallo",
    glicine: "glicine",
    salvia: "menta",
    cobalto: "blu",
    zafferano: "ambra",
    lampone: "sabbia",
    ceruleo: "azzurro",
    peonia: "rosa",
    basilico: "ardesia",
    cannella: "cannella",
  });
});
