#!/usr/bin/env node
// Stop / SubagentStop hook: before an agent declares its work finished,
// run the fast checks if it changed code. On failure, the agent is sent back to fix it.
import { readInput, repoInfo, git } from "./lib.mjs";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const input = readInput();
if (input.stop_hook_active) process.exit(0); // already sent back once: avoid loops

const { root } = repoInfo(input.cwd || process.cwd());
if (!root || !existsSync(path.join(root, "node_modules"))) process.exit(0);

// Code changed in this working copy (uncommitted) or committed but not yet on main?
const dirty = git(
  ["status", "--porcelain", "--", "src", "tests", "supabase"],
  root,
);
const ahead = git(
  ["diff", "--name-only", "origin/main...HEAD", "--", "src", "tests"],
  root,
);
if (!dirty && !ahead) process.exit(0);

const run = spawnSync("npm", ["run", "--silent", "check"], {
  cwd: root,
  encoding: "utf8",
  timeout: 240_000,
});
if (run.status === 0) process.exit(0);

const out = `${run.stdout ?? ""}\n${run.stderr ?? ""}`
  .trim()
  .split("\n")
  .slice(-60)
  .join("\n");
process.stderr.write(
  "Prima di chiudere: `npm run check` non passa. Correggi gli errori qui sotto, poi riesegui il controllo.\n" +
    "Se l'errore non dipende dal tuo lavoro, chiudi con esito BLOCCATO spiegando il motivo.\n\n" +
    out +
    "\n",
);
process.exit(2);
