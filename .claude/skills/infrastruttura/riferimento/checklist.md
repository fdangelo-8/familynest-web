# Checklist dell'infrastruttura

Per ogni voce verifica lo stato reale con gli strumenti, la documentazione ufficiale attuale dei fornitori o il codice. Non presumere.

## Supabase

- [ ] Piano attuale e suoi limiti: database, spazio, traffico, utenti attivi, sospensione dei progetti inattivi sul piano gratuito.
- [ ] Backup: quali sono inclusi nel piano, conservazione, ripristino a un momento preciso; i file dello Storage non sono nei backup del database.
- [ ] Regione del progetto (dati nell'UE) e regione delle funzioni di Vercel vicina.
- [ ] Consigli `performance` e `security` senza voci ERROR; i WARN valutati.
- [ ] Indici sulle colonne usate nei filtri delle policy e delle query più frequenti (`household_id` e simili).
- [ ] Connessioni: pooling per le funzioni serverless.
- [ ] Tabelle con dati che scadono (inviti, token, code, notifiche): esiste la pulizia?
- [ ] Email di Auth: con il servizio integrato i limiti di invio sono molto bassi e i destinatari possono essere limitati. Per utenti veri serve un SMTP proprio con dominio verificato.
- [ ] Chiavi: nuovo sistema publishable/secret; chiavi vecchie (legacy) disattivate quando il codice non le usa.

## Vercel

- [ ] Piano attuale e uso commerciale ammesso: il piano gratuito è per uso non commerciale, quindi va valutato prima di far pagare Plus.
- [ ] Regione delle funzioni, durata e memoria; avvii a freddo.
- [ ] Errori e log: per quanto tempo restano; serve un servizio di raccolta errori con avvisi?
- [ ] Variabili: separate per Production, Preview e Development; i segreti segnati come Sensitive; le anteprime non usano dati reali.
- [ ] Protezione delle anteprime.
- [ ] Firewall e limiti di richieste sulle rotte pubbliche e di accesso.
- [ ] Dominio definitivo, HTTPS, redirect dal dominio vercel.app.

## Monitoraggio

- [ ] Controllo esterno che l'app e le pagine principali rispondano, con avviso a Francesco.
- [ ] Avviso sugli errori del server oltre una soglia.
- [ ] Iscrizione agli aggiornamenti di stato di Supabase, Vercel, GitHub e del provider email.

## GitHub Actions

- [ ] Minuti usati rispetto al piano; job lenti da ottimizzare.
- [ ] Migrazioni applicate in produzione solo da `main`, con il segreto del database limitato a quel job.
- [ ] Versioni delle actions aggiornate (Dependabot) e, per i job con credenziali, fissate allo SHA del commit.

## Costi

- [ ] Tabella dei costi attuali per fornitore.
- [ ] Stima per 100, 1.000 e 10.000 famiglie, con i punti in cui un piano gratuito non basta più.
- [ ] Avvisi di spesa impostati dove il fornitore li offre.

## Procedure in `docs/infrastruttura/`

- [ ] Ripristino del database e dei file, provato almeno una volta.
- [ ] Guasto di un fornitore: cosa vede l'utente, cosa si fa.
- [ ] Chiave compromessa: rotazione passo per passo.
- [ ] Violazione di dati: parte tecnica, insieme a `docs/legale/violazioni.md`.
