# Avvisi dei lavori automatici dell'account

Procedura operativa dell'agente `infrastruttura` (#660). Descrive il controllo dei lavori dell'account (#657, #659), chi riceve l'avviso e cosa fare quando arriva.

**Stato:** proposta. Il controllo non è ancora costruito: i pezzi e chi li fa sono in fondo. Finché non c'è, nessuno si accorge da solo di un guasto di questi lavori.

## Cosa si controlla

Il lavoro orario `account-jobs` di `pg_cron` (minuto 7 di ogni ora) esegue `private.run_scheduled_account_jobs()`: eliminazioni dopo i 14 giorni, pulizia delle esportazioni, cancellazione delle mail dell'ultimo messaggio dopo 72 ore, cancellazione delle prove dopo 5 anni. La funzione restituisce il numero di errori, ma `pg_cron` registra sempre «succeeded»: senza un controllo gli errori restano invisibili.

Il controllo guarda tre cose:

| Controllo           | Quando scatta l'avviso                               | Perché conta                                                                                                      |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Chiave della prova  | `public.has_consent_evidence_key()` risponde `false` | Ogni account eliminato senza chiave resta senza prova dei consensi, per sempre                                    |
| Errori dei lavori   | Errori sopra 0 in 3 giri di fila (3 ore)             | Un account che fallisce sempre non viene mai eliminato; con 200 fallimenti fissi si fermano anche tutti gli altri |
| Lavoro che non gira | Nessun giro registrato nelle ultime 2 ore            | `pg_cron` fermo o database in pausa: non si elimina niente                                                        |

Un errore singolo non fa scattare l'avviso: il giro dopo riprova da solo.

## Come funziona (quando sarà costruito)

1. Alla fine di ogni giro, il database scrive in una tabella privata quando ha girato, quanti errori ha avuto e se la chiave c'era.
2. Una funzione del database riassume la tabella in tre risposte sì o no, una per controllo. Le soglie stanno solo lì.
3. Una rotta del server su Vercel, protetta da un segreto dedicato, chiama quella funzione con la chiave amministrativa e risponde «tutto bene» (200) o «qualcosa non va» (503), con il nome del controllo fallito.
4. Un workflow di GitHub Actions chiama la rotta ogni ora, al minuto 37 (mezz'ora dopo il giro). Se la risposta non è 200, o la rotta non risponde, il workflow fallisce e apre una issue con etichetta `allarme`. Se una issue `allarme` è già aperta non ne apre un'altra.

Il controllo fa anche da controllo esterno che l'app risponda: se Vercel o Supabase sono giù, l'avviso arriva lo stesso.

## Chi riceve l'avviso

- **Francesco:** notifica di GitHub per la issue `allarme` (mail e app di GitHub sul telefono). Deve seguire il repository (pulsante **Watch** in alto nella pagina del repository, scelta **All Activity** oppure **Custom › Issues**).
- **Coordinatore:** al giro successivo (ogni 2-3 ore) vede la issue `allarme` e la assegna.

La issue `allarme` è pubblica: contiene solo il nome del controllo fallito e l'ora. Mai indirizzi, id, nomi, messaggi d'errore del database o dettagli tecnici.

## Cosa fare quando arriva l'avviso

### «Chiave della prova»

1. Francesco: nel pannello di Supabase, **SQL Editor**, esegui `select public.has_consent_evidence_key();`.
2. Se risponde `false`, ricrea il segreto `consent_evidence_hmac_key` nel Vault con il valore attivo conservato nel gestore di password. I passi sono in `chiave-prova-consensi.md` («Dopo un ripristino del database»).
3. Esegui di nuovo la query: deve rispondere `true`.
4. Scrivi al coordinatore da quando mancava la chiave (l'ora della issue): gli account eliminati in quel periodo non hanno la prova, e lo deve sapere l'agente `legale-privacy`.

### «Errori dei lavori»

1. Francesco: nel pannello di Supabase, **Logs › Postgres**, cerca `account job`. Ogni riga dice solo quale passo è fallito e il codice d'errore (SQLSTATE), mai dati personali.
2. Scrivi al coordinatore il passo e il codice. Il coordinatore apre una issue `richiesta-db` per l'`architetto-dati`, senza copiare i log.
3. Finché non è corretto, le eliminazioni di quell'account restano in attesa: la richiesta non si perde e il giro dopo riprova.

### «Lavoro che non gira»

1. Controlla la pagina di stato di Supabase e se il progetto è in pausa (pannello, pagina del progetto). Un progetto in pausa si riattiva con **Restore project**.
2. Se il progetto è attivo, nel pannello **Integrations › Cron** controlla che il lavoro `account-jobs` esista e sia attivo. Se manca, il coordinatore apre una issue `richiesta-db`.

### La rotta non risponde

Controlla le pagine di stato di Vercel e Supabase. Se sono verdi, il coordinatore guarda gli errori del progetto su Vercel. Se un fornitore è giù, si aspetta: i lavori riprendono da soli al primo giro utile.

## Pezzi da costruire

| Pezzo                                                                                                   | Chi                                             | Dove                                   |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Tabella dei giri (pulizia oltre 30 giorni), scrittura a fine giro, funzione di riepilogo `service_role` | `architetto-dati`                               | branch `db/*`, con test pgTAP          |
| Rotta del server protetta e lettura del segreto in `src/lib/env.ts`                                     | `sviluppatore`, con issue `richiesta-condivisa` | `src/app/api/`, `src/lib/env.ts`       |
| Workflow orario ed etichetta `allarme`                                                                  | coordinatore                                    | branch `admin/*`, `.github/workflows/` |
| Segreto del monitoraggio su Vercel e su GitHub; Watch del repository                                    | Francesco                                       | pannelli di Vercel e GitHub            |

Costo: nessuno. Il repository è pubblico, quindi i minuti di GitHub Actions sui runner standard sono gratuiti. Se il repository tornasse privato, il controllo orario userebbe circa 720 minuti al mese sui 2.000 del piano gratuito: in quel caso si passa a un controllo ogni 3 ore.

Nota: GitHub sospende i workflow programmati di un repository pubblico dopo 60 giorni senza attività. In fase di build non succede; dopo il lancio va tenuto d'occhio.
