// Shared helpers for FamilyNest hooks. No dependencies: Node built-ins only.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** Repository root and current branch for a directory (worktree-aware). */
export function repoInfo(dir) {
  const root = git(['rev-parse', '--show-toplevel'], dir);
  const branch = root ? git(['rev-parse', '--abbrev-ref', 'HEAD'], root) : '';
  return { root, branch };
}

/** Path of a file relative to its repository root, with forward slashes. */
export function relativeToRepo(filePath, cwd) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd || process.cwd(), filePath);
  let dir = path.dirname(abs);
  // The file may not exist yet: climb to the nearest existing directory.
  for (let i = 0; i < 50; i++) {
    const { root } = repoInfo(dir);
    if (root) return { root, rel: path.relative(root, abs).split(path.sep).join('/') };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { root: '', rel: abs };
}

export function block(reason) {
  process.stderr.write(
    `BLOCCATO dalla regola di progetto: ${reason}\n` +
      'Se pensi che serva davvero, non aggirare il blocco: fermati e scrivi una domanda nella issue (esito BLOCCATO).\n',
  );
  process.exit(2);
}
