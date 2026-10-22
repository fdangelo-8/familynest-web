#!/usr/bin/env node
// PreToolUse hook for Bash: blocks commands that break the team rules.
import { readInput, repoInfo, block } from './lib.mjs';

const ALLOWED_SUPABASE_REF = 'yksosqvugiempsldejyt';

const input = readInput();
const cmd = String(input?.tool_input?.command ?? '');
if (!cmd.trim()) process.exit(0);

const agent = String(input.agent_type ?? '');
const { branch } = repoInfo(input.cwd || process.cwd());
const admin = !agent && branch.startsWith('admin/');

/** [pattern, reason, allowedInAdminSession] */
const rules = [
  // Git: main is protected, history is never rewritten.
  [/\bgit\s+push\b[^;&|\n]*\s(\S+:)?(refs\/heads\/)?main(\s|$)/, 'push su main vietato: apri una PR.', false],
  [/\bgit\s+push\b[^;&|\n]*\s(--force(?!-with-lease)|-f)(\s|$)/, 'usa solo --force-with-lease e solo sul tuo branch.', false],
  [/\bgit\s+push\b[^;&|\n]*\s(--delete|--mirror|-d)(\s|$)/, 'cancellare o rispecchiare branch remoti è vietato.', false],
  [/\bgit\s+push\b[^;&|\n]*\s:\S+/, 'cancellare branch remoti è vietato.', false],
  [/\bgit\s+(filter-branch|filter-repo|replace)\b/, 'riscrivere la storia è vietato.', false],
  [/\bgit\s+config\b[^;&|\n]*core\.hooksPath/, 'non modificare gli hook di git.', false],
  [/--no-verify\b/, 'non saltare i controlli con --no-verify.', false],
  [/\bgit\s+update-ref\b[^;&|\n]*\brefs\/heads\/main\b/, 'non toccare main.', false],

  // GitHub: no merges, approvals, repository administration or secrets.
  [/\bgh\s+pr\s+merge\b/, 'il merge lo fa solo Francesco.', false],
  [/\bgh\s+pr\s+review\b[^;&|\n]*(--approve|-a)(\s|$)/, 'gli agenti non approvano PR: scrivi l\'esito come commento.', false],
  [/\bgh\s+(secret|variable|ruleset|auth\s+token|repo\s+(delete|edit|rename|archive|set-default))\b/, 'operazione riservata a Francesco.', false],
  [/\bgh\s+api\b[^;&|\n]*\/(merges?|secrets|protection|rulesets|collaborators|hooks|keys|environments)\b/, 'operazione GitHub riservata a Francesco.', false],
  [/\bgh\s+api\b[^;&|\n]*(-X|--method)\s*DELETE\b/, 'cancellazioni via API GitHub vietate.', false],
  [/\bgh\s+(issue|pr|release)\s+delete\b/, 'non si cancellano issue, PR o release.', false],
  [/\bgh\s+workflow\s+(disable|enable)\b/, 'non si disattivano i workflow.', false],

  // Supabase: only local development; remote changes happen in CI after merge.
  [/\bsupabase\s+(login|link|unlink|projects|orgs|secrets|branches|functions\s+deploy|db\s+(push|pull|dump|remote)|migration\s+(repair|up|fetch)|storage)\b/, 'operazioni Supabase remote vietate: le migrazioni le applica la CI dopo il merge.', false],
  [/\bsupabase\b[^;&|\n]*(--db-url|--project-ref|--project-id|--linked)\b/, 'niente connessioni al database remoto: lavora sul database locale.', false],
  [/\b(psql|pg_dump|pg_restore|pg_dumpall)\b[^;&|\n]*(supabase\.(co|com)|pooler\.)/, 'connessioni dirette al database remoto vietate.', false],
  [/\bSUPABASE_(ACCESS_TOKEN|DB_URL)\b/, 'non usare token o stringhe di connessione Supabase remote.', false],

  // Secrets: never print or move them.
  [/\b(cat|less|more|head|tail|bat|strings|grep|rg|sed|awk|cp|mv|scp|rsync|base64|xxd|od)\b[^;&|\n]*(^|[\s/'"=])\.env(\.[\w-]+)?(?<!\.example)(\s|$|['"])/, 'i file .env non si leggono né si copiano: le variabili sono già nell\'ambiente.', false],
  [/(^|[;&|]\s*)(printenv|env|export\s+-p|set)\s*($|[|;&>])/, 'non stampare tutte le variabili d\'ambiente.', false],
  [/\b(echo|printf|printenv)\b[^;&|\n]*\b(SUPABASE_SECRET_KEY|[A-Z_]*(TOKEN|SECRET|PASSWORD|PRIVATE)[A-Z_]*)\b/, 'non stampare segreti.', false],
  [/\b(curl|wget)\b[^;&|\n]*\$\{?[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/, 'non inviare segreti con curl o wget.', false],

  // Destructive filesystem operations.
  [/\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(-[a-zA-Z]+\s+)*(\/|~|\$HOME|\.|\.\/|\*|\.\/\*)(\s|$)/, 'cancellazione distruttiva vietata.', false],
  [/\brm\b[^;&|\n]*(\.git(\s|\/|$)|supabase\/migrations|tests\/visual\/__screenshots__|docs\/mockup)/, 'non cancellare storia git, migrazioni, mockup o screenshot di riferimento.', false],
  [/\bgit\s+(clean\s+-[a-zA-Z]*[fdx]|reset\s+--hard\s+(?!HEAD\b|origin\/(feat|shared|fix|db|docs|chore)\/))/, 'operazione git distruttiva: conserva il lavoro con un commit.', false],
  [/\bchmod\s+(-R\s+)?777\b/, 'permessi troppo aperti.', false],
  [/(^|[;&|]\s*)sudo\b/, 'sudo non consentito.', true],

  // Team configuration through the shell.
  [/(>{1,2}|\btee\b|\bsed\s+-i|\bcp\b|\bmv\b|\brm\b|\bln\b)[^;&|\n]*(\.claude\/(settings[\w.-]*\.json|hooks|agents|commands)|\.github\/|CLAUDE\.md)/, 'configurazione di agenti, hook e CI modificabile solo in una sessione di manutenzione su branch admin/*.', true],
  // Database files through the shell (bypassing the file guard).
  [/(>{1,2}|\btee\b|\bsed\s+-i|\bcp\b|\bmv\b|\bln\b)[^;&|\n]*(supabase\/(migrations|tests|seed)|src\/types\/database\.ts)/, 'i file del database si modificano solo con gli strumenti di modifica, dall\'architetto dati.', true],
];

for (const [re, reason, adminOk] of rules) {
  if (adminOk && admin) continue;
  if (re.test(cmd)) block(`${reason}\nComando: ${cmd.slice(0, 300)}`);
}

// Commits are never made on main.
if (/\bgit\s+commit\b/.test(cmd) && (branch === 'main' || branch === 'master') && !/\bgit\s+(switch|checkout)\b/.test(cmd)) {
  block('sei su main: crea un branch di lavoro prima di fare commit.');
}

// Database commands that change the local schema belong to the data architect.
if (/\bsupabase\s+(migration\s+new|db\s+reset|db\s+diff|gen\s+types)\b/.test(cmd) && agent && agent !== 'architetto-dati') {
  block('migrazioni e tipi del database li gestisce solo l\'architetto dati.');
}

// Any other Supabase project reference is forbidden.
for (const m of cmd.matchAll(/\b([a-z]{20})\.supabase\.(co|com)\b/g)) {
  if (m[1] !== ALLOWED_SUPABASE_REF) block(`riferimento a un progetto Supabase diverso da ${ALLOWED_SUPABASE_REF}.`);
}
if (/jjvnygockahhcrnkfped/.test(cmd)) block('il progetto Supabase condiviso con PartyNest e NiniPlan è fuori limite.');

process.exit(0);
