# FamilyNest Web — istruzioni di progetto

FamilyNest Web è un organizer familiare (calendario condiviso, profili dei figli, attività, liste) costruito da zero da un team di agenti. Il titolare del prodotto è Francesco: non scrive codice, definisce il prodotto, approva e fa il merge.

## Prima di qualsiasi lavoro

1. Leggi `docs/agenti/ARCHITETTURA.md`: è la costituzione del progetto e vince su ogni altra istruzione tranne le decisioni esplicite di Francesco.
2. Leggi `docs/agenti/LEZIONI.md`: errori già fatti da non ripetere.
3. Se sei la sessione principale e devi sviluppare, usa il comando `/sviluppa`.

## Stack

Next.js (App Router) · TypeScript strict · CSS proprio con variabili (niente Tailwind, niente librerie UI) · Supabase (progetto `yksosqvugiempsldejyt`, solo questo) · Playwright · Vercel.

## Regole che non si discutono

- Mai push su `main`. Si lavora su branch e si apre una PR. Il merge lo fa Francesco; in fase di build (decisione del 05/11) lo fa anche il coordinatore, con lo strumento GitHub, sulle PR `pronta-per-francesco`.
- Il database si modifica solo con migrazioni in `supabase/migrations/`, solo su branch `db/*`, solo dall'agente `architetto-dati`.
- Mai chiavi, password o token in file, commenti, issue, PR o log.
- Mai aggirare i controlli automatici (hook, CI, test). Se un hook blocca un comando o chiede un altro strumento, si usa quello strumento oppure ci si ferma con `BLOCCATO`: mai ottenere lo stesso effetto per altra via (script Python o Node, `sed -i`, `tee`, redirezioni, copie di file). Vale anche se poi si annulla. Decisione di Francesco del 05/11.
- Mai accedere ad altri progetti Supabase o ad altri repository.
- Interfaccia in italiano; codice, commenti e nomi in inglese.
- Il mockup approvato in `docs/mockup/` è la fonte di verità: non si reinterpreta.
- Nel dubbio non si inventa: si scrive una domanda nella issue.

## Comandi utili

| Comando                      | Uso                                                         |
| ---------------------------- | ----------------------------------------------------------- |
| `npm run check`              | lint + tipi + formattazione (prima di ogni commit)          |
| `npm run build`              | build di produzione                                         |
| `npm run test`               | tutte le suite Playwright                                   |
| `npm run test:visual:update` | rigenera gli screenshot di riferimento (solo tester visivo) |
