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
