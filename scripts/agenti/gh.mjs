#!/usr/bin/env node
// GitHub helper for the FamilyNest agents.
// Claude Code sessions cannot use GitHub GraphQL, so most `gh issue` / `gh pr`
// commands fail there. This script offers the same operations through the REST API
// (`gh api`). It deliberately has no merge, approve or delete commands.
//
// Usage: node scripts/agenti/gh.mjs <command> [options]   (run with no command for help)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const HELP = `Comandi:
  issues [--state open|closed|all] [--label L]     elenco issue (senza PR)
  issue <n>                                         dettaglio issue con commenti
  issue-create --title T --body-file F [--labels a,b]
  issue-body <n> --body-file F                      sostituisce il corpo (F = - per stdin)
  labels <n> [--add a,b] [--remove c,d]             etichette di issue o PR
  comment <n> --body-file F                         commento su issue o PR
  close <n>                                         chiude una issue (non le PR)
  prs [--state open|closed|all]                     elenco PR
  pr <n>                                            dettaglio PR: corpo, file, commenti, controlli
  pr-diff <n>                                       diff completo della PR
  pr-checks <n> [--watch]                           stato dei controlli CI (exit 1 se qualcosa fallisce)
  pr-create --head B --title T --body-file F        apre una PR verso main
  pr-body <n> --body-file F                         sostituisce la descrizione della PR`;

function repo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
    }).trim();
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+?)(\.git)?$/);
    if (m) return m[1];
  } catch {}
  return "fdangelo-8/familynest-web";
}
const R = `repos/${repo()}`;

function call(path, { method = "GET", body, accept } = {}) {
  const args = ["api", path, "-X", method];
  if (accept) args.push("-H", `Accept: ${accept}`);
  if (body !== undefined) args.push("--input", "-");
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      input: body !== undefined ? JSON.stringify(body) : undefined,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    const err = new Error(
      String(e.stderr || e.message)
        .trim()
        .split("\n")[0],
    );
    err.status = /HTTP (\d+)/.exec(String(e.stderr))?.[1];
    throw err;
  }
}

// The session proxy rejects GitHub's own "next page" links (they use numeric repository ids),
// so pagination is done by hand with ?page=N.
function api(path, { method = "GET", body, accept, paginate = false } = {}) {
  if (!paginate) {
    const out = call(path, { method, body, accept });
    if (accept && !accept.includes("json")) return out;
    return out.trim() ? JSON.parse(out) : null;
  }
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const chunk = JSON.parse(call(`${path}${sep}page=${page}`) || "[]");
    all.push(...chunk);
    if (chunk.length < 100) break;
  }
  return all;
}

function opts(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) o[k] = true;
      else {
        o[k] = next;
        i++;
      }
    } else o._.push(a);
  }
  return o;
}
const list = (v) =>
  typeof v === "string" && v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
const readBody = (f) => {
  if (!f || f === true)
    fail("serve --body-file <file> (o - per leggere da stdin)");
  return readFileSync(f === "-" ? 0 : f, "utf8");
};
const num = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) fail("serve il numero di issue o PR");
  return n;
};
function fail(msg) {
  process.stderr.write(`Errore: ${msg}\n\n${HELP}\n`);
  process.exit(2);
}
const labelsOf = (x) => (x.labels ?? []).map((l) => l.name).join(", ");
const day = (d) => (d ? d.replace("T", " ").slice(0, 16) : "");

function comments(n) {
  return api(`${R}/issues/${n}/comments?per_page=100`, { paginate: true })
    .map((c) => `--- ${c.user?.login} · ${day(c.created_at)}\n${c.body ?? ""}`)
    .join("\n\n");
}

function checks(sha) {
  const runs =
    api(`${R}/commits/${sha}/check-runs?per_page=100`).check_runs ?? [];
  // Keep only the latest run for each check name.
  const latest = new Map();
  for (const r of runs) {
    const prev = latest.get(r.name);
    if (!prev || new Date(r.started_at) > new Date(prev.started_at))
      latest.set(r.name, r);
  }
  return [...latest.values()].map((r) => ({
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    url: r.html_url,
  }));
}
const OK = new Set(["success", "skipped", "neutral"]);

process.stdout.on("error", (e) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});
process.on("uncaughtException", (e) => {
  process.stderr.write(`Errore GitHub: ${e.message}\n`);
  process.exit(1);
});

const [cmd, ...rest] = process.argv.slice(2);
const o = opts(rest);

switch (cmd) {
  case "issues": {
    const q = new URLSearchParams({
      state: o.state || "open",
      per_page: "100",
    });
    if (o.label) q.set("labels", o.label);
    const items = api(`${R}/issues?${q}`, { paginate: true }).filter(
      (i) => !i.pull_request,
    );
    for (const i of items)
      console.log(
        `#${i.number}\t${i.state}\t[${labelsOf(i)}]\t${i.title}\t(agg. ${day(i.updated_at)})`,
      );
    if (!items.length) console.log("Nessuna issue.");
    break;
  }
  case "issue": {
    const n = num(o._[0]);
    const i = api(`${R}/issues/${n}`);
    console.log(
      `#${i.number} ${i.title}\nStato: ${i.state} · Etichette: [${labelsOf(i)}] · Aggiornata: ${day(i.updated_at)}\n\n${i.body ?? ""}\n\n=== Commenti ===\n${comments(n) || "Nessuno."}`,
    );
    break;
  }
  case "issue-create": {
    if (!o.title || o.title === true) fail("serve --title");
    const i = api(`${R}/issues`, {
      method: "POST",
      body: {
        title: o.title,
        body: readBody(o["body-file"]),
        labels: list(o.labels),
      },
    });
    console.log(`#${i.number} ${i.html_url}`);
    break;
  }
  case "issue-body":
  case "pr-body": {
    const n = num(o._[0]);
    const path = cmd === "pr-body" ? `${R}/pulls/${n}` : `${R}/issues/${n}`;
    api(path, { method: "PATCH", body: { body: readBody(o["body-file"]) } });
    console.log(`#${n} aggiornata.`);
    break;
  }
  case "labels": {
    const n = num(o._[0]);
    const add = list(o.add);
    if (add.length)
      api(`${R}/issues/${n}/labels`, { method: "POST", body: { labels: add } });
    for (const l of list(o.remove)) {
      try {
        api(`${R}/issues/${n}/labels/${encodeURIComponent(l)}`, {
          method: "DELETE",
        });
      } catch {
        /* label not present */
      }
    }
    console.log(`#${n} etichette: [${labelsOf(api(`${R}/issues/${n}`))}]`);
    break;
  }
  case "comment": {
    const n = num(o._[0]);
    const c = api(`${R}/issues/${n}/comments`, {
      method: "POST",
      body: { body: readBody(o["body-file"]) },
    });
    console.log(c.html_url);
    break;
  }
  case "close": {
    const n = num(o._[0]);
    const i = api(`${R}/issues/${n}`);
    if (i.pull_request)
      fail("le PR non si chiudono: le chiude il merge di Francesco");
    api(`${R}/issues/${n}`, { method: "PATCH", body: { state: "closed" } });
    console.log(`#${n} chiusa.`);
    break;
  }
  case "prs": {
    const state = o.state || "open";
    const prs = api(
      `${R}/pulls?state=${state}&per_page=100&sort=updated&direction=desc`,
      { paginate: true },
    );
    for (const p of prs) {
      const st = p.merged_at ? `unita ${day(p.merged_at)}` : p.state;
      console.log(
        `#${p.number}\t${st}\t${p.head.ref}\t[${labelsOf(p)}]\t${p.title}`,
      );
    }
    if (!prs.length) console.log("Nessuna PR.");
    break;
  }
  case "pr": {
    const n = num(o._[0]);
    const p = api(`${R}/pulls/${n}`);
    const files = api(`${R}/pulls/${n}/files?per_page=100`, {
      paginate: true,
    }).map(
      (f) => `${f.status}\t+${f.additions} -${f.deletions}\t${f.filename}`,
    );
    const cs = checks(p.head.sha)
      .map((c) => `${c.name}: ${c.conclusion ?? c.status}`)
      .join(" · ");
    const reviews = api(`${R}/pulls/${n}/comments?per_page=100`, {
      paginate: true,
    }).map(
      (c) => `--- ${c.user?.login} su ${c.path}:${c.line ?? ""}\n${c.body}`,
    );
    console.log(
      `#${p.number} ${p.title}\nBranch: ${p.head.ref} → ${p.base.ref} · Stato: ${p.merged_at ? "unita" : p.state} · Mergeable: ${p.mergeable_state}\nEtichette: [${labelsOf(p)}]\nControlli: ${cs || "nessuno ancora"}\n\n${p.body ?? ""}\n\n=== File (${files.length}) ===\n${files.join("\n")}\n\n=== Commenti ===\n${comments(n) || "Nessuno."}${reviews.length ? `\n\n=== Commenti sul codice ===\n${reviews.join("\n\n")}` : ""}`,
    );
    break;
  }
  case "pr-diff": {
    process.stdout.write(
      api(`${R}/pulls/${num(o._[0])}`, {
        accept: "application/vnd.github.diff",
      }),
    );
    break;
  }
  case "pr-checks": {
    const n = num(o._[0]);
    const deadline = Date.now() + 45 * 60 * 1000;
    let cs;
    for (;;) {
      const sha = api(`${R}/pulls/${n}`).head.sha;
      cs = checks(sha);
      const pending =
        cs.length === 0 || cs.some((c) => c.status !== "completed");
      if (!o.watch || !pending || Date.now() > deadline) break;
      execFileSync("sleep", ["30"]);
    }
    for (const c of cs)
      console.log(`${c.name}\t${c.conclusion ?? c.status}\t${c.url}`);
    if (!cs.length) console.log("Nessun controllo ancora avviato.");
    const failed = cs.filter(
      (c) => c.status === "completed" && !OK.has(c.conclusion),
    );
    const pending = cs.filter((c) => c.status !== "completed");
    console.log(
      failed.length
        ? `ESITO: FALLITO (${failed.map((c) => c.name).join(", ")})`
        : pending.length || !cs.length
          ? "ESITO: IN CORSO"
          : "ESITO: TUTTO VERDE",
    );
    process.exit(failed.length ? 1 : pending.length || !cs.length ? 3 : 0);
  }
  case "pr-create": {
    if (!o.head || o.head === true || !o.title || o.title === true)
      fail("servono --head e --title");
    if (o.head === "main") fail("non si apre una PR da main");
    const p = api(`${R}/pulls`, {
      method: "POST",
      body: {
        head: o.head,
        base: "main",
        title: o.title,
        body: readBody(o["body-file"]),
      },
    });
    console.log(`#${p.number} ${p.html_url}`);
    break;
  }
  default:
    console.log(HELP);
    process.exit(cmd ? 2 : 0);
}
