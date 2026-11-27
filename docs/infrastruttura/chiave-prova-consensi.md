# Chiave della prova dei consensi: custodia e rotazione

Procedura operativa dell'agente `infrastruttura` (#660). Riguarda il segreto `consent_evidence_hmac_key` nel Vault di Supabase (progetto `yksosqvugiempsldejyt`). Questo documento non contiene e non deve mai contenere il valore della chiave.

## A cosa serve

Quando un account viene eliminato, il database conserva per 5 anni una prova minima dei consensi dati (#513, #657). La prova non contiene la mail: contiene un'impronta della mail (HMAC-SHA256) calcolata con questa chiave. Se arriva un reclamo con un indirizzo, l'amministratore del database calcola di nuovo l'impronta con la stessa chiave e ritrova le righe.

Fonti nel codice:

- `private.consent_subject_hmac()` (migrazione `20261127191120_account_privacy_2_functions_and_triggers.sql`) usa sempre il segreto più recente con quel nome.
- `private.find_consent_evidence()` (stessa migrazione) usa la stessa funzione per la ricerca.
- `public.has_consent_evidence_key()` (migrazione `20261127202206_account_jobs_robust_functions.sql`) risponde solo vero o falso: la chiave c'è ed è utilizzabile.

## Cosa succede se la chiave manca

Le eliminazioni degli account vanno avanti comunque (prima viene il diritto all'oblio), ma la prova di quell'account non viene salvata. Ogni account eliminato mentre la chiave manca resta senza prova, per sempre. Per questo il monitoraggio controlla la chiave ogni ora (vedi `avvisi-lavori-account.md`).

## Cosa succede alla rotazione

Oggi il database conosce una sola chiave. Cambiarla ha questo effetto:

- le prove salvate prima restano nel database fino alla loro scadenza (5 anni), ma **la ricerca normale non le ritrova più**, perché l'impronta calcolata con la chiave nuova è diversa;
- le impronte non si possono ricalcolare con la chiave nuova: servirebbero le mail, che dopo l'eliminazione non esistono più;
- le prove salvate dopo la rotazione si ritrovano normalmente.

Le prove vecchie si possono ancora ritrovare solo se il valore della chiave vecchia è stato conservato. Finché il database non sa cercare anche con le chiavi precedenti (lavoro aperto per l'`architetto-dati`, vedi in fondo), la ricerca con la chiave vecchia va fatta a mano dall'amministratore del database, con l'aiuto dell'architetto-dati.

**Regola:** la chiave non si ruota a scadenza fissa. Si ruota solo se è stata esposta o si sospetta che lo sia. Una rotazione senza motivo fa perdere la ricerca delle prove vecchie e non porta vantaggi: la chiave da sola non basta a leggere niente, serve anche l'accesso al database.

## Custodia (da fare una volta, Francesco)

Il valore della chiave deve esistere anche fuori da Supabase. Un ripristino del database in un progetto nuovo potrebbe non riuscire a decifrare i segreti del Vault (la documentazione di Supabase avverte che la chiave di cifratura del Vault va portata a parte). Senza una copia, tutte le prove salvate diventerebbero introvabili.

1. Apri il gestore di password che usi per FamilyNest.
2. Crea una voce «FamilyNest – chiave prova consensi – attiva dal GG/MM/AAAA».
3. Nel pannello di Supabase apri il progetto, poi **Integrations › Vault** (se non lo trovi, cerca «Vault» nella barra di ricerca del pannello), scheda **Secrets**.
4. Sulla riga `consent_evidence_hmac_key` scegli di mostrare il valore, copialo nella voce del gestore di password e salva.
5. Non incollarlo da nessun'altra parte: niente chat, issue, PR, mail, note del telefono.

## Rotazione (solo se la chiave è stata esposta)

Prima di cominciare: se pensi che sia stato esposto anche il database, o la chiave segreta di Supabase, non è solo una rotazione. Avvisa subito il coordinatore: serve anche la procedura di violazione dei dati, con l'agente `legale-privacy` (non ancora scritta: andrà in `docs/legale/violazioni.md`).

1. **Conserva la chiave vecchia.** Nel gestore di password rinomina la voce attuale in «FamilyNest – chiave prova consensi – usata dal GG/MM/AAAA al GG/MM/AAAA (vecchia)». Non cancellarla: serve per ritrovare le prove salvate fino a oggi, per 5 anni.
2. **Crea il valore nuovo.** Nel gestore di password genera una password casuale di 64 caratteri, solo lettere e numeri. Salvala in una voce nuova «FamilyNest – chiave prova consensi – attiva dal GG/MM/AAAA».
3. **Sostituisci il valore nel Vault.** Nel pannello di Supabase: **Integrations › Vault › Secrets**, riga `consent_evidence_hmac_key`, menu della riga, **Edit** (Modifica). Incolla il valore nuovo nel campo del segreto. Il nome deve restare esattamente `consent_evidence_hmac_key`. Salva. Non usare l'editor SQL per questo passo: il valore resterebbe nella cronologia delle query.
4. **Verifica.** Nel pannello: **SQL Editor**, nuova query, scrivi `select public.has_consent_evidence_key();` ed esegui. Deve rispondere `true`. Se risponde `false`, ripeti il passo 3: il campo era vuoto o il nome era diverso.
5. **Annota la data.** Scrivi al coordinatore (non in una issue pubblica) soltanto: «chiave della prova ruotata il GG/MM/AAAA». La data serve per sapere quali prove richiedono la chiave vecchia.
6. **Avvisa l'agente `legale-privacy`.** Le prove salvate prima di quella data si ritrovano solo con la chiave vecchia: è un fatto da sapere quando arriva un reclamo.

Tempo: circa 15 minuti. Costo: nessuno.

## Dopo un ripristino del database

Dopo ogni ripristino da backup, nello stesso progetto o in uno nuovo, esegui il passo 4 della rotazione. Se risponde `false`, ricrea il segreto `consent_evidence_hmac_key` nel Vault con il valore **attivo** conservato nel gestore di password (non uno nuovo), poi ripeti la verifica.

## Lavoro aperto

- **Ricerca anche con le chiavi precedenti** (`architetto-dati`, prima del lancio): permettere a `private.find_consent_evidence()` di provare, oltre alla chiave attiva, le chiavi vecchie conservate nel Vault con un nome a parte (per esempio con un suffisso di data). La scrittura resta sempre sulla chiave attiva. Fatto questo, il passo 1 della rotazione diventa «crea nel Vault un segreto con il nome della chiave vecchia e il valore vecchio», e la ricerca a mano non serve più.
