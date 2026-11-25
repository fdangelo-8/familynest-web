import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

/**
 * Static check of the texts in `src/` (issue #477, CA-12 ... CA-22).
 *
 * It reads the files with the TypeScript parser and reports, with file and
 * line: visible text written inside components, language or time zone written
 * by hand, and message files that do not follow the rules.
 *
 * Known limits (on purpose, to avoid false alarms): outside the JSX a phrase is
 * recognised when it starts with a capital letter and has at least two words,
 * or has accented letters or «», or sits in a property such as `label`/`title`.
 * Lowercase phrases without accents are not found.
 *
 * An exception is declared with `// i18n-ignore: <reason of 10+ characters>`
 * on the same line or on the line above.
 */

export type Rule =
  | "jsx-text"
  | "jsx-attr"
  | "metadata"
  | "literal"
  | "locale-literal"
  | "ignore-without-reason"
  | "messages-shape"
  | "messages-import"
  | "new-area-unmarked";

export type Finding = {
  rule: Rule;
  /** Path relative to the scanned root; empty for an in-memory example. */
  file: string;
  line: number;
  text: string;
};

/** Folders never checked (CA-22). */
export const EXCLUDED_PATHS = [
  "src/app/design-system",
  "src/app/fornitore-finto",
  "src/types",
] as const;

/**
 * Areas that still have to be migrated (frozen list, it only shrinks).
 * Every new folder must be born with its own `messages/it.ts`.
 * The final phase empties this list (CA-27).
 */
export const LEGACY_AREAS: readonly string[] = [
  "src/app",
  "src/app/(app)/@modal/(.)aggiungi",
  "src/app/(app)/@modal/(.)ricerca",
  "src/app/(app)/@modal/[...rest]",
  "src/app/(app)/@modal/aggiungi",
  "src/app/(app)/@modal/ricerca",
  "src/app/(app)/[...rest]",
  "src/app/(app)/aggiungi",
  "src/app/(app)/calendari-collegati",
  "src/app/(app)/calendario",
  "src/app/(app)/casa",
  "src/app/(app)/esplora",
  "src/app/(app)/figli/[id]",
  "src/app/(app)/impegni/[id]",
  "src/app/(app)/impostazioni",
  "src/app/(app)/membri",
  "src/app/(app)/nest",
  "src/app/(app)/notifiche",
  "src/app/(app)/oggi",
  "src/app/(app)/profilo",
  "src/app/(app)/ricerca",
  "src/app/accesso",
  "src/app/desideri",
  "src/app/invito",
  "src/app/onboarding",
  "src/app/privacy",
  "src/app/termini",
  "src/components/accesso",
  "src/components/aggiungi",
  "src/components/calendari-collegati",
  "src/components/calendario",
  "src/components/calendario-giorno",
  "src/components/calendario-mese",
  "src/components/calendario-settimana",
  "src/components/casa",
  "src/components/casa-da-fare",
  "src/components/casa-scadenze",
  "src/components/casa-spesa",
  "src/components/desideri",
  "src/components/esplora",
  "src/components/evento-modulo",
  "src/components/figli",
  "src/components/impegni",
  "src/components/impostazioni",
  "src/components/invito",
  "src/components/lista-desideri",
  "src/components/membri",
  "src/components/nest",
  "src/components/notifiche",
  "src/components/oggi",
  "src/components/onboarding",
  "src/components/profilo",
  "src/components/ricerca",
  "src/components/ui",
  "src/lib",
];

/**
 * Files outside the migrated areas that still write a language or a time zone
 * by hand (phase 0 baseline). Each phase removes its files from the code; the
 * list only shrinks. A file in a migrated area is always checked, listed or not.
 */
export const LOCALE_LITERAL_LEGACY_FILES: readonly string[] = [
  "src/components/aggiungi/labels.ts",
  "src/components/aggiungi/parse-list.ts",
  "src/components/aggiungi/parse-phrase.ts",
  "src/components/aggiungi/parse-todo.ts",
  "src/components/calendari-collegati/model.ts",
  "src/components/calendario-giorno/model.ts",
  "src/components/calendario-settimana/model.ts",
  "src/components/casa-da-fare/model.ts",
  "src/components/casa-scadenze/model.ts",
  "src/components/casa-spesa/model.ts",
  "src/components/figli/model.ts",
  "src/components/impegni/model.ts",
  "src/components/lista-desideri/model.ts",
  "src/components/oggi/model.ts",
  "src/components/ui/Avatar/Avatar.tsx",
  "src/components/ui/ColorChoice/ColorChoice.tsx",
  "src/lib/calendar.ts",
  "src/lib/wishlist-texts.ts",
];

const CONFIG_FILE = "src/lib/i18n/config.ts";
const MIN_REASON = 10;

/** JSX attributes that the user reads or hears. */
const TEXT_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "alt",
  "title",
  "placeholder",
  "label",
  "summary",
  "caption",
  "description",
  "heading",
  "helperText",
  "errorMessage",
  "emptyText",
  "ariaLabel",
]);

/** Object properties that normally hold a text for the user. */
const TEXT_PROPERTIES = new Set([
  "label",
  "title",
  "text",
  "message",
  "description",
  "placeholder",
  "heading",
  "caption",
  "hint",
  "error",
  "subtitle",
]);

const METADATA_PROPERTIES = new Set(["title", "description"]);
const ACCENTED = /[À-ÖØ-öø-ÿ«»]/;
const LANGUAGE_TAG = /^[a-z]{2}-[A-Z]{2}$/;
const TIME_ZONE_NAME =
  /^(?:Europe|America|Asia|Africa|Atlantic|Pacific|Australia|Indian|Antarctica)\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/;

function normalize(path: string): string {
  return path.replace(/\\/g, "/");
}

function hasLetter(text: string): boolean {
  return /\p{L}/u.test(text.replace(/&[#\w]+;/g, ""));
}

/** Phrase heuristic for literals outside the JSX. */
function looksLikePhrase(text: string): boolean {
  const value = text.trim();
  if (!hasLetter(value)) return false;
  if (ACCENTED.test(value)) return true;
  const words = value.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  return words.length >= 2 && /^\p{Lu}/u.test(value);
}

function lineOf(sf: ts.SourceFile, position: number): number {
  return sf.getLineAndCharacterOfPosition(position).line + 1;
}

function isStringLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function parse(source: string, path: string): ts.SourceFile {
  const tsx = path === "" || path.endsWith(".tsx");
  return ts.createSourceFile(
    path || "example.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

type Ignore = { line: number; reasonOk: boolean };

function readIgnores(source: string): Ignore[] {
  const ignores: Ignore[] = [];
  source.split("\n").forEach((text, index) => {
    const at = text.indexOf("i18n-ignore");
    if (at < 0) return;
    // Only inside a comment.
    const before = text.slice(0, at);
    if (!/(\/\/|\/\*)\s*$/.test(before) && !/\/\*[^]*$/.test(before)) return;
    const after = text.slice(at + "i18n-ignore".length);
    const reason = after.startsWith(":")
      ? after
          .slice(1)
          .replace(/\*\/\}?\s*$/, "")
          .replace(/\*\/.*$/, "")
          .trim()
      : "";
    ignores.push({ line: index + 1, reasonOk: reason.length >= MIN_REASON });
  });
  return ignores;
}

function calleeName(expression: ts.Expression): string {
  return expression.getText();
}

/** True when the literal is an argument of `new XxxError(...)` or `console.*`. */
function insideErrorOrConsole(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isNewExpression(current) || ts.isCallExpression(current)) {
      const name = calleeName(current.expression);
      if (/(^|\.)\w*Error$/.test(name) || /^console\./.test(name)) return true;
    }
    if (ts.isBlock(current) || ts.isSourceFile(current)) return false;
  }
  return false;
}

/** The first argument(s) of locale-aware calls: `toLocale*`, `Intl.*`. */
function isLocaleArgument(node: ts.Node): boolean {
  const call = node.parent;
  if (!call || !(ts.isCallExpression(call) || ts.isNewExpression(call)))
    return false;
  if (!call.arguments?.includes(node as ts.Expression)) return false;
  const name = calleeName(call.expression);
  return (
    /(^|\.)(toLocale\w*|localeCompare)$/.test(name) || /^Intl\./.test(name)
  );
}

/** Strings a JSX expression can show: ternary branches, `&&`, `||`, `??`. */
function visibleStrings(expression: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(expression))
    return visibleStrings(expression.expression);
  if (isStringLike(expression) || ts.isTemplateExpression(expression))
    return [expression];
  if (ts.isConditionalExpression(expression))
    return [
      ...visibleStrings(expression.whenTrue),
      ...visibleStrings(expression.whenFalse),
    ];
  if (ts.isBinaryExpression(expression)) {
    const kind = expression.operatorToken.kind;
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return visibleStrings(expression.right);
    if (
      kind === ts.SyntaxKind.BarBarToken ||
      kind === ts.SyntaxKind.QuestionQuestionToken
    )
      return [
        ...visibleStrings(expression.left),
        ...visibleStrings(expression.right),
      ];
  }
  return [];
}

function templateText(node: ts.Expression): string {
  if (isStringLike(node)) return node.text;
  if (ts.isTemplateExpression(node))
    return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]
      .join(" ")
      .trim();
  return "";
}

function propertyName(node: ts.PropertyName | undefined): string {
  if (!node) return "";
  return ts.isIdentifier(node) || isStringLike(node) ? node.text : "";
}

/** Checks one source text. `path` decides the exemption of `config.ts`. */
export function scanSource(
  source: string,
  options: { path?: string; onlyRules?: readonly Rule[] } = {},
): Finding[] {
  const path = normalize(options.path ?? "");
  const sf = parse(source, path);
  const found: Finding[] = [];
  const handled = new Set<ts.Node>();
  const isConfig = path === CONFIG_FILE || path.endsWith(`/${CONFIG_FILE}`);

  const add = (rule: Rule, position: number, text: string) =>
    found.push({ rule, file: path, line: lineOf(sf, position), text });

  const addLocale = (node: ts.Node, value: string) => {
    if (isConfig) return;
    add("locale-literal", node.getStart(sf), value);
  };

  const reportLocale = (node: ts.Node): boolean => {
    if (!isStringLike(node)) return false;
    const value = node.text;
    const isTag = LANGUAGE_TAG.test(value) || TIME_ZONE_NAME.test(value);
    const isCode = /^[a-z]{2}$/.test(value) && isLocaleArgument(node);
    if (!isTag && !isCode) return false;
    handled.add(node);
    addLocale(node, value);
    return true;
  };

  const visit = (node: ts.Node): void => {
    // Metadata of a page.
    const isMetadata =
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "metadata") ||
      (ts.isFunctionDeclaration(node) &&
        node.name?.text === "generateMetadata");
    if (isMetadata) {
      const inspect = (inner: ts.Node): void => {
        if (
          isStringLike(inner) &&
          inner.parent &&
          ts.isPropertyAssignment(inner.parent) &&
          METADATA_PROPERTIES.has(propertyName(inner.parent.name)) &&
          inner.parent.initializer === inner
        ) {
          handled.add(inner);
          if (hasLetter(inner.text))
            add("metadata", inner.getStart(sf), inner.text);
        }
        ts.forEachChild(inner, inspect);
      };
      ts.forEachChild(node, inspect);
    }

    // Text between the tags.
    if (ts.isJsxText(node)) {
      const match = /\S/.exec(node.text);
      if (match && hasLetter(node.text))
        add("jsx-text", node.pos + match.index, node.text.trim());
    }

    // `{cond ? "Yes" : "No"}` between the tags.
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      for (const literal of visibleStrings(node.expression)) {
        handled.add(literal);
        if (hasLetter(templateText(literal)))
          add("jsx-text", literal.getStart(sf), templateText(literal));
      }
    }

    // Attributes.
    if (ts.isJsxAttribute(node)) {
      const name = ts.isIdentifier(node.name)
        ? node.name.text
        : node.name.getText(sf);
      const initializer = node.initializer;
      if (initializer && isStringLike(initializer)) {
        handled.add(initializer);
        if (name === "lang" && /^[a-z]{2}(-[A-Z]{2})?$/.test(initializer.text))
          addLocale(initializer, initializer.text);
        else if (TEXT_ATTRIBUTES.has(name) && hasLetter(initializer.text))
          add("jsx-attr", initializer.getStart(sf), initializer.text);
      } else if (
        initializer &&
        ts.isJsxExpression(initializer) &&
        initializer.expression &&
        TEXT_ATTRIBUTES.has(name)
      ) {
        for (const literal of visibleStrings(initializer.expression)) {
          handled.add(literal);
          if (hasLetter(templateText(literal)))
            add("jsx-attr", literal.getStart(sf), templateText(literal));
        }
      }
    }

    // Language and time zone written by hand, and phrases in the code.
    if (isStringLike(node) || ts.isTemplateExpression(node)) {
      if (!handled.has(node)) {
        if (isStringLike(node) && reportLocale(node)) {
          // reported as locale-literal
        } else if (isPhraseCandidate(node)) {
          const text = templateText(node);
          if (looksLikePhrase(text) || isTextProperty(node, text))
            add("literal", node.getStart(sf), text);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);

  // Exceptions and their reasons.
  const ignores = readIgnores(source);
  const result: Finding[] = [];
  for (const ignore of ignores) {
    if (!ignore.reasonOk)
      result.push({
        rule: "ignore-without-reason",
        file: path,
        line: ignore.line,
        text: "i18n-ignore needs a reason of at least 10 characters",
      });
  }
  for (const finding of found) {
    const covered = ignores.some(
      (ignore) =>
        ignore.reasonOk &&
        (ignore.line === finding.line || ignore.line === finding.line - 1),
    );
    if (!covered) result.push(finding);
  }
  result.sort((a, b) => a.line - b.line);
  return options.onlyRules
    ? result.filter((finding) => options.onlyRules?.includes(finding.rule))
    : result;
}

function isTextProperty(node: ts.Node, text: string): boolean {
  const parent = node.parent;
  return (
    !!parent &&
    ts.isPropertyAssignment(parent) &&
    parent.initializer === node &&
    TEXT_PROPERTIES.has(propertyName(parent.name)) &&
    hasLetter(text) &&
    /^\p{Lu}/u.test(text.trim()) &&
    !/[-_./:@#]/.test(text.trim())
  );
}

/** Excludes imports, types, directives, property names, errors, logs. */
function isPhraseCandidate(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent))
    return false;
  if (ts.isLiteralTypeNode(parent) || ts.isExternalModuleReference(parent))
    return false;
  if (ts.isExpressionStatement(parent)) return false;
  if (ts.isJsxAttribute(parent)) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (
    ts.isElementAccessExpression(parent) &&
    parent.argumentExpression === node
  )
    return false;
  if (ts.isCaseClause(parent) && parent.expression === node) return false;
  if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression)) {
    if (parent.expression.text === "require") return false;
  }
  if (
    ts.isCallExpression(parent) &&
    parent.expression.kind === ts.SyntaxKind.ImportKeyword
  )
    return false;
  if (insideErrorOrConsole(node)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Message files (`messages/<lang>.ts`)
// ---------------------------------------------------------------------------

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current)
  )
    current = current.expression;
  return current;
}

const PLURAL_KEYS = new Set(["zero", "one", "other"]);

/** Checks the shape and the imports of a message file. */
export function checkMessagesFile(
  source: string,
  path = "src/example/messages/it.ts",
): Finding[] {
  const file = normalize(path);
  const sf = parse(source, file);
  const found: Finding[] = [];
  const add = (rule: Rule, node: ts.Node, text: string) =>
    found.push({
      rule,
      file,
      line: lineOf(sf, node.getStart(sf)),
      text,
    });
  const inBase = file.includes("src/lib/i18n/messages/");

  const checkValue = (value: ts.Expression): void => {
    const inner = unwrap(value);
    if (isStringLike(inner)) {
      if (inner.text.trim() === "") add("messages-shape", inner, "empty text");
      return;
    }
    if (ts.isObjectLiteralExpression(inner)) {
      checkObject(inner);
      return;
    }
    add(
      "messages-shape",
      inner,
      `not a text: ${inner.getText(sf).slice(0, 40)}`,
    );
  };

  const checkObject = (object: ts.ObjectLiteralExpression): void => {
    const names: string[] = [];
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) {
        add("messages-shape", property, "only `key: value` is allowed");
        continue;
      }
      names.push(propertyName(property.name));
      checkValue(property.initializer);
    }
    const looksPlural =
      names.length > 0 && names.every((name) => PLURAL_KEYS.has(name));
    if (looksPlural && !(names.includes("one") && names.includes("other")))
      add("messages-shape", object, "plural forms need `one` and `other`");
  };

  for (const statement of sf.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression)
    ) {
      add(
        "messages-shape",
        statement,
        `directive "${statement.expression.text}"`,
      );
    } else if (ts.isImportDeclaration(statement)) {
      const specifier = ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : "";
      const allowed =
        specifier === "@/lib/i18n" ||
        /(^|\/)messages\/[a-z]{2}$/.test(specifier) ||
        /^\.\/[a-z]{2}$/.test(specifier) ||
        (inBase && specifier === "./types");
      if (!allowed)
        add("messages-import", statement, `import from "${specifier}"`);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer) checkValue(declaration.initializer);
      }
    } else if (ts.isExportAssignment(statement)) {
      checkValue(statement.expression);
    }
  }

  // Any function or JSX, wherever it hides.
  const search = (node: ts.Node): void => {
    if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    )
      add("messages-shape", node, "functions and JSX are not allowed");
    ts.forEachChild(node, search);
  };
  search(sf);

  return found.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------
// Repository scan
// ---------------------------------------------------------------------------

function isExcluded(rel: string): boolean {
  return EXCLUDED_PATHS.some(
    (excluded) => rel === excluded || rel.startsWith(`${excluded}/`),
  );
}

function listDir(dir: string): { name: string; isDir: boolean }[] {
  return readdirSync(dir).map((name) => ({
    name,
    isDir: statSync(join(dir, name)).isDirectory(),
  }));
}

function hasMessages(root: string, rel: string): boolean {
  return existsSync(join(root, rel, "messages", "it.ts"));
}

function isSource(name: string): boolean {
  return /\.tsx?$/.test(name) && !name.endsWith(".d.ts");
}

/** Every folder of `src/` (excluded paths left out), relative to `root`. */
function walkDirs(root: string, rel = "src"): string[] {
  const dir = join(root, rel);
  if (!existsSync(dir) || isExcluded(rel)) return [];
  const dirs = [rel];
  for (const entry of listDir(dir))
    if (entry.isDir && entry.name !== "node_modules")
      dirs.push(...walkDirs(root, `${rel}/${entry.name}`));
  return dirs;
}

/** Folders with `messages/it.ts`: the migrated areas. */
export function findMigratedAreas(root: string): string[] {
  return walkDirs(root).filter((rel) => hasMessages(root, rel));
}

/**
 * Files of an area. Sub-folders with their own `messages/it.ts` belong to
 * their own area; sub-folders with a `page.tsx` and no messages are not
 * migrated yet and are skipped (CA-20).
 */
function areaFiles(root: string, area: string): string[] {
  const files: string[] = [];
  const walk = (rel: string, top: boolean): void => {
    if (isExcluded(rel)) return;
    for (const entry of listDir(join(root, rel))) {
      const child = `${rel}/${entry.name}`;
      if (!entry.isDir) {
        if (isSource(entry.name)) files.push(child);
        continue;
      }
      if (entry.name === "node_modules") continue;
      if (entry.name === "messages" && top) continue;
      if (hasMessages(root, child)) continue;
      if (existsSync(join(root, child, "page.tsx"))) continue;
      walk(child, false);
    }
  };
  walk(area, true);
  return files;
}

function messageFiles(root: string, area: string): string[] {
  const dir = join(root, area, "messages");
  return listDir(dir)
    .filter((entry) => !entry.isDir && /^[a-z]{2}\.ts$/.test(entry.name))
    .map((entry) => `${area}/messages/${entry.name}`);
}

function withFile(findings: Finding[], file: string): Finding[] {
  return findings.map((finding) => ({ ...finding, file }));
}

/** Candidate areas: `src/components/<x>`, folders with `page.tsx`, `src/lib`. */
function candidateAreas(root: string): string[] {
  const candidates = new Set<string>();
  const components = join(root, "src/components");
  if (existsSync(components))
    for (const entry of listDir(components))
      if (entry.isDir && !isExcluded(`src/components/${entry.name}`))
        candidates.add(`src/components/${entry.name}`);
  for (const rel of walkDirs(root))
    if (rel.startsWith("src/app") && existsSync(join(root, rel, "page.tsx")))
      candidates.add(rel);
  if (existsSync(join(root, "src/lib"))) candidates.add("src/lib");
  return [...candidates].sort();
}

function newAreaFindings(
  root: string,
  legacyAreas: readonly string[],
): Finding[] {
  const legacy = new Set(legacyAreas);
  const found: Finding[] = [];
  for (const area of candidateAreas(root)) {
    if (hasMessages(root, area) || legacy.has(area)) continue;
    // A sub-folder of an area already known (legacy or migrated).
    const parts = area.split("/");
    let covered = false;
    for (let length = parts.length - 1; length > 2; length--) {
      const ancestor = parts.slice(0, length).join("/");
      if (legacy.has(ancestor) || hasMessages(root, ancestor)) covered = true;
    }
    if (covered) continue;
    found.push({
      rule: "new-area-unmarked",
      file: area,
      line: 1,
      text: `new folder without messages/it.ts: add ${area}/messages/it.ts`,
    });
  }
  return found;
}

/** Checks the migrated areas and that every new area has its messages. */
export function scanRepo(
  root: string,
  options: { legacyAreas?: readonly string[] } = {},
): Finding[] {
  const found: Finding[] = [];
  const seen = new Set<string>();
  for (const area of findMigratedAreas(root)) {
    for (const file of areaFiles(root, area)) {
      if (seen.has(file)) continue;
      seen.add(file);
      found.push(
        ...scanSource(readFileSync(join(root, file), "utf8"), { path: file }),
      );
    }
    for (const file of messageFiles(root, area))
      found.push(
        ...withFile(
          checkMessagesFile(readFileSync(join(root, file), "utf8"), file),
          file,
        ),
      );
  }
  found.push(...newAreaFindings(root, options.legacyAreas ?? LEGACY_AREAS));
  return found;
}

/**
 * Phase 0 rule, whole `src/`: no language or time zone written by hand outside
 * `src/lib/i18n/config.ts`. Files listed in `exceptions` and outside a migrated
 * area are tolerated until their phase.
 */
export function scanLocaleLiterals(
  root: string,
  options: { exceptions?: readonly string[] } = {},
): Finding[] {
  const exceptions = new Set(options.exceptions ?? LOCALE_LITERAL_LEGACY_FILES);
  const migrated = findMigratedAreas(root);
  const found: Finding[] = [];
  for (const dir of walkDirs(root)) {
    for (const entry of listDir(join(root, dir))) {
      if (entry.isDir || !isSource(entry.name)) continue;
      const file = `${dir}/${entry.name}`;
      const inMigrated = migrated.some(
        (area) => file === area || file.startsWith(`${area}/`),
      );
      if (exceptions.has(file) && !inMigrated) continue;
      found.push(
        ...scanSource(readFileSync(join(root, file), "utf8"), {
          path: file,
          onlyRules: ["locale-literal"],
        }),
      );
    }
  }
  return found;
}

export function describeFindings(findings: readonly Finding[]): string[] {
  return findings.map(
    (finding) =>
      `${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`,
  );
}

export function relativeToRoot(root: string, path: string): string {
  return normalize(relative(root, path));
}
