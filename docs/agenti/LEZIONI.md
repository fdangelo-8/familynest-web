# Lezioni apprese

Errori già commessi (in questo progetto o in quelli precedenti dell'ecosistema) e regola corretta. Una riga per lezione. Non si cancellano lezioni: si aggiorna la regola.

## Database e Supabase

- Policy RLS riscritte "per sistemare" un bug e rotte per tutti → le policy si cambiano solo con migrazione + test pgTAP, mai al volo.
- `.select()` concatenato dopo insert/update che resta appeso → dopo una scrittura non concatenare `.select()`: rileggi con una query separata se serve.
- `ALTER TYPE ... ADD VALUE` usato nella stessa migrazione dell'insert che lo sfrutta → due migrazioni separate.
- Migrazioni con dipendenze in un unico file che fallisce a metà → estensioni, poi DDL, poi dati, in migrazioni separate.
- Supposizioni sui nomi delle colonne → verifica sempre lo schema reale nelle migrazioni prima di scrivere codice o query.

## Sviluppo

- Middleware Edge per l'autenticazione che rompeva i redirect → controllo della sessione lato server nei layout/route, niente middleware Edge per l'auth.
- Prompt e PR troppo grandi causano regressioni → piccoli passi, pochi file per volta, commit frequenti.
- File JSX grandi riscritti da zero perdendo parti → modifiche mirate, mai riscritture integrali non richieste.
- Date mostrate nel giorno sbagliato per il fuso orario → le date si salvano in UTC e si mostrano nel fuso `Europe/Rome` con funzioni centralizzate.
- Selettori di data che ricadevano sull'interfaccia nativa del browser → usare il componente del design system.

## Processo

- La protezione di `main` non è applicata sul piano GitHub gratuito → nessun agente conta su GitHub per bloccare un merge: si dichiara pronta solo una PR con `node scripts/agenti/gh.mjs pr-checks <n>` tutto verde.
- `gh issue …` e `gh pr …` falliscono con "GitHub GraphQL is not available" → usare `node scripts/agenti/gh.mjs`, che usa l'API REST.

- Una lista di issue o PR può tornare vuota per un istante (proxy della sessione) → prima di creare issue nuove ricontrollare; lo script riprova da solo la prima pagina vuota.
- `.claude/worktrees/` sono le copie di lavoro degli agenti, ignorate da git → non si committano e non vanno "sistemate" quando un hook dell'ambiente segnala file non tracciati.
- Due tester in parallelo sulla stessa PR condividono branch locale e indice git: un commit ha cancellato per errore gli spec dell'altro → ogni tester committa solo i propri file con pathspec esplicito, fa `git pull --no-rebase` prima del push e controlla `git show --stat` del proprio commit.
- Tester che dichiara "CI tutta verde" guardando un commit precedente al proprio push → l'esito si dà solo dopo `node scripts/agenti/gh.mjs pr-checks <n> --watch` sul commit appena pushato.

## Test

- Falsi errori di insert in locale per saturazione del pool di connessioni → verificare sulla preview prima di dichiarare un bug.
- Test fragili legati a testi o classi CSS → selettori per ruolo e nome accessibile, o `data-testid` dove serve.
- Test che confrontano token o stili come stringhe falliscono perché la build minifica i valori (`.30`→`.3`, `#ffffff`→`#fff`, rgba→hex) e Prettier riscrive i numeri → i test che confrontano token o stili normalizzano i valori, mai confronto letterale di stringhe.
- Test con timer che usavano `page.clock.install()` senza fermare il tempo fallivano solo in CI (più lenta) → nei test con tempi usare `page.clock.pauseAt` e avanzare con `runFor`.
- Confronti di stili calcolati con il mockup falliscono in CI su altezze che dipendono da andata a capo e font (il mockup non carica i font da Google in CI) → escludere `height` solo dove dipende dal testo, non togliere l'intero caso.
- Riferimento visivo vecchio ma sotto tolleranza non viene riscritto dal workflow visual-baseline (`--update-snapshots`), e gli hook vietano di cancellare screenshot → il riferimento resta valido finché è sotto tolleranza; se va rigenerato serve una modifica al workflow su branch `admin/*` decisa da Francesco.

## Design

- Grafiche che "sembrano fatte dall'AI" (card inclinate, CTA generiche, `+` anonimi) → seguire il mockup alla lettera; testi di bottoni specifici (es. "Aggiungi", non "Scrivi").
- Componente in caricamento con lo stile del disabilitato sembrava disabilitato → `aria-busy` e `aria-disabled` sono corretti, ma lo stile visivo del caricamento va separato da quello del disabilitato.
