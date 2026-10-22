#!/usr/bin/env node
// PreToolUse hook for Edit|Write|MultiEdit|NotebookEdit.
// Enforces who may write which files, based on the subagent type and the git branch.
import { readInput, relativeToRepo, repoInfo, block } from './lib.mjs';

const input = readInput();
const ti = input.tool_input ?? {};
const target = ti.file_path ?? ti.notebook_path ?? ti.path;
if (!target) process.exit(0);

const agent = String(input.agent_type ?? ''); // empty = main session (coordinator or Francesco)
const { root, rel } = relativeToRepo(String(target), input.cwd);
if (!root) process.exit(0); // outside the repository (scratch files): not our business
// Local working copies of another agent's branch are named lavoro/<branch> (see skill flusso-git).
const branch = repoInfo(root).branch.replace(/^lavoro\//, '');

const is = (re) => re.test(rel);
const onBranch = (...prefixes) => prefixes.some((p) => branch.startsWith(p));

// 1. Secrets never live in files.
if (is(/(^|\/)\.env(?!\.example$)(\.|$)/)) block('i file .env non si scrivono: i segreti stanno solo nelle variabili d\'ambiente.');

// 2. Nothing is ever written on main.
if (branch === 'main' || branch === 'master') block(`sei sul branch ${branch}. Crea un branch di lavoro (vedi skill flusso-git) prima di modificare file.`);

// 3. Team configuration: only Francesco's maintenance sessions (main session on an admin/* branch).
if (is(/^(\.claude\/(settings[^/]*\.json|hooks\/|agents\/|commands\/)|\.github\/|CLAUDE\.md$)/)) {
  if (agent || !onBranch('admin/')) block('configurazione di agenti, hook e CI modificabile solo in una sessione di manutenzione su branch admin/*.');
}

// 4. Database: only the data architect, only on db/* branches.
if (is(/^(supabase\/|src\/types\/database\.ts$)/)) {
  const ok = (agent === 'architetto-dati' && onBranch('db/')) || (!agent && onBranch('admin/'));
  if (!ok) block('database, migrazioni e tipi generati li modifica solo l\'agente architetto-dati su un branch db/*. Apri una issue richiesta-db.');
}

// 5. Shared foundations: only on shared/* branches (or admin/*).
const shared = /^(src\/app\/globals\.css$|src\/app\/layout\.tsx$|src\/app\/\([^/]+\)\/layout\.tsx$|src\/components\/ui\/|src\/lib\/|package\.json$|package-lock\.json$|next\.config\.|tsconfig\.json$|playwright\.config\.|eslint\.config\.|\.prettierrc)/;
if (is(shared) && !onBranch('shared/', 'admin/')) {
  block('file condiviso (stili globali, layout, componenti ui, lib, dipendenze o configurazione). Si modifica solo su un branch shared/* assegnato dal coordinatore: chiedilo con una issue richiesta-condivisa.');
}

// 6. Role boundaries for read-mostly agents.
const roleRules = {
  revisore: [null, 'il revisore non modifica file: scrive l\'esito come commento sulla PR.'],
  analista: [/^docs\//, 'l\'analista scrive solo in docs/ (il requisito va nella issue).'],
  designer: [/^(docs\/|\.claude\/skills\/design-system\/)/, 'il designer scrive solo in docs/ e nella skill design-system.'],
  documentalista: [/^docs\//, 'il documentalista scrive solo in docs/.'],
  'tester-funzionale': [/^tests\/(?!visual\/__screenshots__\/)/, 'il tester funzionale scrive solo test in tests/ (non gli screenshot di riferimento).'],
  'tester-visivo': [/^tests\//, 'il tester visivo scrive solo in tests/.'],
};
const rule = roleRules[agent];
if (rule) {
  const [allowed, reason] = rule;
  if (!allowed || !allowed.test(rel)) block(reason);
}

// 7. Visual baselines belong to the visual tester.
if (is(/^tests\/visual\/__screenshots__\//) && agent && agent !== 'tester-visivo') {
  block('gli screenshot di riferimento li aggiorna solo il tester visivo.');
}

process.exit(0);
