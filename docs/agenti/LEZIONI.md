# Lezioni apprese

Una riga per lezione: `errore → regola`. Le lezioni già imposte da hook, CI, test o istruzioni sono in `docs/agenti/LEZIONI-archivio.md`.

## Database e Supabase

- Policy RLS riscritte al volo per un bug → si cambiano solo con migrazione e test pgTAP.
- `.select()` dopo una scrittura resta appeso; rilettura con la stessa query dà il vecchio dato → niente `.select()` dopo le scritture; rileggi con una query diversa.
- `ALTER TYPE ... ADD VALUE` e l'insert che lo usa nella stessa migrazione; migrazioni con estensioni, DDL e dati insieme → una migrazione per passo.
- Nomi di colonne supposti → verifica lo schema reale nelle migrazioni.
- Migrazione già unita modificata → mai: correzioni in migrazioni nuove su un nuovo `db/*`; prima di ogni push controlla che la PR sia aperta.
- Deploy migrazioni fallito per credenziali → il coordinatore controlla il run `db` su `main` dopo ogni merge `db/*` e apre subito una issue bloccata per Francesco.
- `security definer` che si fida del jsonb del client → la fonte è una tabella lato server; il client manda solo id, la funzione verifica appartenenza, finestra e stato.
- Realtime `DELETE` senza filtro né RLS → arriva a tutti con il solo `id`: la pagina ignora gli id sconosciuti; la PR dice cosa arriva.
- Scadenza dei dati affidata a un trigger di scrittura → job `pg_cron`.
- `grant insert` su `id` → mai: lo genera il database; la coda offline usa un id temporaneo e riconcilia con una lettura separata.
- Impegni «Solo io» o «Occupato» modificabili da chi li vede → solo l'autore aggiunge persone e cambia l'accompagnatore (`security definer` in `private`, trigger, test per ruolo).
- Righe mascherate con tipi generati che dicono `string` → una funzione unica in `src/lib/` con tipo a varianti (`isMasked`).
- RPC anonima con blocco «solo POST» che rifiuta solo `GET` → rifiuta ogni metodo diverso da `POST` prima di leggere; test per ciascuno.
- Divisione di una serie in più scritture: errore a metà, copie fantasma → una funzione `security definer` in transazione; test con errore forzato.
- Limite per adulto controllato con un conteggio prima dell'insert → `pg_advisory_xact_lock` per membro prima di contare.
- Serie settimanale modificata solo sul giorno del modulo → se la regola resta, spostare i giorni della serie della stessa distanza; il giorno del modulo solo se la regola cambia.
- Test RLS in un solo verso → provare entrambi, anche con l'amministratore: `update`/`delete` con `returning` danno 0 righe, `insert` con id altrui dà `42501`.
- Cancellazione account che lascia il registro di Auth (mail, IP) → cancellare nella stessa transazione le righe `auth` dell'utente; se il ruolo non può, la domanda va a Francesco.
- Lavoro su tutti i Nest esposto a chi chiama → `p_household_id` obbligatorio (`22023`); il lavoro globale gira solo dal job `pg_cron`, via funzione `private`.
- Regole di visibilità copiate in due funzioni → una sola fonte in `private`, o test di equivalenza.
- PR `db/*` che tocca trigger o funzioni unita con la sola `check` verde → prima del merge, etichetta `suite-completa`.
- Ruolo e chiamata a `private` in una sola espressione `security invoker` → `service_role` bloccata: il ruolo in un'istruzione a sé; pgTAP con la chiave amministrativa.
- PR `db/*` con test e2e o file fuori da `supabase/`, `src/types/database.ts` e `docs/` → guard rosso; il test va nel branch della pagina (#360: aggiunto e annullato con `git revert`).

## Sviluppo

- Middleware Edge per l'auth che rompeva i redirect → sessione controllata lato server nei layout e nelle route.
- PR grandi o file JSX riscritti per intero → pochi file per volta, modifiche mirate, commit frequenti.
- Date nel giorno sbagliato → UTC nel salvataggio, `Europe/Rome` nella visualizzazione, con funzioni centralizzate.
- Selettori di data nativi del browser → componente del design system.
- Sezione attiva per prefisso (`/casa/...`) → rotte attive per elenco esplicito delle pagine esistenti.
- Form con dati personali senza `method="post"` e `action`, o con `name` sul campo → `method="post"` e `action` verso rotta POST con 303; campo senza `name`.
- `next` controllato sulla stringa grezza → normalizza con `new URL(raw, base)`, verifica l'origine, applica le regole al `pathname` e restituisci quello.
- Cookie cancellati con `maxAge: 0` restano vuoti → cancella con `expires: new Date(0)` e lo stesso `path`; se il criterio chiede la scadenza, `maxAge` in secondi (almeno 1).
- `redirect()` in server action rifiutato dal client o preso da un `try` → la action restituisce la destinazione; dove serve `redirect()`, il `catch` chiama `unstable_rethrow(error)` per primo.
- Guardia di sessione che mostra il contenuto su errore tecnico → chiude con «Riprova».
- Stessa parte di interfaccia in due disposizioni con lo stesso `id` → un `id` per disposizione, con prefisso `m-` o `d-`.
- «Vai al contenuto» con `next/link` che non sposta il focus → `<a href="#contenuto">` con `focus()` sul `main` (`tabIndex={-1}`).
- CSS module o `<style>` in `(app)` → niente, né in `(app)` né nelle pagine; le classi di disposizione vanno in `components.css` via `richiesta-condivisa`.
- Dati personali letti o restituiti oltre il necessario → si legge e si restituisce solo ciò che la pagina mostra.
- Lettura in più parti che su errore parziale dà `ok: true` con un pezzo mancante → `{ ok: false, reason }` e «Riprova».
- Componente condiviso che riceve un elemento già pronto → il componente possiede avviso, azioni e caricamento; la pagina passa dati e callback.
- `aria-current="page"` su tutte le pagine di una sezione → `"true"` per la sezione, `"page"` solo sull'indirizzo esatto (`getNavAriaCurrent`).
- Costante di un modulo `"use client"` importata dal server → dal server solo `import type`.
- Scorciatoia globale ignorata con il fuoco in un campo → la specifica dice da quali elementi vale; test da un elemento che non è un campo.
- Costante generica in un modulo condiviso che collide → nomi specifici; rinomina o frase condivisa solo dopo ricerca degli usi in `src/`, `tests/` e PR aperte.
- Errore di rete distinto dal `code` (presente solo con corpo JSON) → si decide dallo `status`: `0` è rete, il resto è server; il conflitto `23505` a parte.
- `aria-pressed`, `aria-busy` messi sul DOM con un effect → prop del componente condiviso via `richiesta-condivisa`; ripiego: `useLayoutEffect` con issue citata.
- Preferenza letta senza controllare `error` → controlla sempre; il predefinito è il più protettivo («Solo io») e la scelta è visibile prima del salvataggio.
- Dati locali cancellati solo da «Esci» del profilo → si cancellano in ogni uscita e alla pagina di accesso, con una funzione in `src/lib/`.
- Valore non approvato scritto nel codice o nei dati → resta vuoto finché approvato; un test lo verifica.
- `VisuallyHidden` con spazi a inizio o fine → lo spazio lo mette la struttura; il test normalizza gli spazi.
- Variante nuova di un tipo unione condiviso → cerca in `src/` e nelle PR aperte tutti gli `switch` esaustivi e aggiornali nella stessa PR.
- Regex `[^>]*` o `[\s\S]*?` su HTML esterno: tempo quadratico → `indexOf` e tetti di lunghezza; dopo un tag saltato riparti dopo il `>`.

## Processo

- Lista di issue o PR vuota per un istante → ricontrolla prima di creare issue nuove.
- «CI verde» dichiarato su un commit precedente, o `--watch` letto prima dei run del nuovo SHA → l'esito si dà solo sul commit pushato, con i run completati.
- Run annullata dalla concorrenza di `remote-test-data` → il coordinatore la rilancia a mano; mai un job fallito.
- Suite più lunga del timeout del job, interrotta senza test rossi → misura le ultime run e alza il timeout prima di aggiungere pagine; una suite interrotta non è un esito.
- Stack Supabase locale con cartella o project-id comuni → entrambi nel proprio worktree; si ferma con `supabase stop --workdir`.
- Disco pieno per `node_modules`, `.next`, `test-results` → alla fine si cancellano quelli del proprio worktree.
- `git checkout` nella copia principale che cambia il branch agli altri → si lavora solo nel proprio worktree; per leggere un altro commit (revisore) usa `git show <ref>:<file>`.
- Script o file temporanei in cartelle condivise tra agenti → ogni agente lavora nel proprio worktree, con file dal prefisso unico (numero di issue o PR).
- Requisito di un'issue perso nel riepilogo del coordinatore → il revisore confronta la PR con l'issue originale; ogni elemento perso si decide per iscritto prima del test.
- Scostamento dal criterio deciso in PR → il coordinatore aggiorna il criterio nell'issue prima del test.
- Criterio con valori oltre i limiti del database → l'analista controlla lunghezze e vincoli.
- Sviluppo senza criteri di accettazione numerati (#304) → l'analista li scrive prima; senza, la PR fa più giri di correzioni (#361: tre).
- Controllo `db` obbligatorio rosso per un test con data passata, mentre la correzione aspetta un'altra PR → PR minima di sblocco, unita per prima (#366).
- Tester visivo che sovrascrive un file del funzionale con una copia vecchia (#361) → `git pull --no-rebase` e `git diff --cached --stat` prima di ogni commit; pathspec propri.
- Edit bloccato da un hook, aggirato con `sed -i`, script Python o Node o copia (#365, #361) → mai, nemmeno per annullare: si usano Edit o Write, altrimenti `BLOCCATO`.
- Proposta di design approvata in ritardo, o stato «da decidere» → un'issue per ogni punto approvato, subito; prima dello stato rileggi i commenti di Francesco.

## Test

- Falsi errori di insert in locale per saturazione del pool → verifica sulla preview prima di dichiarare un bug.
- Selettori fragili (testi, classi, `.first()`, nomi parziali, campi multipli) → ruolo e nome accessibile con `exact: true`, dentro il contenitore, o `data-testid`/`aria-label`.
- Token o stili confrontati come stringhe → la build minifica: normalizza i valori prima del confronto.
- `page.clock.install()` senza fermare il tempo, o orologio fermato che blocca il `goto` → `page.clock.pauseAt` e `runFor`; dopo ogni navigazione fai ripartire e rifermare l'orologio.
- `height` che dipende da font o andata a capo in CI → escludila solo dove dipende dal testo.
- Riferimento visivo sotto tolleranza → resta valido; si rigenera con `visual-baseline` e si controlla il pixel cambiato.
- Correzione approvata che cambia uno stile del mockup → aggiorna il test con l'elenco delle differenze approvate, citando la decisione; mai disattivarlo.
- Script che scrive sul remoto e riconosce i test dalla mail → marca i dati (`app_metadata.familynest_test_user`) e cancella solo quelli.
- `node --env-file` che non sovrascrive le variabili già nella shell → verifica che l'URL sia `127.0.0.1` prima della prima scrittura.
- Test con utente autenticato saltati in CI → verifica in locale e dillo nell'esito; con le credenziali, i riferimenti visivi si generano subito.
- Due tester sullo stesso Supabase locale con seed diversi → un solo seed per sessione.
- Test che leggono il branch o il diff con `origin/main` in checkout superficiale → `git fetch --deepen=N`; se il diff non si calcola il test fallisce, mai con un `return`.
- Puntatore sopra un toast o un elemento (`onMouseEnter` ferma il conto) → `page.mouse.move(0, 0)` prima dello screenshot o di `clock.runFor` (#363, CA-19).
- Area di tocco misurata con `boundingBox` → verifica con `elementFromPoint` nei punti dell'area.
- Fuoco su un campo con `outline: none` → controlla il contenitore `:focus-within`, se documentato.
- Due `<main>` in streaming → aspetta l'h1, poi `getByRole("main")`.
- Test di isolamento che cercano per nome → id fissi `SEED_HOME_A`/`SEED_HOME_B`; attendi il caricamento prima di verificare un'assenza.
- Login su utenti condivisi in parallelo → ogni test crea e cancella il proprio utente nel `finally`.
- axe `label-content-name-mismatch` → il nome accessibile comincia con il testo visibile; i dettagli in `aria-describedby`.
- Clic o tasti prima dell'idratazione → `waitHydrated` (`tests/fixtures/esplora.ts`), mai attese a tempo; stati di caricamento e navigazione trattenuta con `tests/fixtures/held-navigation.ts`.
- Errore simulato intercettando ogni richiesta alla tabella → intercetta solo la query dell'elenco; rispondi subito con 500 (il client riprova a 1, 2, 4 secondi).
- Pagina che passa da segnaposto a contenuto → la PR elenca i riferimenti visivi che cambiano; il tester visivo li rigenera.
- Misure o clic durante un'animazione, o `force: true` → `waitForAnimationsToEnd` (`tests/fixtures/animations.ts`).
- Test che blocca tutte le richieste, prefetch di Next incluso → blocca solo la navigazione vera.
- Didascalia nel font dei codici che va a capo → didascalie corte, su una riga.
- Test che dipendono dalla data reale (anche pgTAP) → regex sul formato, `pauseAt` o periodo fisso ben nel futuro; mai una data passata.
- Fixture che scrivono con il ruolo amministrativo dove serve la sessione utente → la scrittura passa dalla sessione; il ruolo amministrativo solo per preparare, detto nel commento.
- Dati finti di `page.route` che restano nel test successivo → `page.unrouteAll()` nel `finally`.
- Privacy controllata solo sul DOM → registra le risposte di rete (documento, fetch, xhr) e cerca nomi, date e id.
- Testo cercato in tutta la pagina con una palette aperta sopra → controlla solo la superficie in cui il test è aperto.
- `boundingBox` letto una volta su un elemento che React sostituisce → `expect.poll` finché stabile.
- Commenti CSS con «#numero» letti come colori → togli i commenti `/* … */` prima di cercare i colori.

## Design

- Grafiche «fatte dall'AI» o testi generici → mockup alla lettera; testi di bottoni specifici («Aggiungi», non «Scrivi»).
- Caricamento con lo stile del disabilitato → `aria-busy` e `aria-disabled`, ma stile di caricamento separato.
- Frase sul comportamento nella guida scritta senza controllare il CSS → verificala su `components.css` prima di approvare.
- Regole CSS nuove fuori dal blocco del designer → nel punto indicato dalla specifica; la descrizione lo dichiara dopo averlo controllato.
- Scorciatoia a una lettera senza spegnimento (WCAG 2.1.4) → la specifica prevede spegnimento o cambio; lo decide il designer.
- Regole nuove dove un test vieta i `px` → solo token; in fondo al blocco «STATI AGGIUNTI DAL DESIGNER», tra i segnaposti.
- Figlio di griglia senza colonne definite → `grid-template-columns: minmax(0, 1fr)` nel contenitore.
- PR `shared/*` con prop nuove senza skill e galleria → aggiorna `componenti.md`, `registro.md` e `Gallery.tsx` con un esempio per prop.
- Esempio di galleria diverso dall'uso della pagina → stessa struttura e testo; il tester visivo confronta con la pagina.
