# #546 · A13 Il tuo Nest, membri, scheda adulto, invito · dettagli del requisito

Dettagli della issue #546 (analista, 26/11/2026). Nella issue ci sono le regole che decidono i CA; qui testi completi, tabelle dei casi e dati. Se issue e file si contraddicono, vale la issue. Dove questo file decide qualcosa che il design non dice è segnato **(default)** e la domanda è nella issue.

Fonti: `docs/design/telefono/app-fase-b/cb1-15`–`cb1-17`, `cb1-20`–`cb1-22` (Passo 6, valgono sul telefono), `animali/4-10` (Passo 5, solo per gli animali con la foto), `funzioni-fase-c/cc1-23` (aiutanti, fuori perimetro), `avvio/2-di-4-*` e `avvio/4-di-4-invita-laura` (foglio per aggiungere, codice da inquadrare); `docs/design/computer/il-tuo-impostazioni-notifiche/01`–`03` (Passo 11); risposte 18, 19, 28, 76, 123, 140, 141, 178 di `decisioni-fable.md`, «In attesa del Passo 12» (correzione 2) di `docs/design/computer/LEGGIMI.md`; specifiche 196 (§5 colori), 502 (nome), 503, 504 (§4 iniziali), 505 (foglio, dialogo), 506 (rotte); codice di oggi in `src/app/(app)/nest/`, `src/app/(app)/membri/[id]/`, `src/components/membri/`, `src/lib/member-texts.ts`.

## §1 Chi può fare che cosa

«Organizza» = `household_members.is_admin = true`. «In coppia» = nel Nest ci sono esattamente due adulti con account e nessun figlio, animale o invito in attesa (come `cb1-17`) **(default)**.

| Azione                                                                   | Chi organizza                                                                          | Altro adulto                       | Regola del database oggi                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Vedere la pagina, «Chi c'è», i conteggi, le righe in fondo               | sì                                                                                     | sì                                 | `household_members_select`: solo il proprio Nest                                           |
| «Invita una persona»                                                     | sì                                                                                     | non lo vede                        | `invitations_insert` e insert di adulti: solo `is_admin`                                   |
| Vedere data e validità dell'invito, «Manda di nuovo», «Annulla l'invito» | sì                                                                                     | no: vede nome e «Invito in attesa» | `invitations_select`: solo `is_admin`                                                      |
| «Aggiungi un figlio o un animale»                                        | sì                                                                                     | sì                                 | insert di `child` e `pet`: ogni adulto                                                     |
| Cambiare il ruolo di un altro adulto («Cambia»)                          | sì, non in coppia                                                                      | no                                 | trigger `household_members_guard_update`: solo `is_admin`; mai senza nessuno che organizza |
| «Togli <nome>» di un altro adulto con account                            | sì, non in coppia (risposta 19)                                                        | no                                 | `household_members_delete`: `is_admin`                                                     |
| Togliere se stessi                                                       | no da qui: «Esci dalla casa» è di A19 #552                                             | —                                  | —                                                                                          |
| Scegliere il colore di chi si invita                                     | sì, solo nell'invito                                                                   | —                                  | colore unico nel Nest (`household_members_household_color_key`)                            |
| Cambiare il colore di un altro adulto                                    | no in A13 **(default)**: lo cambia l'adulto nel suo profilo (A17) o all'ingresso (A22) | no                                 | il database lo permetterebbe a chi organizza: la pagina non lo offre                       |

## §2 Pagina «Il tuo Nest» (`/nest`)

Titolo `h1` «Il tuo Nest» dal componente unico del nome (F3 #502). Sotto, la riga del Nest.

### Riga sotto il titolo

`<nome>` = `households.name` (per «Casa Bianchi», risposta 76; come si compila lo decide A21). Conteggi: persone = adulti con account + figli; animali = `kind = pet`; inviti = adulti senza account.

| Caso                 | Testo                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| solo tu, nient'altro | «Casa Bianchi · per ora ci sei solo tu»                                                                                                         |
| in coppia            | «Marco e Laura · in due» (tu per primo)                                                                                                         |
| tutti gli altri      | «Casa Bianchi · 3 persone, 2 animali, 1 invito in attesa»; le parti a zero spariscono; singolari «1 persona», «1 animale», «1 invito in attesa» |

### Ordine e righe di «Chi c'è»

Ordine **(default)**: tu; gli altri adulti con account; i figli; gli animali; ogni gruppo per `created_at`, poi `id`. Gli adulti senza account stanno solo in «In attesa». Pallino con le iniziali di `memberInitials` (504 §4) calcolate su **tutti** i membri del Nest, invitati compresi («Mi» per Miele anche sul telefono, default 4 del piano). Animale con foto (A25a): foto con il filo del colore (`ring`); senza foto: iniziali.

| Chi          | Riga sotto il nome (forme neutre)                                                      | Dove porta                                                                  |
| ------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| tu           | «Tu»                                                                                   | `/profilo` (A17)                                                            |
| altro adulto | nessuna (`cb1-17`, `cc1-23`)                                                           | `/membri/<id>` (scheda, §4)                                                 |
| figlio       | «9 anni» (`formatAge`); senza data nessuna riga                                        | `/figli/<id>` (A14)                                                         |
| animale      | specie e età se note («Cane · 4 anni»), solo specie («Gatto»), senza profilo «Animale» | profilo dell'animale di A25a; finché A25a non c'è, `/membri/<id>` come oggi |

Niente «Figlia», «Figlio», «Adulta», «amministratore» nelle righe (forme neutre; le tavole che li mostrano valgono per la forma, non per le parole).

### «In attesa»

Gruppo a parte sotto «Chi c'è», con titolo «In attesa» (computer: con il numero). La riga non è un link.

| Stato dell'invito                                  | Riga sotto il nome                           | Azioni                               |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| valido                                             | «Invito mandato ieri · vale ancora 6 giorni» | «Manda di nuovo», «Annulla l'invito» |
| scaduto                                            | «Invito scaduto» **(default)**               | «Manda di nuovo», «Annulla l'invito» |
| nessun invito (adulti aggiunti col vecchio modulo) | «Invito non ancora mandato» **(default)**    | «Manda l'invito», «Annulla l'invito» |
| visto da chi non organizza                         | «Invito in attesa» **(default)**             | nessuna                              |

- «mandato oggi» / «ieri» / «il 12 novembre» (anno solo se diverso), dal `created_at` dell'invito a Roma.
- «vale ancora N giorni» con N = **giorni di calendario a Roma** tra oggi e il giorno di `expires_at` (come `expiryLead` della pagina dell'invito e `formatValidity` di #618, C3); N = 1 → «vale ancora 1 giorno»; nel giorno della scadenza «vale fino a oggi alle HH:MM»; scaduto → riga «Invito scaduto». Così la tavola torna: invito di 7 giorni mandato ieri → «mandato ieri · vale ancora 6 giorni». Il cambio d'ora non cambia N. La regola di prima («24 ore arrotondate per eccesso») è superata (analisi di #618, decisione 3).
- Sotto le azioni, solo per chi organizza: «Finché <nome> non entra non vede niente. Il suo colore, <colore con articolo>, è già tenuto da parte.» Articoli: il corallo, il glicine, la menta, il blu, il rosa, l'azzurro, la sabbia, l'ardesia, l'ambra, la cannella.

### Righe in fondo (telefono, non nello stato «solo tu»)

| Riga                  | Sotto                                                                                                                                                       | Dove                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| «Impostazioni»        | «Notifiche, privacy, aspetto»                                                                                                                               | `/impostazioni` (A18)                              |
| «Calendari collegati» | «Google di Laura, Outlook di Marco» (un servizio per adulto con calendari accesi, tu per ultimo come nel design **(default)**); nessuno: nessuna riga sotto | `/calendari-collegati` (A12)                       |
| «Il vostro piano»     | —                                                                                                                                                           | non si mostra finché non c'è Plus (pagamenti dopo) |

Stato «in coppia»: sotto «Chi c'è» la frase «In due siete alla pari: ognuno può cambiare le impostazioni.» **(default, forma neutra di `cb1-17`)**, solo se tutti e due organizzano; in fondo «Se la famiglia cresce» con «Aggiungi un figlio o un animale: compaiono chi porta e chi riprende, la scuola, le liste dei desideri. Non si perde niente di quello che avete già.» e il pulsante «Aggiungi un figlio o un animale».

Stato «solo tu» (`cb1-15`): riquadro con l'icona delle persone, «Per ora ci sei solo tu» e «Invita chi vive con te: riceve un link ed entra. I figli e gli animali si aggiungono senza invito, li gestite voi.»; poi «Invita una persona» (livello 1) e «Aggiungi un figlio o un animale» (livello 2). Nessuna riga in fondo.

Altri stati: dopo le righe, «Invita una persona» (solo chi organizza) e «Aggiungi un figlio o un animale»; posizione e livello li conferma il designer (le tavole sono tagliate a 844 px) **(default)**.

### Computer (1280, `01`, `02`)

Soglie di D8 (`docs/design/tablet/decisioni.md`, risposta 214): in questo file «telefono» vale per la finestra fino a 899 px **o** alta meno di 600 px; «computer» da 900 px e alta almeno 600, con la barra a icone da 900 a 1279 px e quella intera da 1280. Tablet: in verticale (768–834 px) le righe del telefono in una colonna di 640 px al centro (`docs/design/tablet/verticale/14`); in orizzontale (1024–1194 px) le tessere del computer, sempre quattro per riga (`docs/design/tablet/orizzontale/05`; `TileGrid columns={4}` di 504 §2). Con il dito ogni comando ha l'area di 44 × 44 px, compreso il + di «Animali» e i pulsanti sotto la tessera in attesa (risposta 217).

- Barra in alto: «Il tuo Nest» con la riga del Nest accanto, Cerca, campanella, e «Invita una persona» (livello 1, solo chi organizza).
- «Chi c'è <n>» (titolo come `02` e come il telefono **(default)**; `01` dice «Persone»): tessere, quattro per riga, pallino grande, nome, riga sotto come sul telefono. Clic: stessa destinazione.
- «In attesa <n>»: tessera tratteggiata, azioni e frase sotto.
- «Animali <n>» con il + a filo a destra: apre il foglio per aggiungere con «Animale» già scelto.
- In fondo «Impostazioni del Nest» con «Chi organizza, aspetto, notifiche, privacy» → `/impostazioni`. La riga «Calendari collegati» non c'è (come `01`).
- «Aggiungi un figlio o un animale» su computer: dal + di «Animali», con le due scelte **(default)**.

## §3 Invito

### Modulo «Chi vuoi invitare?» (`cb1-21`; computer `03`)

Telefono: foglio a tutta altezza sopra `/nest` (`Sheet` di F4c), X a sinistra, titolo «Invita una persona», nessuna rotta nuova **(default)**. Computer: finestra al centro, titolo «Chi vuoi invitare?», X a destra.

| Parte                             | Regola                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testo                             | «Riceve un link, sceglie come entrare ed è in casa. Non serve che abbia già l'app.»                                                                                                                                                                                                                                                                                             |
| «Come si chiama»                  | obbligatorio; spazi iniziali, finali e doppi tolti; massimo 40 caratteri (il campo non accetta oltre; vincolo `household_members_name_length`); fuoco all'apertura                                                                                                                                                                                                              |
| «Il suo colore»                   | i 10 colori nell'ordine Corallo, Glicine, Menta, Blu, Rosa, Azzurro, Sabbia, Ardesia, Ambra, Cannella (come `avvio/scegli-il-tuo-colore`; `cb1-21` ne mostra 8) **(default)**; quelli già presi (anche dagli invitati) sono spenti, con le iniziali di chi li ha, non sceglibili, nome «Corallo, già di Marco» **(default)**; scelto all'apertura il primo libero **(default)** |
| Aiuto sotto i colori              | «Potrà cambiarlo quando entra, tra quelli liberi.» **(default, forma neutra di «Lo potrà cambiare lei»)**                                                                                                                                                                                                                                                                       |
| Sotto il pulsante                 | «Il link vale 7 giorni e per una persona sola.» (computer: nella stessa riga dell'aiuto)                                                                                                                                                                                                                                                                                        |
| «La sua mail, se la mandi da qui» | solo computer e solo con la mail accesa (§3 Mail)                                                                                                                                                                                                                                                                                                                               |
| «Manda l'invito»                  | controlla, chiama `invite_adult` (richiesta-db R1), poi telefono: apre «Manda l'invito a <nome>»; computer: vedi tabella sotto                                                                                                                                                                                                                                                  |

Errori (sotto il campo, fuoco sul primo):

| Caso                               | Testo                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| nome vuoto                         | «Scrivi il nome per continuare.» (`MEMBER_NAME_ERROR`)                                        |
| colore preso nel frattempo (23505) | «Questo colore l'ha appena preso qualcun altro: scegline un altro.»; il colore si spegne      |
| Nest con 10 membri (P0001)         | «Il Nest è al completo: ci stanno al massimo 10 tra persone e animali.»                       |
| rete                               | «Non siamo riusciti a preparare l'invito. Controlla la connessione e riprova.»                |
| server                             | «Non siamo riusciti a preparare l'invito per un problema nostro. Riprova tra qualche minuto.» |

Con il Nest già a 10, «Invita una persona» non apre il modulo e mostra l'avviso in basso con il testo del Nest al completo **(default)**.

Computer, piede della finestra:

| Comando            | Mail accesa                                                                                              | Mail spenta (finché F9 #509 e B4 #563 non sono uniti)                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| «Copia il link»    | crea l'invito (una volta sola) e copia il link; avviso «Link copiato. Mandalo a <nome> dove preferisci.» | uguale                                                                                  |
| «Mostra il codice» | crea l'invito e mostra il codice da inquadrare                                                           | uguale                                                                                  |
| «Annulla»          | chiude senza creare nulla                                                                                | uguale                                                                                  |
| «Manda l'invito»   | richiede la mail; crea l'invito e manda la mail; avviso «Invito mandato a <nome>.»                       | il campo mail non c'è; crea l'invito e copia il link come «Copia il link» **(default)** |

Dopo la creazione la finestra si chiude solo con «Manda l'invito»; con «Copia il link» e «Mostra il codice» resta aperta sull'invito creato (un secondo clic non ne crea un altro).

### Foglio «Manda l'invito a <nome>» (`cb1-22`, solo telefono)

- «Il tuo messaggio»: area di testo già scritta «Ciao <nome>, ti invito in casa nostra su <NomeApp>: calendario, spesa e cose da fare in un posto solo. Entra da qui:» (nome dell'app da F3), modificabile, massimo 280 caratteri; sotto il testo il segno non modificabile «link dell'invito». Il messaggio **non si salva** (non va in `invitations.message`).
- Righe: «WhatsApp» → `https://wa.me/?text=<messaggio + spazio + link>`; «Messaggi» → `sms:?&body=<messaggio + spazio + link>`; «Mail» (solo con la mail accesa) → mostra il campo «La sua mail» e «Manda» **(default)**; «Copia il link» → copia solo il link, avviso «Link copiato. Mandalo a <nome> dove preferisci.»; «Mostra il codice da inquadrare» / «Se è qui accanto a te» → vista del codice.
- Dopo WhatsApp, Messaggi, Mail e Copia il foglio si chiude e `/nest` mostra la persona in «In attesa» **(default)**. X chiude: l'invito resta.
- La pagina `/invito/<token>`, come tutte le pagine senza account, **segue il tema del sistema** (`data-aspetto="sistema"`: chiara o scura secondo il telefono o il computer; D7 e tavola dell'accesso al buio `computer/accesso-profilo-impostazioni-p12-16/03-accesso-scuro`; decisione 3 di #623). Il codice QR resta scuro su bianco anche al buio (decisione 4 di #618).
- Link = `<origine dell'app>/invito/<token>`. Il token non va mai in log, analytics, indirizzi della pagina, né a chi non organizza.

### Codice da inquadrare

Codice QR del solo link, con «<nome> inquadra il codice con il telefono. Vale ancora N giorni.» **(default**: il codice a numeri di `4-di-4` non esiste più, tolto con `invitations_remove_short_code_column`). Serve il componente QR (richiesta-condivisa C1).

### Mail (risposta 141)

Un solo interruttore in `src/lib/` (proposto `INVITE_MAIL_AVAILABLE = false`) accende campo e riga «Mail» quando F9 e il modello di B4 sono uniti. Regole: mail controllata (una `@`, un punto dopo, massimo 254 caratteri); errore «Scrivi una mail valida, oppure copia il link.» **(default)**; l'indirizzo non si salva in nessuna tabella né log; al massimo 3 mail per invito e 20 per Nest in 24 ore (richiesta-db R4) **(default)**, oltre: «Hai già mandato troppe mail per questo invito: copia il link e mandalo tu.» **(default)**.

### «Manda di nuovo» e «Annulla l'invito»

- «Manda di nuovo» con invito valido: riapre «Manda l'invito a <nome>» (computer: la finestra con Copia, Mostra e, se accesa, la mail) con lo **stesso** link e la stessa scadenza. Con invito scaduto: `renew_invitation` (R2) in una transazione, poi lo stesso foglio con il link nuovo (7 giorni).
- «Manda l'invito» (adulto senza invito): come sopra, crea l'invito.
- «Annulla l'invito»: dialogo «Annullare l'invito a <nome>?» / «Il link smette di funzionare e <colore con articolo> torna libero.» / «Annulla l'invito» (rosso pieno) / «Tienilo» **(default)**. Conferma: si cancella la riga di `household_members` dell'invitato (l'invito va via con `on delete cascade`); la riga sparisce, avviso «Invito annullato.» **(default)**. Il link aperto dopo porta alla pagina «link non valido» di A22/A23.

## §4 Scheda di un adulto (`/membri/<id>`, `cb1-20`)

Solo adulti con account del proprio Nest, diversi da te. `/membri/<il tuo id>` → `/profilo`; `/membri/<invitato>` → `/nest` **(default)**; figlio → `/figli/<id>`; id di un altro Nest, inesistente o non valido → 404 nella cornice. Animali: come oggi finché A25a non li sposta.

| Parte                  | Contenuto                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testa                  | freccia indietro (ripiego `/nest`); pallino 72 con iniziali; nome (`h1`); sotto: «Organizza con te» (lei e tu organizzate), «Organizza» (lei sì, tu no), «Partecipa» (lei no) **(default)**    |
| Azioni rapide          | «Impegni» → `/calendario/settimana` con il filtro su quella persona (dipende da A4 #537, domanda 4); «Chiama» e «Messaggio» solo quando l'adulto ha un telefono (oggi mai: domanda 1)          |
| «Contatti»             | telefono, mail, compleanno: la sezione non si mostra finché i dati non esistono (domanda 1)                                                                                                    |
| «In casa» · Ruolo      | «Organizza: può invitare e cambiare le impostazioni» / «Partecipa: vede e aggiunge, ma non invita e non cambia le impostazioni» **(default)**; «Cambia» solo per chi organizza e non in coppia |
| «In casa» · Calendari  | una riga per calendario acceso: «Google «Lavoro»: per voi è solo «occupata»» oppure «… per voi si vede con il titolo» **(default)**; nessun calendario: niente riga (R3)                       |
| «In casa» · Con voi da | mese e anno di `joined_at` a Roma: «settembre 2026»                                                                                                                                            |
| Nota                   | «Gli impegni privati di <nome> non li vede nessuno, nemmeno chi organizza.» (la seconda frase di `cb1-20` arriva con i contatti)                                                               |
| «Togli <nome>»         | in fondo, rosso (livello 4), solo chi organizza e non in coppia                                                                                                                                |

«Cambia»: foglio «Ruolo di <nome>» con due schede (`ChoiceGroup` A): «Organizza» / «Può invitare e cambiare le impostazioni»; «Partecipa» / «Vede e aggiunge, ma non invita e non cambia le impostazioni»; «Salva» in alto a destra. Salvato: il foglio si chiude, la riga mostra il ruolo nuovo, avviso «Ruolo cambiato.» **(default)**. Errori: «Non siamo riusciti a cambiare il ruolo. Controlla la connessione e riprova.» / «Non siamo riusciti a cambiare il ruolo per un problema nostro. Riprova tra qualche minuto.»

«Togli <nome>»: dialogo «Togliere <nome> dal Nest?» / «<nome> non vedrà più la casa. Le cose che ha aggiunto restano; quelle «Solo io» vengono cancellate.» / «Togli <nome>» (rosso pieno) / «Annulla». Riuscito: si torna a `/nest`, la persona non c'è più, avviso «<nome> non è più nel Nest.» **(default)**. Errore: il dialogo si chiude, avviso «Non siamo riusciti a togliere <nome>. Controlla la connessione e riprova.» (o la variante «per un problema nostro. Riprova tra qualche minuto.»).

Computer: la scheda non è disegnata: colonna centrata di 600 px nella cornice con la barra laterale (default 1 del piano).

## §5 «Aggiungi un figlio o un animale»

Apre il foglio «Aggiungi una persona o un animale» del primo avvio (`avvio/2-di-4-*`), senza la scelta «Adulto», con titolo «Aggiungi un figlio o un animale» **(default)**: per un figlio nome, data di nascita (facoltativa), colore; per un animale specie (cane, gatto, altro), nome, colore. Testi, errori e limiti come `MemberSheet` di oggi (`src/lib/member-texts.ts`). Salvato: il foglio si chiude, la riga nuova compare al suo posto in «Chi c'è». Nessun dato nuovo: solo le colonne che il foglio salva già oggi.

## §6 Stati

| Stato             | Telefono e computer                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Caricamento       | scheletro con la forma della testa e di tre righe (`loading.tsx`); computer tre tessere                                                |
| Errore di lettura | nessun contenuto parziale: `PageError` con «Riprova» (testi di oggi); la cornice resta                                                 |
| Senza rete        | avviso `offline` in cima; se la pagina non si legge, l'errore di lettura; le azioni rispondono con il testo «Controlla la connessione» |
| Vuoto             | non esiste un Nest senza membri: lo stato minimo è «solo tu»                                                                           |

## §7 Dati e richieste

Letti: `households.name`; `household_members` (`id`, `kind`, `name`, `color`, `birth_date` solo per l'età, `user_id` solo come «ha un account», `is_admin`, `joined_at`, `created_at`); `invitations` (`member_id`, `status`, `created_at`, `expires_at`, `token` solo per chi organizza e solo nel foglio di invio); specie, data e foto degli animali (A25a, `pet_profiles`, `pet_photos`); calendari degli adulti con R3. Dal server al browser vanno solo nome, colore, iniziali e testi già pronti (età, «vale ancora…»), mai `birth_date`, `user_id` o il token a chi non organizza.

Scritti: `invite_adult` (R1), `renew_invitation` (R2), `delete` su `household_members` (annulla invito, togli), `update is_admin`, insert di figli e animali come oggi.

**Richieste-db** (una issue `richiesta-db`):

- **R1** `public.invite_adult(p_name text, p_color member_color) returns uuid`: in una transazione crea l'adulto senza account e il suo invito (7 giorni). Errori: non organizza → `42501`; nome vuoto o oltre 40 → `22023`; colore preso → `23505`; Nest pieno → `P0001`. Il Nest è quello di chi chiama (nessun parametro di Nest). Il token si legge dopo con una query separata (LEZIONI).
- **R2** `public.renew_invitation(p_member_id uuid) returns void`: per chi organizza, revoca l'invito scaduto e ne crea uno nuovo in una transazione; con invito ancora valido non cambia nulla; membro di un altro Nest, con account o non adulto → `42501`/`22023`, nessuna scrittura.
- **R3** `public.household_member_calendars()`: per gli adulti del Nest di chi chiama, solo i calendari accesi: `member_id`, servizio, nome del calendario, `visibility`. Niente mail dell'account, id dei servizi o credenziali. Oggi `calendar_accounts` ed `external_calendars` sono leggibili solo dal proprietario.
- **R4** (solo con la mail) contatore delle mail di invito per invito e per Nest, con funzione che lo incrementa e rifiuta oltre i limiti di §3; l'indirizzo non si salva.
- **R5** (se la domanda 3 resta col default) in `accept_invitation_with_color`: se il Nest diventa «in coppia», chi entra organizza anche lui.

**Richieste-condivise:**

- **C1** codice QR: componente in `src/components/ui/` e codificatore in `src/lib/` senza pacchetti nuovi (un pacchetto solo con approvazione di Francesco, §2 di ARCHITETTURA).
- **C2** foglio «Aggiungi una persona o un animale» 2.0 (`MemberSheet`, `avvio/2-di-4-*`) con la prop per togliere «Adulto» e scegliere il tipo iniziale; serve anche ad A21 #554.
- **C3** formati in `src/lib/datetime.ts`: «oggi / ieri / il 12 novembre», «vale ancora N giorni», «settembre 2026» (Roma).
- **C4** classi di disposizione in `components.css`: tessere del Nest a quattro colonne su computer, tessera tratteggiata dell'invito.
- **C5** interruttore `INVITE_MAIL_AVAILABLE` in `src/lib/`.

## §8 Dati di prova dei test

Date dell'invito ed età si calcolano sul server con l'ora vera: i dati sono **relativi a oggi**, mai date passate fisse (LEZIONI). Nest A «Casa Bianchi» (`SEED_HOME_A`), creati in quest'ordine: Marco (organizza, chi usa l'app, `pomodoro`), Laura (adulta con account, non organizza, `glicine`, `joined_at` 7 settembre 2026, calendario Google «Lavoro» acceso in `busy`), Sofia (figlia, `salvia`, 9 anni compiuti da almeno un mese), Tommaso (figlio, `cobalto`, 6 anni compiuti da almeno un mese), Biscotto (cane, `zafferano`), Miele (gatto, `cannella`, senza foto). Per l'invito in attesa un'altra persona (correzione 2 del Passo 12): Giulia, `peonia`, invito creato **ieri alle 12:00** (Roma) con scadenza **tra 6 giorni meno un'ora**, cioè «Invito mandato ieri · vale ancora 6 giorni». Nest B (`SEED_HOME_B`): Paolo, organizza. Nest C «in coppia»: Anna e Luca, tutti e due organizzano. Nest D «solo tu»: Elena. Ogni test che scrive crea e cancella i propri utenti (LEZIONI).

## §9 Fuori perimetro

- Aiutanti (nonni e babysitter, `cc1-23`): il gruppo «Aiutanti» con pallino neutro e iniziale (risposta 190) arriva con B21 #392 dopo DB-21 #531.
- «Il vostro piano» e Plus: con i pagamenti.
- Le righe «Propositi di casa» e «Conti chiari» non sono di questa pagina: stanno in Spazi (A16 #549).
- «Esci dalla casa» ed eliminazione dell'account: A19 #552. Profilo personale e cambio del proprio colore: A17 #550. Pagine di chi riceve l'invito e link scaduto: A22 #555, A23 #556. Mail dell'invito: B4 #563.
