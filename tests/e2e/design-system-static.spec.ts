import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

function files(dir: string, extension: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path, extension)
      : extension.test(path)
        ? [path]
        : [];
  });
}

// Hex colors, color functions, and numbers with px / ms / em units.
const FORBIDDEN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\d(px|ms|em)\b/;

test("CA-10: nessun valore scritto a mano fuori da :root", () => {
  const offenders: string[] = [];

  for (const file of files("src", /\.css$/)) {
    // Comments may mention units: blank them out but keep the line numbers.
    const lines = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
      .split("\n");
    lines.forEach((line, index) => {
      const code = line;
      // Variable declarations in :root and media query widths are allowed.
      if (/^\s*--[a-z0-9-]+\s*:/.test(code)) return;
      if (/^\s*@media/.test(code)) return;
      // Same for container query conditions (#313): like @media, they do not
      // accept variables. Only the condition line is exempt, never the body.
      if (/^\s*@container/.test(code)) return;
      if (FORBIDDEN.test(code))
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }

  for (const file of files("src/components/ui", /\.(tsx?|css)$/)) {
    const text = readFileSync(file, "utf8");
    if (/\bstyle\s*=/.test(text)) offenders.push(`${file}: style=`);
    if (file.endsWith(".css") && FORBIDDEN.test(text)) offenders.push(file);
    if (/#[0-9a-fA-F]{6}\b|\brgba?\(/.test(text))
      offenders.push(`${file}: color`);
  }

  expect(offenders).toEqual([]);
});

// ---- #196 (tokens and fonts of the 2.0 phone design) ----

test("#196 CA-12: pesi solo 400, 600, 700 e font-weight sempre da token", () => {
  const offenders: string[] = [];
  const declared: string[] = [];
  for (const file of files("src", /\.css$/)) {
    // Comments are blanked out, the line numbers stay.
    const lines = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
      .split("\n");
    lines.forEach((line, index) => {
      const token = /^\s*(--weight-[a-z0-9-]+)\s*:\s*([^;]+);/.exec(line);
      if (token) {
        declared.push(token[1]!);
        if (!["400", "600", "700"].includes(token[2]!.trim()))
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
      for (const match of line.matchAll(
        /(^|[\s;{])font-weight\s*:\s*([^;}]+)/g,
      )) {
        const value = match[2]!.trim();
        if (!/^(var\(--weight-[a-z0-9-]+\)|inherit)$/.test(value))
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  // The six weight tokens still exist: names kept, values changed.
  expect([...new Set(declared)].sort()).toEqual([
    "--weight-forte",
    "--weight-medio",
    "--weight-normale",
    "--weight-pieno",
    "--weight-semi",
    "--weight-sottile",
  ]);
  expect(offenders).toEqual([]);
});

test("#196 CA-15: la corrispondenza codice-tinta vive solo in member-colors.ts", () => {
  const shades = [
    "corallo",
    "menta",
    "blu",
    "ambra",
    "sabbia",
    "azzurro",
    "rosa",
    "ardesia",
  ];
  const offenders: string[] = [];
  for (const file of files("src", /\.tsx?$/)) {
    const normal = file.split("\\").join("/");
    if (normal === "src/lib/member-colors.ts") continue;
    if (normal.startsWith("src/lib/i18n/messages/")) continue;
    const text = readFileSync(file, "utf8");
    for (const shade of shades) {
      if (new RegExp(`(["'\`])${shade}\\1`).test(text))
        offenders.push(`${file}: "${shade}"`);
    }
  }
  expect(offenders).toEqual([]);
});
