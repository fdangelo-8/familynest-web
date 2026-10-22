#!/usr/bin/env node
// Self-test for the FamilyNest hooks. Creates a throwaway git repo and checks
// that each rule blocks or allows as expected. Run: node .claude/hooks/test-hooks.mjs
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = mkdtempSync(path.join(tmpdir(), "fn-hooks-"));
const g = (...a) => execFileSync("git", a, { cwd: repo, stdio: "ignore" });
g("init", "-q", "-b", "main");
g("config", "user.email", "t@t");
g("config", "user.name", "t");
mkdirSync(path.join(repo, "src"), { recursive: true });
writeFileSync(path.join(repo, "README.md"), "x");
g("add", ".");
g("commit", "-qm", "init");
const on = (b) => g("switch", "-q", "-C", b);

let fail = 0,
  n = 0;
function run(hook, input) {
  const r = spawnSync("node", [path.join(here, hook)], {
    input: JSON.stringify({ cwd: repo, ...input }),
    encoding: "utf8",
  });
  return r.status;
}
function expect(label, hook, input, blocked) {
  n++;
  const status = run(hook, input);
  const ok = blocked ? status === 2 : status === 0;
  if (!ok) {
    fail++;
    console.log(`FAIL  ${label} (exit ${status}, atteso ${blocked ? 2 : 0})`);
  }
}
const bash = (command, agent) => ({
  tool_name: "Bash",
  tool_input: { command },
  ...(agent ? { agent_type: agent } : {}),
});
const write = (file, agent) => ({
  tool_name: "Write",
  tool_input: { file_path: path.join(repo, file), content: "x" },
  ...(agent ? { agent_type: agent } : {}),
});

// ---------- Bash ----------
on("feat/calendario");
const B = "guard-bash.mjs";
expect("push su main", B, bash("git push origin main"), true);
expect("push HEAD:main", B, bash("git push origin HEAD:main"), true);
expect("push force", B, bash("git push --force origin feat/calendario"), true);
expect("push -f", B, bash("git push -f"), true);
expect("push delete", B, bash("git push origin --delete feat/x"), true);
expect("push :branch", B, bash("git push origin :feat/x"), true);
expect("push branch ok", B, bash("git push -u origin feat/calendario"), false);
expect(
  "push force-with-lease ok",
  B,
  bash("git push --force-with-lease origin feat/calendario"),
  false,
);
expect(
  "push branch main-like name ok",
  B,
  bash("git push origin feat/main-menu"),
  false,
);
expect("gh pr merge", B, bash("gh pr merge 3 --squash"), true);
expect("gh approve", B, bash("gh pr review 3 --approve"), true);
expect(
  "gh pr comment rimandato allo script",
  B,
  bash('gh pr comment 3 --body "APPROVATA"'),
  true,
);
expect(
  "gh issue list rimandato allo script",
  B,
  bash("gh issue list --label stato"),
  true,
);
expect("gh dentro una pipeline", B, bash("echo x | gh pr view 3"), true);
expect(
  "script gh ok",
  B,
  bash("node scripts/agenti/gh.mjs comment 3 --body-file -"),
  false,
);
expect(
  "script labels ok",
  B,
  bash(
    "node scripts/agenti/gh.mjs labels 4 --add in-test --remove in-revisione",
  ),
  false,
);
expect(
  "gh run ok",
  B,
  bash("gh run list --workflow visual-baseline.yml --limit 1"),
  false,
);
expect(
  "scrive lo script via shell",
  B,
  bash("echo x > scripts/agenti/gh.mjs"),
  true,
);
expect("gh secret", B, bash("gh secret set X"), true);
expect(
  "gh api protection",
  B,
  bash("gh api repos/o/r/branches/main/protection"),
  true,
);
expect(
  "gh issue edit rimandato allo script",
  B,
  bash("gh issue edit 4 --add-label in-test --remove-label in-revisione"),
  true,
);
expect(
  "gh workflow run ok",
  B,
  bash("gh workflow run visual-baseline.yml --ref feat/calendario"),
  false,
);
expect("supabase login", B, bash("npx supabase login"), true);
expect("supabase db push", B, bash("npx supabase db push"), true);
expect(
  "supabase link",
  B,
  bash("npx supabase link --project-ref yksosqvugiempsldejyt"),
  true,
);
expect("supabase start ok", B, bash("npx supabase start"), false);
expect("supabase test db ok", B, bash("npx supabase test db"), false);
expect(
  "migration new da sviluppatore",
  B,
  bash("npx supabase migration new x", "sviluppatore"),
  true,
);
expect(
  "migration new da architetto ok",
  B,
  bash("npx supabase migration new x", "architetto-dati"),
  false,
);
expect(
  "db:types da sviluppatore",
  B,
  bash("npm run db:types:local", "sviluppatore"),
  true,
);
expect(
  "db:types da architetto ok",
  B,
  bash("npm run db:types:local", "architetto-dati"),
  false,
);
expect(
  "altro progetto supabase",
  B,
  bash("curl https://abcdefghijabcdefghij.supabase.co/rest/v1/x"),
  true,
);
expect("progetto condiviso", B, bash("echo jjvnygockahhcrnkfped"), true);
expect(
  "progetto giusto ok",
  B,
  bash("curl -s https://yksosqvugiempsldejyt.supabase.co/auth/v1/health"),
  false,
);
expect("cat .env.local", B, bash("cat .env.local"), true);
expect("cat .env", B, bash("cat .env"), true);
expect("cat .env.example ok", B, bash("cat .env.example"), false);
expect("grep process.env ok", B, bash('grep -rn "process.env" src'), false);
expect("printenv", B, bash("printenv"), true);
expect("env | grep", B, bash("env | grep SUPA"), true);
expect("echo secret", B, bash("echo $SUPABASE_SECRET_KEY"), true);
expect("npm run ok", B, bash("npm run check"), false);
expect("set -e ok", B, bash("set -euo pipefail; npm test"), false);
expect("rm -rf /", B, bash("rm -rf /"), true);
expect("rm -rf .", B, bash("rm -rf ."), true);
expect("rm -rf node_modules ok", B, bash("rm -rf node_modules .next"), false);
expect("rm migrazioni", B, bash("rm supabase/migrations/001.sql"), true);
expect("rm screenshots", B, bash("rm -r tests/visual/__screenshots__"), true);
expect("git clean -fdx", B, bash("git clean -fdx"), true);
expect(
  "reset hard origin branch ok",
  B,
  bash("git reset --hard origin/feat/calendario"),
  false,
);
expect("--no-verify", B, bash("git commit --no-verify -m x"), true);
expect(
  "scrive settings via shell",
  B,
  bash("echo {} > .claude/settings.json"),
  true,
);
expect(
  "sed workflow",
  B,
  bash("sed -i 's/a/b/' .github/workflows/ci.yml"),
  true,
);
expect(
  "scrive migrazione via shell",
  B,
  bash("cat > supabase/migrations/x.sql <<EOF"),
  true,
);
expect("sudo", B, bash("sudo apt install x"), true);
on("main");
expect("commit su main", B, bash("git commit -m x"), true);
expect(
  "switch poi commit ok",
  B,
  bash("git switch -c feat/x && git commit -m x"),
  false,
);
on("admin/manutenzione");
expect(
  "admin: scrive settings via shell ok",
  B,
  bash("cp settings.json .claude/settings.json"),
  false,
);
expect(
  "admin ma subagente",
  B,
  bash("cp a .claude/settings.json", "sviluppatore"),
  true,
);
expect(
  "admin: push main ancora vietato",
  B,
  bash("git push origin main"),
  true,
);

// ---------- File ----------
const F = "guard-files.mjs";
on("main");
expect("scrittura su main", F, write("src/app/page.tsx"), true);
on("feat/calendario");
expect(
  "pagina su feat ok",
  F,
  write("src/app/(app)/calendario/page.tsx", "sviluppatore"),
  false,
);
expect(".env", F, write(".env.local", "sviluppatore"), true);
expect(".env.example ok", F, write(".env.example"), false);
expect(
  "migrazione da sviluppatore",
  F,
  write("supabase/migrations/1_x.sql", "sviluppatore"),
  true,
);
expect(
  "tipi db da sviluppatore",
  F,
  write("src/types/database.ts", "sviluppatore"),
  true,
);
expect(
  "globals.css su feat",
  F,
  write("src/app/globals.css", "sviluppatore"),
  true,
);
expect(
  "components/ui su feat",
  F,
  write("src/components/ui/Button/Button.tsx", "sviluppatore"),
  true,
);
expect("package.json su feat", F, write("package.json", "sviluppatore"), true);
expect(
  "componente pagina ok",
  F,
  write("src/components/calendario/Week.tsx", "sviluppatore"),
  false,
);
expect(
  "agents da sessione principale non admin",
  F,
  write(".claude/agents/x.md"),
  true,
);
expect("workflow su feat", F, write(".github/workflows/ci.yml"), true);
expect("CLAUDE.md su feat", F, write("CLAUDE.md"), true);
expect(
  "script agenti su feat",
  F,
  write("scripts/agenti/gh.mjs", "sviluppatore"),
  true,
);
expect(
  "seed su db da architetto ok",
  F,
  write("scripts/seed-test-users.ts", "architetto-dati"),
  false,
);
expect("revisore scrive", F, write("src/app/x.ts", "revisore"), true);
expect("revisore scrive docs", F, write("docs/x.md", "revisore"), true);
expect("analista docs ok", F, write("docs/agenti/x.md", "analista"), false);
expect("analista src", F, write("src/x.ts", "analista"), true);
expect(
  "tester funzionale test ok",
  F,
  write("tests/e2e/calendario.spec.ts", "tester-funzionale"),
  false,
);
expect(
  "tester funzionale src",
  F,
  write("src/app/x.tsx", "tester-funzionale"),
  true,
);
expect(
  "tester funzionale screenshot",
  F,
  write("tests/visual/__screenshots__/a.png", "tester-funzionale"),
  true,
);
expect(
  "tester visivo screenshot ok",
  F,
  write("tests/visual/__screenshots__/a.png", "tester-visivo"),
  false,
);
expect(
  "sviluppatore screenshot",
  F,
  write("tests/visual/__screenshots__/a.png", "sviluppatore"),
  true,
);
expect(
  "designer skill ok",
  F,
  write(".claude/skills/design-system/SKILL.md", "designer"),
  false,
);
expect("designer src", F, write("src/app/globals.css", "designer"), true);
expect(
  "documentalista docs ok",
  F,
  write("docs/agenti/LEZIONI.md", "documentalista"),
  false,
);
expect(
  "fuori dal repo ok",
  F,
  {
    tool_name: "Write",
    tool_input: { file_path: path.join(tmpdir(), "esito.md") },
    agent_type: "revisore",
  },
  false,
);
on("lavoro/shared/design-system");
expect(
  "globals.css su lavoro/shared ok",
  F,
  write("src/app/globals.css", "sviluppatore"),
  false,
);
on("shared/design-system");
expect(
  "globals.css su shared ok",
  F,
  write("src/app/globals.css", "sviluppatore"),
  false,
);
expect(
  "package.json su shared ok",
  F,
  write("package.json", "sviluppatore"),
  false,
);
expect(
  "migrazione su shared",
  F,
  write("supabase/migrations/1_x.sql", "sviluppatore"),
  true,
);
on("db/households");
expect(
  "migrazione architetto su db ok",
  F,
  write("supabase/migrations/1_x.sql", "architetto-dati"),
  false,
);
expect(
  "tipi architetto su db ok",
  F,
  write("src/types/database.ts", "architetto-dati"),
  false,
);
expect(
  "migrazione sviluppatore su db",
  F,
  write("supabase/migrations/1_x.sql", "sviluppatore"),
  true,
);
on("feat/x");
expect(
  "migrazione architetto su feat",
  F,
  write("supabase/migrations/1_x.sql", "architetto-dati"),
  true,
);
on("admin/setup-squadra");
expect("admin: agents ok", F, write(".claude/agents/x.md"), false);
expect("admin: script agenti ok", F, write("scripts/agenti/gh.mjs"), false);
expect("admin: workflow ok", F, write(".github/workflows/ci.yml"), false);
expect(
  "admin: subagente su config",
  F,
  write(".claude/agents/x.md", "sviluppatore"),
  true,
);
expect("admin: .env ancora vietato", F, write(".env"), true);

console.log(`\n${n - fail}/${n} controlli superati`);
process.exit(fail ? 1 : 0);
