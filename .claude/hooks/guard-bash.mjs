#!/usr/bin/env node
// PreToolUse hook for Bash: blocks commands that break the team rules.
import os from "node:os";
import path from "node:path";
import { readInput, repoInfo, relativeToRepo, block } from "./lib.mjs";

const ALLOWED_SUPABASE_REF = "yksosqvugiempsldejyt";

const input = readInput();
const cmd = String(input?.tool_input?.command ?? "");
if (!cmd.trim()) process.exit(0);

const agent = String(input.agent_type ?? "");
const { branch } = repoInfo(input.cwd || process.cwd());
const admin = !agent && branch.startsWith("admin/");

/** [pattern, reason, allowedInAdminSession] */
const rules = [
  // Git: main is protected, history is never rewritten.
  [
    /\bgit\s+push\b[^;&|\n]*\s(\S+:)?(refs\/heads\/)?main(\s|$)/,
    "push su main vietato: apri una PR.",
    false,
  ],
  [
    /\bgit\s+push\b[^;&|\n]*\s(--force(?!-with-lease)|-f)(\s|$)/,
    "usa solo --force-with-lease e solo sul tuo branch.",
    false,
  ],
  [
    /\bgit\s+push\b[^;&|\n]*\s(--delete|--mirror|-d)(\s|$)/,
    "cancellare o rispecchiare branch remoti è vietato.",
    false,
  ],
  [
    /\bgit\s+push\b[^;&|\n]*\s:\S+/,
    "cancellare branch remoti è vietato.",
    false,
  ],
  [
    /\bgit\s+(filter-branch|filter-repo|replace)\b/,
    "riscrivere la storia è vietato.",
    false,
  ],
  [
    /\bgit\s+config\b[^;&|\n]*core\.hooksPath/,
    "non modificare gli hook di git.",
    false,
  ],
  [/--no-verify\b/, "non saltare i controlli con --no-verify.", false],
  [
    /\bgit\s+update-ref\b[^;&|\n]*\brefs\/heads\/main\b/,
    "non toccare main.",
    false,
  ],

  // GitHub: no merges, approvals, repository administration or secrets.
  [/\bgh\s+pr\s+merge\b/, "il merge lo fa solo Francesco.", false],
  [
    /(^|[;&|]\s*|\$\(\s*)gh\s+(issue|pr|label|project)\s/,
    "i comandi gh issue/pr/label/project non funzionano nelle sessioni di Claude Code (GraphQL non disponibile). Usa node scripts/agenti/gh.mjs (lancialo senza argomenti per l'elenco dei comandi).",
    false,
  ],
  [
    /\bgh\s+pr\s+review\b[^;&|\n]*(--approve|-a)(\s|$)/,
    "gli agenti non approvano PR: scrivi l'esito come commento.",
    false,
  ],
  [
    /\bgh\s+(secret|variable|ruleset|auth\s+token|repo\s+(delete|edit|rename|archive|set-default))\b/,
    "operazione riservata a Francesco.",
    false,
  ],
  [
    /\bgh\s+api\b[^;&|\n]*\/(merges?|secrets|protection|rulesets|collaborators|hooks|keys|environments)\b/,
    "operazione GitHub riservata a Francesco.",
    false,
  ],
  [
    /\bgh\s+api\b[^;&|\n]*(-X|--method)\s*DELETE\b/,
    "cancellazioni via API GitHub vietate.",
    false,
  ],
  [
    /\bgh\s+(issue|pr|release)\s+delete\b/,
    "non si cancellano issue, PR o release.",
    false,
  ],
  [
    /\bgh\s+workflow\s+(disable|enable)\b/,
    "non si disattivano i workflow.",
    false,
  ],

  // Supabase: only local development; remote changes happen in CI after merge.
  [
    /\bsupabase\s+(login|link|unlink|projects|orgs|secrets|branches|functions\s+deploy|db\s+(push|pull|dump|remote)|migration\s+(repair|up|fetch)|storage)\b/,
    "operazioni Supabase remote vietate: le migrazioni le applica la CI dopo il merge.",
    false,
  ],
  [
    /\bsupabase\b[^;&|\n]*(--db-url|--project-ref|--project-id|--linked)\b/,
    "niente connessioni al database remoto: lavora sul database locale.",
    false,
  ],
  [
    /\b(psql|pg_dump|pg_restore|pg_dumpall)\b[^;&|\n]*(supabase\.(co|com)|pooler\.)/,
    "connessioni dirette al database remoto vietate.",
    false,
  ],
  [
    /\bSUPABASE_(ACCESS_TOKEN|DB_URL)\b/,
    "non usare token o stringhe di connessione Supabase remote.",
    false,
  ],

  // Secrets: never print or move them.
  [
    /\b(cat|less|more|head|tail|bat|strings|grep|rg|sed|awk|cp|mv|scp|rsync|base64|xxd|od)\b[^;&|\n]*(^|[\s/'"=])\.env(\.[\w-]+)?(?<!\.example)(\s|$|['"])/,
    "i file .env non si leggono né si copiano: le variabili sono già nell'ambiente.",
    false,
  ],
  [
    /(^|[;&|]\s*)(printenv|env|export\s+-p|set)\s*($|[|;&>])/,
    "non stampare tutte le variabili d'ambiente.",
    false,
  ],
  [
    /\b(echo|printf|printenv)\b[^;&|\n]*\b(SUPABASE_SECRET_KEY|[A-Z_]*(TOKEN|SECRET|PASSWORD|PRIVATE)[A-Z_]*)\b/,
    "non stampare segreti.",
    false,
  ],
  [
    /\b(curl|wget)\b[^;&|\n]*\$\{?[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/,
    "non inviare segreti con curl o wget.",
    false,
  ],

  // Destructive filesystem operations.
  [
    /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(-[a-zA-Z]+\s+)*(\/|~|\$HOME|\.|\.\/|\*|\.\/\*)(\s|$)/,
    "cancellazione distruttiva vietata.",
    false,
  ],
  [
    /\brm\b[^;&|\n]*(\.git(\s|\/|$)|supabase\/migrations|tests\/visual\/__screenshots__|docs\/mockup)/,
    "non cancellare storia git, migrazioni, mockup o screenshot di riferimento.",
    false,
  ],
  [
    /\bgit\s+(clean\s+-[a-zA-Z]*[fdx]|reset\s+--hard\s+(?!HEAD\b|origin\/(feat|shared|fix|db|docs|chore)\/))/,
    "operazione git distruttiva: conserva il lavoro con un commit.",
    false,
  ],
  [/\bchmod\s+(-R\s+)?777\b/, "permessi troppo aperti.", false],
  [/(^|[;&|]\s*)sudo\b/, "sudo non consentito.", true],

  // Team configuration through the shell.
  [
    /(>{1,2}|\btee\b|\bsed\s+-i|\bcp\b|\bmv\b|\brm\b|\bln\b)[^;&|\n]*(\.claude\/(settings[\w.-]*\.json|hooks|agents|commands)|\.github\/|scripts\/agenti\/|CLAUDE\.md)/,
    "configurazione di agenti, hook e CI modificabile solo in una sessione di manutenzione su branch admin/*.",
    true,
  ],
  // Database files through the shell (bypassing the file guard).
  [
    /(>{1,2}|\btee\b|\bsed\s+-i|\bcp\b|\bmv\b|\bln\b)[^;&|\n]*(supabase\/(migrations|tests|seed)|src\/types\/database\.ts)/,
    "i file del database si modificano solo con gli strumenti di modifica, dall'architetto dati.",
    true,
  ],
];

for (const [re, reason, adminOk] of rules) {
  if (adminOk && admin) continue;
  if (re.test(cmd)) block(`${reason}\nComando: ${cmd.slice(0, 300)}`);
}

// ---------------------------------------------------------------------------
// Files change only through the Edit and Write tools (Francesco, 05/11): no
// in-place editors (sed -i, perl -i, ruby -i, awk -i inplace, ed, ex) on any
// path, and no redirection or tee into a repository file. Applies to every
// agent and to maintenance sessions too. Reading commands stay allowed.
const EDIT_ONLY =
  "i file si modificano solo con gli strumenti Edit e Write: niente modifiche dalla riga di comando (regola di Francesco del 05/11). Se Edit o Write non sono disponibili, fermati con BLOCCATO.";

// Start of a simple command, possibly behind a wrapper (sudo, env, xargs, find -exec...).
const AT_CMD = String.raw`(?:^|[\n;&|({\x60]|\$\(|(?:^|\s)(?:then|do|else|if|while|until|!|-exec|-execdir|-ok|-okdir))\s*(?:(?:sudo|env|command|builtin|exec|nohup|timeout|time|nice|ionice|stdbuf|xargs|busybox)(?:\s[^;&|\n]*?)?\s)?(?:\S*\/)?`;
const ARGS = String.raw`\s(?:[^;&|\n]*?\s)?`;
const IN_PLACE = [
  String.raw`g?sed${ARGS}(?:-[nErsuz]*i|--in-place)`,
  String.raw`perl${ARGS}-[aclnpsTtuUwWX0-9]*i`,
  String.raw`ruby${ARGS}-[acdlnpsvwWy0-9]*i`,
  String.raw`g?awk${ARGS}(?:-i\s*|--include(?:=|\s+))inplace\b`,
  String.raw`(?:ed|ex)(?=\s|$)`,
  String.raw`n?vim?${ARGS}(?:-[Ees]+|-c|\+)`,
].map((p) => new RegExp(`${AT_CMD}(?:${p})`));
const CD = new RegExp(String.raw`${AT_CMD}(?:cd|pushd)(?=\s|$)`, "g");
const TEE = new RegExp(String.raw`${AT_CMD}tee(?=\s|$)`, "g");
const ASSIGN = /(?:^|[\n;&|(]|\bexport|\blocal)\s*([A-Za-z_]\w*)=/g;
// `>|` before `>`, or `>|` would be read as `>` followed by a pipe.
const REDIRECT = /(?<![<>=&\-\d])(?:\d+|&)?(?:>\||>>?)(?![&(>])/g;
// A redirection operator inside a command's arguments (to skip it with its target).
const REDIRECT_OP = /^(?:\d+|&)?(?:>\||>>?|<<<|<<-?|<>|<)(&(?=[\d-]))?/;
// `[[` as a command: inside the test `<` and `>` compare strings, they do not redirect.
const TEST_START =
  /(?:^|[\n;&|(]|(?:^|\s)(?:if|elif|while|until|then|do|else|!))\s*\[\[(?=\s)/g;
const UNSET = new RegExp(
  String.raw`${AT_CMD}unset((?:\s+-[vf])*(?:\s+[A-Za-z_]\w*)+)`,
  "g",
);
const SHELL_BEFORE =
  /(?:^|[\s;&|(])(?:(?:ba|da|k|z)?sh|eval|su|watch|ssh)\b[^;&|\n]*$/;
const SIMPLE_WORD = /^[\w./=+:@%,~-]*$/;
// $TMPDIR, ${TMPDIR} and ${TMPDIR:-default} (also with -, := and =).
const TEMP_VAR =
  /^\$(?:\{(TMPDIR|TMP|TEMP|RUNNER_TEMP)(?:(:?)[-=]([^}]*))?\}|(TMPDIR|TMP|TEMP|RUNNER_TEMP)\b)/;

/**
 * Masks quoted text and heredoc bodies so that only real shell syntax is
 * matched. `masked` and `plain` have the same length: `plain` keeps the text,
 * `masked` replaces quoted content with \0. Quotes around simple words are
 * dropped (-i'' → -i, 'inplace' → inplace).
 */
function scan(src) {
  let masked = "";
  let plain = "";
  const strings = [];
  const heredocs = [];
  const arithmetic = [];
  const pending = [];
  const put = (m, p = m) => {
    masked += m;
    plain += p;
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      const pair = src.slice(i, i + 2);
      put(c + "\0".repeat(pair.length - 1), pair);
      i += 2;
      continue;
    }
    if (src.startsWith("<<", i) && src[i + 2] !== "<") {
      const h = /^<<(-?)[ \t]*(['"]?)([\w.-]+)\2/.exec(src.slice(i));
      if (h) {
        pending.push({
          delim: h[3],
          strip: !!h[1],
          quoted: !!h[2],
          before: masked.slice(masked.lastIndexOf("\n") + 1),
        });
        put(h[0]);
        i += h[0].length;
        continue;
      }
    }
    // Arithmetic, $((a > b)) or ((a > b)): no redirections inside. Only text
    // that is really arithmetic is masked; its $(...) still run (innerCommands).
    if (src.startsWith("((", i)) {
      let depth = 2;
      let j = i + 2;
      for (; j < src.length && depth; j++)
        depth += src[j] === "(" ? 1 : src[j] === ")" ? -1 : 0;
      if (!depth && isArithmetic(src.slice(i + 2, j - 2))) {
        const inner = src.slice(i + 2, j - 2);
        arithmetic.push(inner);
        put(`((${"\0".repeat(inner.length)}))`, src.slice(i, j));
        i = j;
        continue;
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c)
        j += c === '"' && src[j] === "\\" ? 2 : 1;
      const text = src.slice(i + 1, j);
      if (SIMPLE_WORD.test(text)) put(text);
      else {
        strings.push({ text, double: c === '"', before: masked });
        const close = j < src.length ? c : "";
        put(c + "\0".repeat(text.length) + close, c + text + close);
      }
      i = j + 1;
      continue;
    }
    if (c === "\n" && pending.length) {
      put("\n");
      i++;
      pending.forEach((h, k) => {
        if (k > 0 && src[i] === "\n") {
          put("\n");
          i++;
        }
        let text = "";
        while (i < src.length) {
          let e = src.indexOf("\n", i);
          if (e < 0) e = src.length;
          const line = src.slice(i, e);
          if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) {
            put("\0".repeat(line.length), line);
            i = e;
            break;
          }
          const take = src.slice(i, e + 1);
          text += take;
          put("\0".repeat(take.length), take);
          i += take.length;
        }
        heredocs.push({ ...h, text });
      });
      pending.length = 0;
      continue;
    }
    put(c);
    i++;
  }
  return { masked: maskTests(masked), plain, strings, heredocs, arithmetic };
}

/** True for the body of (( )) that is arithmetic and not commands. */
function isArithmetic(text) {
  const bare = text.replace(
    /\$\((?:[^()]|\([^()]*\))*\)|`[^`]*`|\$\{[^}]*\}/g,
    "0",
  );
  return (
    /^[\w\s$+\-*/%<>=!&|^~?:,()[\]#]*$/.test(bare) &&
    !/[A-Za-z_]\w*\s+[A-Za-z_]/.test(bare)
  );
}

/**
 * Masks `<` and `>` of a `[[ ... ]]` test in command position, up to its `]]`
 * in the same simple command, outside $(...). Anything else stays as it is.
 */
function maskTests(masked) {
  const out = masked.split("");
  for (const m of masked.matchAll(TEST_START)) {
    const hide = [];
    let depth = 0;
    for (let j = m.index + m[0].length; j < masked.length; j++) {
      const c = masked[j];
      if (c === "\n" || c === ";") break;
      if (c === "&" || c === "|") {
        if (masked[j + 1] !== c) break; // & or | end the command; && and || do not
        j++;
        continue;
      }
      if (masked.startsWith("$(", j) || c === "`") break; // substitution: keep it all
      if (c === "(") depth++;
      if (c === ")" && --depth < 0) break;
      if (
        masked.startsWith("]]", j) &&
        /\s/.test(masked[j - 1]) &&
        /^($|[\s;&|)])/.test(masked.slice(j + 2, j + 3))
      ) {
        for (const k of hide) out[k] = "\0";
        break;
      }
      if ((c === "<" || c === ">") && depth === 0) hide.push(j);
    }
  }
  return out.join("");
}

/** Command substitutions ($(...) and backticks) inside a text. */
function substitutions(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "`") {
      const j = text.indexOf("`", i + 1);
      if (j < 0) break;
      out.push(text.slice(i + 1, j));
      i = j;
    } else if (text.startsWith("$(", i) && text[i + 2] !== "(") {
      let depth = 1;
      let j = i + 2;
      for (; j < text.length && depth; j++)
        depth += text[j] === "(" ? 1 : text[j] === ")" ? -1 : 0;
      out.push(text.slice(i + 2, depth ? j : j - 1));
      i = j - 1;
    }
  }
  return out;
}

/** Quoted or heredoc text that the shell will run as commands. */
function innerCommands({ strings, heredocs, arithmetic }) {
  const inner = arithmetic.flatMap(substitutions);
  for (const s of strings) {
    if (SHELL_BEFORE.test(s.before)) inner.push(s.text);
    else if (s.double) inner.push(...substitutions(s.text));
  }
  for (const h of heredocs) {
    if (SHELL_BEFORE.test(h.before)) inner.push(h.text);
    else if (!h.quoted) inner.push(...substitutions(h.text));
  }
  return inner;
}

/** One shell word starting at `i`, with quotes removed. */
function readWord(s, i) {
  while (s[i] === " " || s[i] === "\t") i++;
  let word = "";
  for (; i < s.length; i++) {
    const c = s[i];
    if (/[\s;&|()<>]/.test(c)) break;
    if (c === "\\") {
      word += s[++i] ?? "";
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== c) {
        if (c === '"' && s[j] === "\\") j++;
        word += s[j] ?? "";
        j++;
      }
      i = j;
      continue;
    }
    word += c;
  }
  return { word, end: i };
}

/** Absolute path of a target, or null when it cannot be known (variables). */
function resolveTarget(word, cwd, vars = {}) {
  let w = word;
  if (w === "~" || w.startsWith("~/")) w = os.homedir() + w.slice(1);
  w = w.replace(TEMP_VAR, (_, name, colon, fallback, bare) => {
    const key = name || bare;
    // Assigned, exported or unset in the same command: that wins over the
    // hook's environment (null = unset). Otherwise the inherited value.
    const own = Object.hasOwn(vars, key);
    const value = own ? (vars[key] ?? undefined) : process.env[key];
    if (fallback === undefined) {
      if (own) return value ?? "$unset";
      return value || os.tmpdir();
    }
    // Without the colon the default applies only when the variable is unset.
    return colon ? value || fallback : (value ?? fallback);
  });
  w = w.replace(/^\$(?:\{HOME\}|HOME\b)/, os.homedir());
  w = w.replace(/^\$(?:\{(\w+)\}|(\w+))/, (all, a, b) => vars[a || b] ?? all);
  if (/[$`*?]/.test(w)) return null;
  if (path.isAbsolute(w)) return w;
  return cwd ? path.resolve(cwd, w) : null;
}

/** True when writing to `word` would change a file inside a git repository. */
function isRepoFile(word, cwd, vars) {
  if (!word || word === "-" || word.startsWith("/dev/")) return false;
  const abs = resolveTarget(word, cwd, vars);
  if (!abs) return true; // unknown target: only temp variables are allowed
  if (abs.startsWith("/dev/")) return false;
  return !!relativeToRepo(abs, cwd).root;
}

/** First repository file written by a redirection or by tee, if any. */
function redirectTarget(masked, plain, cwd) {
  // Variables assigned in the same command (S=/tmp/x, out=$(mktemp)) and cd
  // steps, in order, so that a target is resolved as the shell would.
  const steps = [];
  for (const m of masked.matchAll(ASSIGN)) {
    const at = m.index + m[0].length;
    steps.push({ at, name: m[1] });
  }
  for (const m of masked.matchAll(CD))
    steps.push({ at: m.index + m[0].length, cd: true });
  for (const m of masked.matchAll(UNSET)) {
    const names = m[1].split(/\s+/).filter((n) => n && !n.startsWith("-"));
    steps.push({ at: m.index + m[0].length, unset: names });
  }
  steps.sort((a, b) => a.at - b.at);
  const states = [];
  let dir = cwd;
  let vars = {};
  for (const s of steps) {
    if (s.cd) {
      const { word } = readWord(plain, s.at);
      dir = !word
        ? os.homedir()
        : word === "-"
          ? null
          : resolveTarget(word, dir, vars);
    } else if (s.unset) {
      vars = { ...vars, ...Object.fromEntries(s.unset.map((n) => [n, null])) };
    } else {
      const { word } = readWord(plain, s.at);
      const value = plain.startsWith("$(mktemp", s.at)
        ? path.join(os.tmpdir(), "mktemp")
        : word === ""
          ? ""
          : resolveTarget(word, dir, vars);
      vars = { ...vars, [s.name]: value ?? "$unknown" };
    }
    states.push({ at: s.at, dir, vars });
  }
  const stateAt = (pos) => {
    let st = { dir: cwd, vars: {} };
    for (const x of states) if (x.at < pos) st = x;
    return st;
  };
  const writes = (word, pos) => {
    const st = stateAt(pos);
    return isRepoFile(word, st.dir, st.vars);
  };
  for (const m of masked.matchAll(REDIRECT)) {
    const { word } = readWord(plain, m.index + m[0].length);
    if (writes(word, m.index)) return word;
  }
  for (const m of masked.matchAll(TEE)) {
    let at = m.index + m[0].length;
    for (;;) {
      while (plain[at] === " " || plain[at] === "\t") at++;
      // A redirection among the arguments (tee >/dev/null file): skip it and
      // its target, checked by the loop above, and keep reading tee's files.
      const op = REDIRECT_OP.exec(masked.slice(at));
      if (op && /[<>]/.test(op[0])) {
        at += op[0].length;
        if (!op[1]) at = readWord(plain, at).end;
        continue;
      }
      if (at >= plain.length || /[;&|()\n]/.test(plain[at])) break;
      const { word, end } = readWord(plain, at);
      if (end === at) break;
      at = end;
      if (!word.startsWith("-") && writes(word, m.index)) return word;
    }
  }
  return null;
}

/** Reason to block when the command edits files from the shell, else null. */
function shellEdit(command, cwd, depth = 0) {
  const parsed = scan(command);
  if (IN_PLACE.some((re) => re.test(parsed.masked))) return EDIT_ONLY;
  const target = redirectTarget(parsed.masked, parsed.plain, cwd);
  if (target)
    return `${EDIT_ONLY} Redirezioni e tee verso file del repository sono vietate (qui: ${target}); restano permesse verso la cartella temporanea, lo scratchpad e /dev/null.`;
  if (depth >= 3) return null;
  for (const inner of innerCommands(parsed)) {
    const reason = shellEdit(inner, cwd, depth + 1);
    if (reason) return reason;
  }
  return null;
}

const shellEditReason = shellEdit(cmd, input.cwd || process.cwd());
if (shellEditReason) block(`${shellEditReason}\nComando: ${cmd.slice(0, 300)}`);

// Commits are never made on main.
if (
  /\bgit\s+commit\b/.test(cmd) &&
  (branch === "main" || branch === "master") &&
  !/\bgit\s+(switch|checkout)\b/.test(cmd)
) {
  block("sei su main: crea un branch di lavoro prima di fare commit.");
}

// Database commands that change the local schema belong to the data architect.
if (
  (/\bsupabase\s+(migration\s+new|db\s+reset|db\s+diff|gen\s+types)\b/.test(
    cmd,
  ) ||
    /\bnpm\s+run\s+db:types\b/.test(cmd)) &&
  agent &&
  agent !== "architetto-dati"
) {
  block("migrazioni e tipi del database li gestisce solo l'architetto dati.");
}

// Any other Supabase project reference is forbidden.
for (const m of cmd.matchAll(/\b([a-z]{20})\.supabase\.(co|com)\b/g)) {
  if (m[1] !== ALLOWED_SUPABASE_REF)
    block(
      `riferimento a un progetto Supabase diverso da ${ALLOWED_SUPABASE_REF}.`,
    );
}
if (/jjvnygockahhcrnkfped/.test(cmd))
  block(
    "il progetto Supabase condiviso con PartyNest e NiniPlan è fuori limite.",
  );

process.exit(0);
