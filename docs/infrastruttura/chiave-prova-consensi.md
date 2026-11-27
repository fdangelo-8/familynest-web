# Chiave della prova dei consensi: custodia e rotazione

Procedura operativa dell'agente `infrastruttura` (#660). Riguarda il segreto `consent_evidence_hmac_key` (la chiave attiva) e i segreti `consent_evidence_hmac_key_previous_AAAAMMGG` (le chiavi precedenti, dopo una rotazione) nel Vault di Supabase (progetto `yksosqvugiempsldejyt`). Questo documento non contiene e non deve mai contenere il valore di una chiave.

## A cosa serve

Quando un account viene eliminato, il database conserva per 5 anni una prova minima dei consensi dati (#513, #657). La prova non contiene la mail: contiene un'impronta della mail (HMAC-SHA256) calcolata con questa chiave. Se arriva un reclamo con un indirizzo, l'amministratore del database calcola di nuovo l'impronta con la stessa chiave e ritrova le righe.

Fonti nel codice:

- `private.consent_hmac()` (migrazione `20261127212735_account_jobs_monitoring_functions.sql`) è l'unica regola dell'impronta: mail in minuscolo e senza spazi, HMAC-SHA256 con la chiave che riceve.
- `private.consent_subject_hmac()` (stessa migrazione) calcola l'impronta con la chiave attiva, cioè il segreto più recente con nome esattamente `consent_evidence_hmac_key`. È l'unica usata per scrivere la prova.
- `private.previous_consent_subject_hmacs()` (stessa migrazione) calcola l'impronta con ogni chiave precedente del Vault, cioè ogni segreto non vuoto con nome `consent_evidence_hmac_key_previous_AAAAMMGG` (8 cifre). Ogni altro nome viene ignorato. Serve solo per la ricerca, mai per scrivere.
- `private.find_consent_evidence()` (stessa migrazione) cerca le prove con la chiave attiva e con tutte le chiavi precedenti. Senza la chiave attiva si ferma con un errore, anche se ci sono chiavi precedenti: una ricerca senza la chiave attiva perderebbe tutte le prove salvate dopo l'ultima rotazione e sembrerebbe completa.
- `public.has_consent_evidence_key()` (migrazione `20261127202206_account_jobs_robust_functions.sql`) risponde solo vero o falso: la chiave attiva c'è ed è utilizzabile. Non controlla le chiavi precedenti.

## Cosa succede se la chiave manca

Le eliminazioni degli account vanno avanti comunque (prima viene il diritto all'oblio), ma la prova di quell'account non viene salvata. Ogni account eliminato mentre la chiave manca resta senza prova, per sempre. Per questo il monitoraggio controlla la chiave ogni ora (vedi `avvisi-lavori-account.md`).

## Cosa succede alla rotazione

Il database scrive sempre con la chiave attiva e cerca con la chiave attiva e con tutte le chiavi precedenti salvate nel Vault. Cambiare la chiave ha questo effetto:

- le prove salvate dopo la rotazione hanno l'impronta della chiave nuova e si ritrovano normalmente;
- le prove salvate prima restano nel database fino alla loro scadenza (5 anni) con l'impronta della chiave vecchia. Le impronte non si possono ricalcolare con la chiave nuova: servirebbero le mail, che dopo l'eliminazione non esistono più;
- la ricerca ritrova anche le prove vecchie **solo se** la chiave vecchia è salvata nel Vault con il nome `consent_evidence_hmac_key_previous_AAAAMMGG` (AAAAMMGG è l'ultimo giorno in cui era attiva, solo cifre: per esempio `consent_evidence_hmac_key_previous_20261127`). Se manca, o ha un nome diverso, quelle prove diventano introvabili.

Per questo la procedura di rotazione salva la chiave vecchia nel Vault prima di cambiare quella attiva, e la tiene anche nel gestore di password.

**Regola:** la chiave non si ruota a scadenza fissa. Si ruota solo se è stata esposta o si sospetta che lo sia. Ogni rotazione aggiunge una chiave precedente da custodire per 5 anni, nel Vault e nel gestore di password: se se ne perde una, si perdono le prove salvate con quella. Una rotazione senza motivo aggiunge questo rischio e non porta vantaggi: la chiave da sola non basta a leggere niente, serve anche l'accesso al database.

## Custodia (da fare una volta, Francesco)

Il valore della chiave deve esistere anche fuori da Supabase. Un ripristino del database in un progetto nuovo potrebbe non riuscire a decifrare i segreti del Vault (la documentazione di Supabase avverte che la chiave di cifratura del Vault va portata a parte). Senza una copia, tutte le prove salvate diventerebbero introvabili.

1. Apri il gestore di password che usi per FamilyNest.
2. Crea una voce «FamilyNest – chiave prova consensi – attiva dal GG/MM/AAAA».
3. Nel pannello di Supabase apri il progetto, poi **Integrations › Vault** (se non lo trovi, cerca «Vault» nella barra di ricerca del pannello), scheda **Secrets**.
4. Sulla riga `consent_evidence_hmac_key` scegli di mostrare il valore, copialo nella voce del gestore di password e salva.
5. Non incollarlo da nessun'altra parte: niente chat, issue, PR, mail, note del telefono.

## Rotazione (solo se la chiave è stata esposta)

Prima di cominciare: se pensi che sia stato esposto anche il database, o la chiave segreta di Supabase, non è solo una rotazione. Avvisa subito il coordinatore: serve anche la procedura di violazione dei dati, con l'agente `legale-privacy` (non ancora scritta: andrà in `docs/legale/violazioni.md`).

1. **Conserva la chiave vecchia nel gestore di password.** Rinomina la voce attuale in «FamilyNest – chiave prova consensi – usata dal GG/MM/AAAA al GG/MM/AAAA (vecchia)». Non cancellarla: serve per ritrovare le prove salvate fino a oggi, per 5 anni, anche dopo un ripristino.
2. **Salva la chiave vecchia nel Vault con il suo nome.** Nel pannello di Supabase: **Integrations › Vault › Secrets**, pulsante **Add new secret** (Aggiungi segreto).
   - Nome: `consent_evidence_hmac_key_previous_AAAAMMGG`, dove AAAAMMGG è l'ultimo giorno in cui la chiave vecchia è attiva, cioè oggi, solo cifre (per esempio `consent_evidence_hmac_key_previous_20261127`). Niente spazi, trattini o altri caratteri: con un nome diverso il database la ignora.
   - Valore: copia il valore dalla voce «(vecchia)» del gestore di password e incollalo.
   - Salva. Non usare l'editor SQL per questo passo: il valore resterebbe nella cronologia delle query.
   - Controlla nell'elenco dei segreti che la riga nuova ci sia e che il nome sia scritto esattamente così. Non toccare ancora la riga `consent_evidence_hmac_key`.
3. **Crea il valore nuovo.** Nel gestore di password genera una password casuale di 64 caratteri, solo lettere e numeri. Salvala in una voce nuova «FamilyNest – chiave prova consensi – attiva dal GG/MM/AAAA».
4. **Sostituisci la chiave attiva nel Vault.** Nel pannello di Supabase: **Integrations › Vault › Secrets**, riga `consent_evidence_hmac_key`, menu della riga, **Edit** (Modifica). Incolla il valore nuovo nel campo del segreto. Il nome deve restare esattamente `consent_evidence_hmac_key`. Salva. Anche qui, niente editor SQL.
5. **Verifica.** Nel pannello: **SQL Editor**, nuova query, scrivi `select public.has_consent_evidence_key();` ed esegui. Deve rispondere `true`. Se risponde `false`, ripeti il passo 4: il campo era vuoto o il nome era diverso. Questa verifica controlla solo la chiave attiva: per la chiave vecchia vale il controllo del nome fatto al passo 2.
6. **Annota la data.** Scrivi al coordinatore (non in una issue pubblica) soltanto: «chiave della prova ruotata il GG/MM/AAAA». La data serve per sapere quali prove sono state salvate con la chiave vecchia.
7. **Avvisa l'agente `legale-privacy`.** Le prove salvate prima di quella data si ritrovano solo finché il segreto `consent_evidence_hmac_key_previous_AAAAMMGG` resta nel Vault: è un fatto da sapere quando arriva un reclamo. Il segreto non si cancella per 5 anni dalla rotazione.

Tempo: circa 20 minuti. Costo: nessuno.

## Dopo un ripristino del database

Dopo ogni ripristino da backup, nello stesso progetto o in uno nuovo:

1. Esegui il passo 5 della rotazione. Se risponde `false`, ricrea il segreto `consent_evidence_hmac_key` nel Vault con il valore **attivo** conservato nel gestore di password (non uno nuovo), poi ripeti la verifica.
2. Controlla anche le chiavi precedenti, perché `public.has_consent_evidence_key()` controlla solo quella attiva. Nel pannello: **Integrations › Vault › Secrets**. Per ogni voce «(vecchia)» del gestore di password deve esserci una riga `consent_evidence_hmac_key_previous_AAAAMMGG`, con AAAAMMGG uguale all'ultimo giorno di attività scritto nella voce. Se una manca, ricreala come al passo 2 della rotazione, con il valore di quella voce. Se dopo un ripristino in un progetto nuovo il Vault non riesce a decifrare i segreti, ricreale tutte.

Senza il punto 2 le prove salvate prima dell'ultima rotazione restano nel database ma la ricerca non le ritrova, e nessun avviso lo segnala.
