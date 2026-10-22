---
name: flusso-git
description: Regole FamilyNest per branch, worktree, commit, allineamento a main e pull request. Usala ogni volta che crei un branch, fai commit, apri o aggiorni una PR.
---

# Flusso git di FamilyNest

## Branch

| Tipo | Nome | Chi |
|---|---|---|
| Pagina o funzione | `feat/<pagina>` (es. `feat/calendario`) | Sviluppatore |
| Fondamenta e file condivisi | `shared/<argomento>` (es. `shared/design-system`) | Sviluppatore assegnato dal coordinatore |
| Database | `db/<argomento>` (es. `db/households`) | Solo architetto dati |
| Correzione | `fix/<argomento>` | Sviluppatore |
| Documentazione agenti | `docs/<argomento>` | Documentalista |

- Si parte sempre dall'ultimo `main`: `git fetch origin && git switch -c <branch> origin/main`.
- Se lavori in un worktree isolato, crea il tuo branch dentro il worktree con il nome corretto prima del primo commit.
- Un worktree nuovo non ha le dipendenze: esegui `npm ci` prima di qualsiasi `npm run`. Senza, i controlli automatici di fine lavoro non possono girare.
- Mai lavorare direttamente su `main`. Mai `push --force` su branch altrui; sul proprio branch solo `--force-with-lease` dopo un rebase.

## Lavorare sul branch di un altro agente

Tester e sviluppatore (per le correzioni) lavorano su un branch già esistente, spesso da un worktree isolato. Un branch non può essere attivo in due worktree, quindi:

```bash
git fetch origin
git switch -C lavoro/<branch> origin/<branch>     # copia locale con nome diverso
# ... modifiche e commit ...
git pull --rebase origin <branch>                 # sempre prima del push: altri agenti possono aver pushato
git push origin HEAD:<branch>
```

Se il `pull --rebase` dà conflitti su file non tuoi, fermati e chiudi con `BLOCCATO`.

## Commit

- Piccoli e frequenti: un commit per passo logico, così una ripartenza perde al massimo pochi minuti.
- Messaggi in inglese, formato `tipo(ambito): descrizione` (es. `feat(calendario): add week view`). Tipi: `feat`, `fix`, `test`, `db`, `style`, `refactor`, `docs`, `chore`.
- Prima di ogni commit: `npm run check`. Prima del push: anche `npm run build`.
- Push dopo ogni commit significativo: il lavoro non pushato si perde se la sessione si interrompe.

## Allineamento a main

- Prima di aprire la PR e ogni volta che il coordinatore lo chiede: `git fetch origin && git rebase origin/main`, risolvi i conflitti, riesegui `npm run check` e i test della pagina.
- In un conflitto su un file che non è tuo, non scegliere a caso: fermati e segnalalo al coordinatore.

## Pull request

- Una PR per issue. Titolo in italiano, chiaro per Francesco.
- Il corpo segue il template e contiene `Closes #<numero>`.
- Le PR si aprono verso `main`. Nessun agente fa merge, approva o chiude PR altrui.
- Gli esiti di revisori e tester si scrivono come commenti sulla PR, iniziando con l'esito in maiuscolo (`APPROVATA`, `DA CORREGGERE`, `SUPERATO`, `NON SUPERATO`).

## Comandi utili con `gh`

```bash
gh pr create --base main --title "..." --body-file body.md
gh pr view <n> --comments
gh pr checks <n> --watch
gh pr comment <n> --body-file esito.md
gh issue view <n> --comments
gh issue edit <n> --add-label in-test --remove-label in-revisione   # solo coordinatore
```
