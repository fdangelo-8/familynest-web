import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Page } from "@playwright/test";
import type { Scenario } from "./harness/app";

// Mounts shared React components in a real browser without adding a route to
// the app. The harness (./harness/app.tsx) and the components it imports are
// compiled with TypeScript and joined in one script with a tiny CommonJS
// loader; React comes from node_modules. `next/link` becomes a plain anchor.
// The script runs on a public page of the app, so its CSS is the real one.

const ROOT = process.cwd();
const nodeRequire = createRequire(path.join(ROOT, "package.json"));
const ENTRY = path.join(ROOT, "tests/fixtures/harness/app.tsx");
const LINK_STUB = path.join(ROOT, "tests/fixtures/harness/next-link-stub.tsx");

function isFile(file: string) {
  return existsSync(file) && statSync(file).isFile();
}

function resolveFile(base: string): string {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ]) {
    if (isFile(candidate)) return candidate;
  }
  throw new Error(`Harness: cannot resolve ${base}`);
}

function resolveSpec(spec: string, from: string): string {
  if (spec === "next/link") return LINK_STUB;
  if (spec.startsWith("@/"))
    return resolveFile(path.join(ROOT, "src", spec.slice(2)));
  if (spec.startsWith("."))
    return resolveFile(path.resolve(path.dirname(from), spec));
  return nodeRequire.resolve(spec);
}

let bundle: string | undefined;

function buildBundle(): string {
  const ids = new Map<string, number>();
  const bodies: string[] = [];

  const visit = (file: string): number => {
    const known = ids.get(file);
    if (known !== undefined) return known;
    const id = ids.size;
    ids.set(file, id);
    const source = readFileSync(file, "utf8");
    const code = /\.tsx?$/.test(file)
      ? ts.transpileModule(source, {
          fileName: file,
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            jsx: ts.JsxEmit.ReactJSX,
            esModuleInterop: true,
          },
        }).outputText
      : source;
    const map: Record<string, number> = {};
    for (const match of code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = match[1]!;
      if (!(spec in map)) map[spec] = visit(resolveSpec(spec, file));
    }
    bodies[id] =
      `${id}:[function(module,exports,require){${code}\n},${JSON.stringify(map)}]`;
    return id;
  };

  const entry = visit(ENTRY);
  return `(function(){
var process={env:{NODE_ENV:"production"}};
var defs={${bodies.join(",")}};var cache={};
function load(id){
  if(cache[id])return cache[id].exports;
  var module=cache[id]={exports:{}};var def=defs[id];
  def[0](module,module.exports,function(spec){return load(def[1][spec]);});
  return module.exports;
}
load(${entry});
})();`;
}

/** Opens a public page of the app and mounts one harness scenario on it. */
export async function mountComponents(page: Page, scenario: Scenario) {
  bundle ??= buildBundle();
  await page.goto("/privacy");
  await page.locator("h1").first().waitFor();
  await page.addScriptTag({ content: bundle });
  await page.evaluate((name) => window.__mount(name), scenario);
}
