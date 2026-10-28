# Lezioni apprese

Errori già commessi (in questo progetto o in quelli precedenti dell'ecosistema) e regola corretta. Una riga per lezione. Non si cancellano lezioni: si aggiorna la regola.

## Database e Supabase

- Policy RLS riscritte "per sistemare" un bug e rotte per tutti → le policy si cambiano solo con migrazione + test pgTAP, mai al volo.
- `.select()` concatenato dopo insert/update che resta appeso → dopo una scrittura non concatenare `.select()`: rileggi con una query separata se serve.
- `ALTER TYPE ... ADD VALUE` usato nella stessa migrazione dell'insert che lo sfrutta → due migrazioni separate.
- Migrazioni con dipendenze in un unico file che fallisce a metà → estensioni, poi DDL, poi dati, in migrazioni separate.
- Supposizioni sui nomi delle colonne → verifica sempre lo schema reale nelle migrazioni prima di scrivere codice o query.
- PR del database unita mentre il revisore chiedeva ancora correzioni, poi migrazioni già unite modificate → dopo un merge le migrazioni non si toccano più: le correzioni si fanno con migrazioni nuove su un nuovo branch `db/*`; prima di ogni push l'agente controlla che la PR sia ancora aperta.
- Deploy delle migrazioni fallito per una password errata nel secret del database → dopo il merge di una PR `db/*` il coordinatore controlla il run `db` su `main` e, se fallisce per credenziali, apre subito una issue bloccata per Francesco.
- Funzione `security definer` che si fida del jsonb mandato dal client (autore, date, id) → la fonte di verità è una tabella lato server; l'input del client è solo un elenco di id, e la funzione verifica appartenenza, finestra di tempo e stato.
- Eventi `DELETE` di Realtime (Postgres Changes) senza filtro né RLS → arrivano a tutti gli iscritti con il solo `id`: la pagina ignora gli id che non conosce, e la descrizione della PR dice cosa arriva davvero.
- Pulizia dei dati con scadenza affidata a un trigger di scrittura (dati oltre la scadenza se nessuno scrive) → la scadenza si garantisce con un job `pg_cron` che non dipende dall'uso.
- Permesso di `insert` sulla colonna `id` → un altro Nest riusa un id ricevuto dagli eventi `DELETE` di Realtime e blocca l'«Annulla» del Nest che l'aveva tolto → mai `grant insert` su `id`: lo genera il database; la coda offline usa un id temporaneo e riconcilia con una lettura separata, senza `.select()`.

## Sviluppo

- Middleware Edge per l'autenticazione che rompeva i redirect → controllo della sessione lato server nei layout/route, niente middleware Edge per l'auth.
- Prompt e PR troppo grandi causano regressioni → piccoli passi, pochi file per volta, commit frequenti.
- File JSX grandi riscritti da zero perdendo parti → modifiche mirate, mai riscritture integrali non richieste.
- Date mostrate nel giorno sbagliato per il fuso orario → le date si salvano in UTC e si mostrano nel fuso `Europe/Rome` con funzioni centralizzate.
- Selettori di data che ricadevano sull'interfaccia nativa del browser → usare il componente del design system.
- Riconoscimento delle sezioni per prefisso (`/casa/...`) che rendeva attive pagine inesistenti, con due h1 → le rotte attive si riconoscono per elenco esplicito delle pagine esistenti, non per prefisso.
- Form con mail o altri dati personali senza `method="post"` e `action`, o con un campo che ha `name` (prima dell'idratazione il browser fa GET: l'indirizzo finisce in URL, cronologia, log e Referer; con `name` la mail arriva al server) → form con `method="post"` e `action` verso una rotta POST che risponde 303, campo senza `name`; si prova bloccando gli script e inviando prima dell'idratazione.
- Percorso di ritorno (`next`) controllato sulla stringa grezza e risolto dopo con `new URL` → `/.//host` e `/a/..//host` passano i controlli → si normalizza prima con `new URL(raw, base)`, si verifica che l'origine non cambi, si applicano le regole al `pathname` normalizzato e si restituisce quello.
- Cookie di sessione cancellati con `maxAge: 0` (o senza scadenza) restano nel browser come cookie vuoti → la cancellazione imposta una scadenza passata (`expires: new Date(0)`) con lo stesso `path`; il test verifica che il cookie non ci sia più dopo «Esci».
- `redirect()` in una server action fa rifiutare la promessa lato client, e dentro un `try` viene preso per errore di rete → le server action restituiscono la destinazione e il client naviga; dove serve `redirect()`, il `catch` chiama per primo `unstable_rethrow(error)`.
- Guardia di sessione che davanti a un errore tecnico (Auth non raggiungibile) mostra comunque il contenuto → la guardia chiude sull'errore con «Riprova»; il chiamante gestisce il caso di errore e non scarta il risultato.
- Stessa parte di interfaccia in due disposizioni (mobile e desktop) con lo stesso `id` → `id` duplicati, `aria-describedby` ambigui, axe `duplicate-id-aria` → un `id` per disposizione, con prefisso diverso (`m-`, `d-`).

## Processo

- La protezione di `main` non è applicata sul piano GitHub gratuito → nessun agente conta su GitHub per bloccare un merge: si dichiara pronta solo una PR con `node scripts/agenti/gh.mjs pr-checks <n>` tutto verde.
- `gh issue …` e `gh pr …` falliscono con "GitHub GraphQL is not available" → usare `node scripts/agenti/gh.mjs`, che usa l'API REST.

- Una lista di issue o PR può tornare vuota per un istante (proxy della sessione) → prima di creare issue nuove ricontrollare; lo script riprova da solo la prima pagina vuota.
- `.claude/worktrees/` sono le copie di lavoro degli agenti, ignorate da git → non si committano e non vanno "sistemate" quando un hook dell'ambiente segnala file non tracciati.
- Due tester in parallelo sulla stessa PR condividono branch locale e indice git: un commit ha cancellato per errore gli spec dell'altro → ogni tester committa solo i propri file con pathspec esplicito, fa `git pull --no-rebase` prima del push e controlla `git show --stat` del proprio commit.
- Tester che dichiara "CI tutta verde" guardando un commit precedente al proprio push → l'esito si dà solo dopo `node scripts/agenti/gh.mjs pr-checks <n> --watch` sul commit appena pushato.
- Lavoro su script e file condivisi assegnato all'architetto dati su branch `db/*`, ma guard e hook lo vietano → script in `scripts/`, `.env.example` e `package.json` si fanno solo su branch `shared/*`, anche se riguardano i dati.
- Risposta di Francesco a una `proposta-design` registrata in ritardo, o nota di stato che la dà per «da decidere» → un'issue d'implementazione per ogni punto approvato, subito; prima di scrivere lo stato si rileggono i commenti di Francesco nell'issue (punti 6–14 della #43 erano rimasti senza issue).
- Scostamento dal criterio deciso in PR (testo diverso dal CA) → il coordinatore aggiorna il criterio nell'issue prima del test funzionale, altrimenti il tester lo legge in contrasto con la PR.
- Criterio di accettazione con un valore oltre i limiti del database (CA-13 della #12 superava i 100 caratteri, e non era verificabile) → l'analista controlla lunghezze e vincoli di colonne e funzioni prima di fissare il criterio.

## Test

- Falsi errori di insert in locale per saturazione del pool di connessioni → verificare sulla preview prima di dichiarare un bug.
- Test fragili legati a testi o classi CSS → selettori per ruolo e nome accessibile, o `data-testid` dove serve.
- Test che confrontano token o stili come stringhe falliscono perché la build minifica i valori (`.30`→`.3`, `#ffffff`→`#fff`, rgba→hex) e Prettier riscrive i numeri → i test che confrontano token o stili normalizzano i valori, mai confronto letterale di stringhe.
- Test con timer che usavano `page.clock.install()` senza fermare il tempo fallivano solo in CI (più lenta) → nei test con tempi usare `page.clock.pauseAt` e avanzare con `runFor`.
- Confronti di stili calcolati con il mockup falliscono in CI su altezze che dipendono da andata a capo e font (il mockup non carica i font da Google in CI) → escludere `height` solo dove dipende dal testo, non togliere l'intero caso.
- Riferimento visivo vecchio ma sotto tolleranza non viene riscritto dal workflow visual-baseline (`--update-snapshots`), e gli hook vietano di cancellare screenshot → il riferimento resta valido finché è sotto tolleranza; per rigenerarlo si usa l'immagine della CI (container Playwright) sull'ultimo commit che cambia il CSS, con il workflow `visual-baseline` o in locale con la stessa immagine e `--update-snapshots=all`, e si controlla il pixel che è cambiato, perché sotto tolleranza la CI resta verde anche con un riferimento sbagliato.
- Script che scrive nel progetto remoto riconosceva gli account di test solo dalla mail → gli script che toccano il progetto remoto marcano i propri dati (es. `app_metadata.familynest_test_user`), fanno tutti i controlli prima della prima scrittura e cancellano solo dati marcati.
- Test che richiedono un utente autenticato saltati in CI finché gli utenti di test remoti non esistono, e "CI verde" non prova quei casi → quando un test è saltato in CI, la verifica si fa in locale contro Supabase locale e l'esito lo dice esplicitamente.
- Due tester che usano lo stesso Supabase locale e riseminano con credenziali diverse si cancellano a vicenda i dati → un solo seed condiviso per sessione, stesse variabili per tutti.
- Correzione approvata che cambia uno stile fissato dal mockup → il test di confronto fallisce: si aggiorna con l'elenco delle differenze approvate, citando la decisione, senza disattivarlo.

## Design

- Grafiche che "sembrano fatte dall'AI" (card inclinate, CTA generiche, `+` anonimi) → seguire il mockup alla lettera; testi di bottoni specifici (es. "Aggiungi", non "Scrivi").
- Componente in caricamento con lo stile del disabilitato sembrava disabilitato → `aria-busy` e `aria-disabled` sono corretti, ma lo stile visivo del caricamento va separato da quello del disabilitato.
- Frase sul comportamento nella guida del design system (es. dove appare il dialogo, «in basso» su mobile) scritta senza controllarla sul CSS → ogni frase di comportamento si verifica su `components.css` prima di approvare o correggere la guida.
