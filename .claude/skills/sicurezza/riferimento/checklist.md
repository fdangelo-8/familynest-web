# Checklist di sicurezza: Next.js, Supabase, Vercel, dati dei minori

Usala in ogni revisione per le aree toccate dalla PR, e per intero nell'audit. Per ogni voce: verifica nel codice, non presumere.

## Next.js (App Router)

- [ ] **Server action e route handler:** ognuno legge l'utente dalla sessione sul server (`src/lib/auth/require-user.ts` o equivalente) e verifica Nest e ruolo prima di leggere o scrivere. Nessuna fiducia in id, ruoli o prezzi arrivati dal client.
- [ ] **Validazione degli input** sul server per tipo, lunghezza e formato (date, email, colori, URL), anche se il form la fa già.
- [ ] **Proxy** (`src/proxy.ts`): non è l'unica protezione; le pagine protette ricontrollano la sessione nel layout o nella pagina.
- [ ] **Variabili d'ambiente:** nessun segreto con prefisso `NEXT_PUBLIC_`; `src/lib/env.ts` fallisce se manca un segreto invece di usare un valore di riserva.
- [ ] **Componenti client:** non importano moduli che usano segreti o il client amministrativo (`import 'server-only'` dove serve).
- [ ] **Cache:** dati di un utente mai in cache condivise (`unstable_cache`, `fetch` con cache, pagine statiche) senza una chiave per utente; le pagine con dati personali sono dinamiche.
- [ ] **Redirect:** parametri `next`/`redirect` validati (vedi `src/lib/auth/safe-next.ts`); nessun redirect verso domini esterni.
- [ ] **XSS:** niente `dangerouslySetInnerHTML` con contenuto degli utenti; `href` costruiti da input solo `https:`/`mailto:`; nessun HTML da stringhe.
- [ ] **Errori:** all'utente un messaggio generico; dettagli tecnici solo nei log, senza dati personali.
- [ ] **CSRF:** le server action di Next hanno protezioni di origine; i route handler che modificano dati controllano metodo, origine e sessione.
- [ ] **Upload:** tipo e dimensione verificati sul server, nomi file non usati come percorso, contenuto mai servito come HTML.
- [ ] **Intestazioni** in `next.config.*` o `vercel.json`: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, frame-ancestors (no embedding), Referrer-Policy, Permissions-Policy.

## Supabase

- [ ] **RLS attiva su ogni tabella** dello schema `public` (e su quelle esposte all'API); nessuna tabella senza policy.
- [ ] **Policy:** `USING` e `WITH CHECK` presenti per insert/update; l'appartenenza al Nest passa da una funzione o join verificati; nessuna policy `true` per utenti autenticati su dati di Nest.
- [ ] **Ruoli nel Nest:** un membro non può promuoversi, cambiare il Nest di una riga, modificare dati di altri dove non previsto, né leggere campi riservati (privacy «Occupato»/«Solo io»).
- [ ] **Funzioni `security definer`:** `search_path` fissato (`set search_path = ''` o schema esplicito), controllo dell'utente all'inizio, nessun SQL dinamico con input; esecuzione revocata a `public`/`anon` se non serve.
- [ ] **Viste:** `security_invoker = true`, altrimenti scavalcano la RLS.
- [ ] **Storage:** bucket privati per dati personali; policy sugli oggetti per Nest; URL firmati a scadenza breve.
- [ ] **Chiavi:** la service role key solo in variabili server; la anon/publishable key è pubblica per definizione e va bene solo con RLS corretta.
- [ ] **Auth:** conferma email, durata delle sessioni, recupero password con token monouso; nessuna enumerazione degli account nei messaggi («email o password errati»).
- [ ] **Test pgTAP** di isolamento per ogni tabella nuova: un utente di un altro Nest non legge, non inserisce, non modifica, non cancella.
- [ ] **Avvisi di sicurezza di Supabase** (advisors) senza voci di livello ERROR.
- [ ] **Seed e utenti di test** presenti solo in locale e nei database di prova, mai nel progetto di produzione.

## Vercel e dipendenze

- [ ] Variabili d'ambiente separate per Production, Preview e Development; le preview non usano dati reali.
- [ ] Anteprime protette se mostrano dati reali.
- [ ] `npm audit --omit=dev` senza vulnerabilità alte o critiche non giustificate; lockfile presente e coerente.
- [ ] Dipendenze nuove: mantenute, diffuse, senza script di installazione sospetti.
- [ ] GitHub Actions: niente `pull_request_target` con checkout del codice della PR; permessi minimi (`permissions:`); segreti mai stampati.

## Dati delle famiglie e dei minori (con `privacy-e-dati-minori`)

- [ ] Si raccolgono e si mostrano solo i dati necessari; ogni `select` legge solo le colonne che servono.
- [ ] Nessun dato dei figli verso terze parti (analytics, AI, email marketing) senza base giuridica e decisione di Francesco.
- [ ] Nessun dato personale in log, URL, titoli delle pagine, notifiche push visibili a schermo bloccato oltre il necessario.
- [ ] Eliminazione dell'account e uscita dal Nest cancellano o anonimizzano davvero i dati, inclusi file e token.
- [ ] Tempi di conservazione coerenti con l'informativa (`/privacy`).
- [ ] Token OAuth dei calendari collegati: conservati in modo sicuro, revocati alla disconnessione, ambiti minimi.
