# Archivio delle lezioni

Lezioni già imposte da un controllo automatico (hook, CI, script, test) o dalle istruzioni fisse degli agenti in `.claude/agents/`. Il controllo le fa rispettare, quindi non servono più a ricordarle a chi scrive codice. Restano qui per tracciare da dove viene ogni regola. Se un controllo cambia, si aggiorna questo file e, se serve, si riporta la lezione in `docs/agenti/LEZIONI.md`.

Le lezioni unite in una regola di `LEZIONI.md` durante la compattazione sono nel file precedente: `git show 9836c50:docs/agenti/LEZIONI.md`.

## Database e Supabase

- Test pgTAP in `supabase/tests/` scritti dal tester o dal coordinatore → li scrive solo l'architetto dati nel branch `db/*`, perché gli hook lo impongono; il tester funzionale indica i casi mancanti nella PR, senza scriverli.
  > Imposta da: `.claude/hooks/guard-files.mjs` (`supabase/` si modifica solo da `architetto-dati` su `db/*`) e `.claude/agents/architetto-dati.md`.
- PR di sola documentazione bloccate perché la verifica `db` non partiva mai → la verifica `db` parte sempre; se la PR tocca solo `docs/**` o `*.md` salta i passi del database e finisce verde.
  > Imposta da: `.github/workflows/db.yml`.

## Processo

- `gh issue …` e `gh pr …` falliscono con «GitHub GraphQL is not available» → usare `node scripts/agenti/gh.mjs`, che usa l'API REST.
  > Imposta da: `.claude/hooks/guard-bash.mjs` (blocca `gh issue`, `gh pr`, `gh label`, `gh project`) e la skill `flusso-git`.
- Due tester in parallelo sulla stessa PR condividono branch locale e indice git: un commit ha cancellato per errore gli spec dell'altro → ogni tester committa solo i propri file con pathspec esplicito, fa `git pull --no-rebase` prima del push e controlla `git show --stat` del proprio commit.
  > Imposta da: `.claude/agents/tester-funzionale.md` (pull prima del commit, pathspec esplicito, nessun `git add -A`).
- Job di un workflow con lo stesso nome della suite completa (`test`): `pr-checks` tiene un solo controllo per nome, e il test mirato nascondeva una suite rossa → il job mirato ha un nome suo.
  > Imposta da: `.github/workflows/ci.yml` (job `test (parte N)` e riassuntivo `test`).
- Vercel conta anche le build ignorate nel limite di 100 deployment al giorno del piano gratuito → per i rami senza anteprima si usa `git.deploymentEnabled` in `vercel.json`.
  > Imposta da: `vercel.json`.
- Due `test-mirato` sullo stesso branch si annullano a vicenda (gruppo di concorrenza per ref) → si lanciano a turno, uno alla volta.
  > Imposta da: `.github/workflows/test-mirato.yml` (gruppo di concorrenza per branch e spec; due spec diverse non si annullano più).
- Branch temporaneo creato sul remoto (per un test o una prova) → gli agenti non possono cancellarlo: niente branch temporanei sul remoto, solo locali o il branch della propria PR.
  > Imposta da: `.claude/agents/tester-funzionale.md` («mai creare branch remoti temporanei»).
- PR di una fondamenta `shared/*` con `Refs #n` nel corpo, e guard rosso → il guard vuole `Closes #<n>` nel corpo di ogni PR, anche delle fondamenta; `Refs` non basta.
  > Imposta da: `.github/workflows/guard.yml` (la descrizione deve contenere `Closes #<numero>`).
- Sviluppatore che risponde FATTO senza aver eseguito i test della propria pagina → prima di FATTO lancia il workflow `test-mirato` sulle spec della pagina e scrive l'esito nella PR.
  > Imposta da: `.claude/agents/sviluppatore.md` (sezione «Test mirati prima di consegnare»).
- Test instabili che passano solo al secondo tentativo restano nascosti in CI → il tester li segnala con i numeri delle run e il coordinatore apre subito una issue.
  > Imposta da: `.claude/agents/tester-funzionale.md` (sezione «Regole», test instabili).
- Hook che blocca un comando, aggirato con uno script, `sed -i` o una copia del file, poi annullato → mai aggirare hook, CI o test, nemmeno per annullare: si usa lo strumento che l'hook indica oppure ci si ferma con `BLOCCATO` e si scrive l'esito.
  > Imposta da: `.claude/hooks/guard-bash.mjs` (blocca anche l'opzione git che salta i controlli) e la sezione «Controlli automatici» di tutti gli agenti.
- Suite divisa in più parti con controlli chiamati `test (1)`, `test (2)`, `test (3)`: la protezione di `main` chiede un controllo `test` → un job riassuntivo `test` sopra le parti, verde se sono verdi o saltate, rosso se una parte fallisce o viene annullata.
  > Imposta da: `.github/workflows/ci.yml` (job «Esito delle tre parti»).
- Protezione di `main` non applicata sul piano gratuito → nessun agente conta su GitHub per bloccare un merge; una PR è pronta solo con `pr-checks <n>` verde.
  > Imposta da: ARCHITETTURA §8 (ruleset `protezione-main` configurato ma non applicato).
- `.claude/worktrees/` non tracciati → non si committano né si «sistemano».
  > Imposta da: `.gitignore` (`.claude/worktrees/`).
- Push con `check` o `build` rotti dopo un push di soli test → prima di ogni push `npm run check` e `npm run build`.
  > Imposta da: skill `flusso-git` («Prima del push: anche npm run build») e hook a fine turno.
- Suite Playwright completa a ogni push, con i minuti esauriti → gira su `main` e sulle PR con `in-test` o `pronta-per-francesco`; un solo push per lavoro, dopo i controlli locali.
  > Imposta da: ARCHITETTURA §9 e i workflow CI (`ci.yml`, `test-mirato.yml`).
- `npm run check` nella copia principale con migliaia di errori dai worktree → `.claude/worktrees/**` è escluso da ESLint.
  > Imposta da: `eslint.config.mjs` (`.claude/worktrees/**`).
- Script o file condivisi (`scripts/`, `.env.example`, `package.json`) affidati all'architetto dati → solo su `shared/*`.
  > Imposta da: `.claude/hooks/guard-files.mjs` (file condivisi e configurazione solo su `shared/*`).

## Test

- Porta 54322 del database locale occupata sul runner, con il controllo `db` rosso senza bug → `db.yml` riprova una volta dopo uno stop pulito; se il controllo cade per la porta, si rilancia prima di cercare un bug.
  > Imposta da: `.github/workflows/db.yml` (riprova una volta dopo `supabase stop`).
