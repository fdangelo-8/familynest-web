import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

/**
 * Static reader of the texts in `src/` for the product name checks (#502).
 * It looks only at strings, templates and JSX text (never at comments) with
 * the TypeScript scanner, so a comment that names the product is not a hit.
 */

export type TextNode = { file: string; line: number; text: string };

/** Every `.ts` / `.tsx` file under `dir`, as paths relative to `root`. */
export function sourceFiles(root: string, dir = "src"): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts"))
        out.push(relative(root, path).split("\\").join("/"));
    }
  };
  walk(join(root, dir));
  return out;
}

/** Strings, templates (one entry each) and JSX text of one file. */
export function textsOf(root: string, file: string): TextNode[] {
  const source = readFileSync(join(root, file), "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: TextNode[] = [];
  const add = (node: ts.Node, text: string) =>
    found.push({
      file,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      text,
    });
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      add(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      add(
        node,
        [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(
          "\u0000",
        ),
      );
    } else if (ts.isJsxText(node)) {
      if (node.text.trim()) add(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
