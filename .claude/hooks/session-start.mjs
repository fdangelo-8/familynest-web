#!/usr/bin/env node
// SessionStart hook: prepares cloud sessions and reminds every session of the rules.
// Whatever this prints on stdout is added to the session context.
import { readInput, repoInfo } from './lib.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const input = readInput();
const { root, branch } = repoInfo(input.cwd || process.cwd());
if (!root) process.exit(0);

const notes = [];
if (process.env.CLAUDE_CODE_REMOTE && !existsSync(path.join(root, 'node_modules'))) {
  const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root, encoding: 'utf8', timeout: 600_000 });
  notes.push(r.status === 0 ? 'Dipendenze installate (npm ci).' : 'ATTENZIONE: npm ci non è riuscito, eseguilo prima di lavorare.');
}

notes.push(
  `Progetto FamilyNest Web. Branch attuale: ${branch || 'sconosciuto'}.`,
  'Prima di lavorare leggi docs/agenti/ARCHITETTURA.md e docs/agenti/LEZIONI.md.',
  'Mai lavorare su main, mai merge, mai segreti nei file. Database solo tramite architetto-dati su branch db/*.',
);
process.stdout.write(notes.join('\n') + '\n');
process.exit(0);
