# #534 · A1 · Oggi: dettagli del requisito

Allegato del requisito nella issue #534. La issue contiene obiettivo, regole principali e criteri di accettazione (CA); qui ci sono le tabelle, i testi completi, il formato della copia locale e i dati di prova. Se questo file e la issue si contraddicono, vale la issue. **(default)** segna ciò che il design non dice: la domanda è nella issue.

Fonti: `docs/design/telefono/oggi/` (`og1-02` … `og1-16`, `sf1-*`), `ritocchi-p6/rt1-19` … `rt1-24`, `splash-p9/sp1-05`, `sp1-06`, `animali/4-6-*` (solo forma della spunta), `app-fase-b/cb1-43`, `cb1-44`; `docs/design/computer/oggi/01` … `09`, `regole.md`, `web-da-telefono/01`, `08`, `11`; risposte 4, 87, 119, 120, 121, 123, 128, 132, 149, 172, 176, 180 di `decisioni-fable.md`; requisiti F4a #503, F4b #504, F4c #505, F5 #506, A2 #535, A3 #536, A4 #537; revisione `sicurezza` della copia locale (commento del 26/11 su #534); codice in `src/components/oggi/`.

## 1. Cosa cambia rispetto a `/oggi` di oggi

| Esce                                                                                          | Entra                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Campo rapido «Aggiungi», `Prossimo` / `Dopo` / `Già fatti` (`ProssimoSection`, `DopoSection`) | Cima unica: scena, foglio con data, saluto su una riga, tre conti a filo                    |
| Schede dei contatori (`scheda contatore`), sezione `Nel Nest`, `Questa settimana`             | «La giornata» con tutte le righe di oggi, linea gialla di «adesso», «Liberi insieme»        |
| Sezione degli Spazi fissati (`SpacesSection`, `pinned_spaces`: DB-9 #518 la toglie)           | Riquadri di casa a tutta larghezza, ordinati e misurati per persona (DB-5 #514)             |
| Lettura «a pezzi» che mostra le parti riuscite (`safely` in `read.ts`)                        | Lettura tutta o niente (LEZIONI: errore parziale = `{ ok: false }` e «Riprova»)             |
| Due disposizioni con regole interne a 768/1024 px                                             | Disposizioni di F5: telefono fino a 759 px, computer da 760 (§8)                            |
| —                                                                                             | «Domani» (telefono), «I prossimi giorni» (computer), «Personalizza Oggi», copia locale (§9) |

Restano, ridisegnate: la lista di partenza (§7.3); la frase di chi entra con un invito (`readMemberWelcome`, `buildSummary`) nello stesso posto (sotto i conti) finché B3 #562 non la sostituisce **(default)**; la spunta con il messaggio «Fatto:» e «Annulla» (`useOggi.ts`); la coda delle spunte senza rete.

## 2. Momenti del giorno, saluto, scena

Una sola funzione pura in `src/lib/datetime.ts` (richiesta condivisa): `dayMoment(instant) → "mattina" | "pomeriggio" | "sera" | "notte"`, ora di Roma. `formatGreeting` la usa.

| Momento    | Ore (Roma)  | Saluto            | Note                                                                        |
| ---------- | ----------- | ----------------- | --------------------------------------------------------------------------- |
| mattina    | 05:00–12:59 | `Buongiorno`      | inizio alle 5 come oggi **(default)**                                       |
| pomeriggio | 13:00–18:59 | `Buon pomeriggio` | decisione: pomeriggio dalle 13 alle 19                                      |
| sera       | 19:00–21:59 | `Buona sera`      | decisione: sera dalle 19; testo del design (oggi il codice ha «Buonasera»)  |
| notte      | 22:00–04:59 | `Buona notte`     | inizio alle 22 come il silenzio delle notifiche (risposta 87) **(default)** |

- h1 della pagina: `{saluto}, {nome}` con il nome in grassetto (`household_members.name` di chi guarda). Sopra: `formatLongDay` (`Mercoledì 17 novembre`).
- **Scena:** componente di F6 #507, solo «la casa» al lancio (gli altri sfondi sono B23 #400, dopo il lancio: la riga «Sfondo di Oggi» non c'è). Attributo `data-momento` con il momento mostrato. Cambia da sola al confine (dissolvenza 600 ms; con movimento ridotto cambio netto). **Tema scuro** (Aspetto «Scuro», o «Come il telefono» con il telefono scuro, A18 #551): la scena è sempre `notte` (risposta 204), a qualunque ora; il saluto segue comunque l'ora.
- Colori: solo token di F2 (`--color-scena-*`, tavolozza comune chiara e scura). Nessun colore scritto nella pagina.

## 3. Conti e titoli

«Riga» = riga di «La giornata» per la lente scelta: impegno intero, riga mascherata, «Liberi insieme». **Rimasta** = riga con inizio dopo adesso. Le righe «Tutto il giorno» non sono mai rimaste.

| Conto    | Lente «Io»                                                                               | Lente «Nest»                          | Con 1 / con 0                  | Va a                               |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ | ---------------------------------- |
| impegni  | righe rimaste di oggi                                                                    | uguale, con le righe della lente Nest | `1 impegno` / `Nessun impegno` | `/calendario/giorno?giorno=<oggi>` |
| da fare  | `todos` aperti (`done_at` nullo) in cui c'entro (`todo_assignees`) + i miei `is_private` | `todos` aperti non privati            | `1 da fare` / `Niente da fare` | `/casa/da-fare`                    |
| in spesa | `shopping_items` con `checked_at` nullo                                                  | uguale                                | `1 in spesa` / `Spesa vuota`   | `/casa/spesa`                      |

Numero e parola sono un solo link; nome accessibile = testo visibile (`2 impegni`). Il conto in alto è sempre uguale al numero del titolo della giornata.

**Titolo di «La giornata»:** nessuna riga di oggi iniziata → `{n} impegni` / `1 impegno`; almeno una iniziata e n > 0 → `restano {n} impegni` / `resta 1 impegno`; n = 0 → solo `La giornata` **(default)**.

## 4. La giornata, Domani, I prossimi giorni

**Quali righe:** quelle di `list_calendar_events` per oggi (Roma). Lente «Io»: gli impegni in cui c'entro secondo `isInvolved` di `src/lib/calendar.ts` esteso a chi riprende (richiesta condivisa di A4); lente «Nest»: tutti, mascherati compresi. `private` degli altri: non esistono. «Liberi insieme»: calcolo di oggi (`openTonightWindow`, chi riprende conta come occupato), riga gialla `Liberi insieme` / `Tu e {nome}` con i pallini, come oggi; si apre `/calendario?settimana=<lunedì>` come oggi.

**Ordine:** «Tutto il giorno» in cima (`Tutto il giorno` al posto dell'ora), poi per inizio; a parità, ordine di oggi. Tutte le righe di oggi restano: quelle finite sono attenuate (`og1-02`).

**Linea di «adesso»:** pastiglia gialla con `HH:MM` (ora di Roma, si aggiorna ogni minuto con `useNowMinute`) e filo giallo. Sta dopo l'ultima riga iniziata (inizio ≤ adesso) e prima della prima rimasta; se nessuna è iniziata apre la giornata (`og1-05`); se tutte sono iniziate chiude la giornata. Testo della pastiglia nel ruolo «testo sul giallo» della tavolozza (inchiostro su `--color-adesso` in chiaro), contrasto ≥ 4,5:1 in tutti e due i temi. Il giallo pieno è solo di «adesso»; «Liberi insieme» ha il fondo tenue.

**Riga:** ora `HH:MM`, titolo, seconda riga, pallini (`AvatarStack` di F4b: persone, chi porta, chi riprende, senza doppioni). Seconda riga, in quest'ordine **(default)**:

1. frase del viaggio di A4 §2.4 (`La porta Laura, la riprendi tu`, `Li porti tu`), dal punto unico condiviso;
2. altrimenti il luogo (`location`), se c'è (`Piscina comunale`);
3. altrimenti lente «Io»: `Fino alle HH:MM`; lente «Nest»: `Tu, fino alle HH:MM` / `{nome}, fino alle HH:MM` come A4.

Riga mascherata: `{nome} ha un impegno` con lucchetto, `Fino alle HH:MM`, pallino dell'autore, non è un link. Riga intera: link a `eventHref(id, startsAt)` (dettaglio di A3 #536; sul computer A3 lo apre nel pannello). Il titolo resta quello scritto: niente righe trasformate come «Riprendi Sofia a nuoto» o «Porti Tommaso a calcio alle 17:40» (non c'è un'ora di partenza nel database) **(default)**.

**Vuoto:** nessuna riga oggi (per la lente) → riquadro al posto delle righe (`og1-11`): titolo `Oggi è una giornata libera`, testo `In calendario non c'è niente. Puoi guardare com'è domani.`, pulsante quieto `Guarda domani` → `/calendario/giorno?giorno=<domani>`. Con la lista di partenza visibile vale il testo del primo giorno (§7.3).

**+ di «La giornata»:** il «+» del componente, nome `Nuovo impegno`, apre «Nuovo impegno» di A2 (`/aggiungi`, giorno di oggi).

**Domani (solo telefono):** righe di domani per la lente, stessa forma; titolo `Domani` e `{n} impegni` / `1 impegno` (tutte le righe di domani); al massimo 3 righe, poi il link `Vedi tutto domani` → `/calendario/giorno?giorno=<domani>` **(default)**. Domani senza righe: il blocco non c'è. Posto:

| Momento                            | Dove sta «Domani»                                               |
| ---------------------------------- | --------------------------------------------------------------- |
| mattina, pomeriggio                | dopo l'ultimo riquadro (`og1-03`)                               |
| sera; notte con righe rimaste      | subito dopo «La giornata» (`og1-06`)                            |
| notte, e nessuna riga rimasta oggi | al posto di «La giornata», primo blocco dopo i conti (`og1-07`) |

**I prossimi giorni (solo computer, colonna a destra):** titolo `I prossimi giorni` con `da domani`; i 7 giorni da domani, solo quelli con righe; intestazione `Giovedì 18` più `domani` sul primo giorno se è domani; al massimo 6 righe in tutto (come `WEEK_MAX_ROWS` di oggi); in fondo il pulsante quieto `Apri il calendario` → `/calendario`. Senza righe: `Niente in programma nei prossimi giorni.` con lo stesso pulsante **(default)**. «Stasera si mangia» (Pasti, B14) non c'è.

## 5. Riquadri di casa

Catalogo (chiave DB-5 tra parentesi). Le voci dopo il lancio restano nascoste: non sono né in Oggi né in «Personalizza Oggi».

| Riquadro (chiave)                | Quando        | All'inizio                        | Sottotitolo in Personalizza        | Esteso                                                                                                                                            | Solo il conto                                                     |
| -------------------------------- | ------------- | --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| La giornata (fissa, non salvata) | lancio        | sempre prima                      | `Sempre in cima`                   | §4                                                                                                                                                | —                                                                 |
| Le mie cose (`todos`)            | lancio        | in Oggi, 2°, Esteso               | `Le cose da fare che toccano a te` | `Le mie cose` (lente Io) / `Da fare in casa` (lente Nest), `{n} da fare`, prime 3 righe, poi `Altre {k} cose` / `Un'altra cosa` → `/casa/da-fare` | `Le mie cose · {n}` (o `Da fare in casa · {n}`) → `/casa/da-fare` |
| Spesa (`shopping`)               | lancio        | in Oggi, 3°, Esteso               | `Le prime tre cose`                | `Spesa`, `{n}`, prime 3 righe, poi `Altre {k} cose` / `Un'altra cosa` → `/casa/spesa`                                                             | `Spesa · {n}` → `/casa/spesa`                                     |
| Scadenze (`deadlines`)           | lancio        | in Oggi, 4°, Esteso **(default)** | `Le prossime due`                  | `Scadenze`, `{n}`, prime 2 righe                                                                                                                  | `Scadenze · {n}` → `/casa/scadenze`                               |
| Animali (`pets`)                 | con A25c #559 | lo decide A25c                    | `Cibo e passeggiate di oggi`       | A25c                                                                                                                                              | A25c                                                              |
| Stasera (`meal`)                 | dopo, B14     | —                                 | `Il pasto di oggi`                 | —                                                                                                                                                 | —                                                                 |
| Compleanni (`birthdays`)         | dopo, B9      | —                                 | `Il prossimo`                      | —                                                                                                                                                 | —                                                                 |
| Tempo insieme (`together`)       | dopo, B22d    | —                                 | `Un'idea per il weekend`           | —                                                                                                                                                 | —                                                                 |

**Righe.**

- **Le mie cose / Da fare in casa:** le righe del conto «da fare» (§3), in ordine `byDeadline` come oggi. Tondo da spuntare (`Checkbox variant="round"`, nome `Segna fatto: {titolo}`), titolo, seconda riga `todoInfo` (`Entro venerdì`), pallini di `todo_assignees`. Il testo apre `/aggiungi?tipo=da-fare&modifica=<id>` come Casa.
- **Spesa:** `shopping_items` aperti in ordine di inserimento; tondo (nome `Prendi: {nome}`), nome, seconda riga `quantity` se c'è, pallini di `shopping_item_assignees`. Il testo apre `/aggiungi?tipo=spesa&modifica=<id>`.
- **Scadenze:** `deadlines` con `due_date` ≥ oggi, per data; lente Io: anche le mie private; lente Nest: senza private. Riga: blocco data (`mar` sopra `23`), titolo, ripetizione con i testi di Casa · Scadenze (`Ogni mese`, `Ogni anno`; niente se non si ripete), pallino di `for_member_id` (o del primo di `deadline_assignees`), freccia sottile; tutta la riga → `/casa/scadenze` (il dettaglio lo fissa A9 #542).
- **+ leggero** in testa a ogni riquadro: `/aggiungi?tipo=da-fare`, `?tipo=spesa`, `?tipo=scadenza`; nome `Aggiungi a {titolo del riquadro}`.
- **Riquadro senza righe** (tutte e due le misure): non c'è; il conto in alto lo dice **(default, `og1-06`)**.

**Spunta (come oggi).** Tocco sul tondo: la riga si barra, il conto scende subito, messaggio `Fatto: {titolo}` (da fare) o `Preso: {nome}` (spesa, testo di Casa · Spesa) con `Annulla` per 5 secondi; `haptic("leggera")` di F4a. Alla chiusura del messaggio si scrive (`todos.done_at`, `done_by_member_id`; `shopping_items.checked_at`) e la riga esce. `Annulla` o un secondo tocco: torna com'era, niente scritto. Scrittura rifiutata: la riga torna vuota, il conto torna, messaggio `Non riusciamo a segnarlo. Riprova.` (senza icona, `4-6-non-salvata`). Senza rete: la spunta entra nella coda «In attesa di connessione» (F7), come oggi.

## 6. Personalizza Oggi (`/oggi/personalizza`)

**Ingresso (default, non disegnato):** link quieto `Personalizza Oggi` in fondo a Oggi, dopo l'ultimo blocco, su telefono e computer. Rotta di dettaglio in `app-routes.ts` (freccia indietro D, ripiego `/oggi`).

| Elemento                 | Testo / comportamento                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| h1 e testo               | `Personalizza Oggi` · `Scegli che cosa vedi in Oggi e in che ordine. Vale solo per te.`                                                                                                                                                                    |
| Gruppo 1                 | `In Oggi` con il numero; righe nell'ordine di Oggi                                                                                                                                                                                                         |
| Riga «La giornata»       | prima, senza maniglia, valore `Esteso` scritto, non è un pulsante **(default)**                                                                                                                                                                            |
| Altre righe del gruppo 1 | maniglia (pulsante `Sposta {titolo}`), titolo, sottotitolo, a destra la misura (`Esteso` / `Solo il conto`) e la freccia sottile; la riga (fuori dalla maniglia) apre il foglio della misura                                                               |
| Gruppo 2                 | `Non in Oggi` con il numero, solo se ha righe; riga: + in cerchio (pulsante `Aggiungi {titolo} a Oggi`), titolo, sottotitolo. Il + mette il riquadro in fondo al gruppo 1, `Esteso`                                                                        |
| Foglio (`Sheet` di F4c)  | titolo = nome del riquadro, X; riga con occhio `In Oggi` + `Toggle`; etichetta `Misura`; `ChoiceGroup variant="cards"`: `Esteso` / `Il titolo e {righe}.`, `Solo il conto` / `Una riga: «{titolo} · {n}».` ({n} = conto attuale); piede `Annulla`, `Salva` |
| {righe} del foglio       | Le mie cose `le prime tre cose da fare`; Spesa `le prime tre cose`; Scadenze `le prossime due scadenze`                                                                                                                                                    |
| Salva                    | scrive (DB-5) e chiude; interruttore spento → il riquadro passa al gruppo 2                                                                                                                                                                                |
| Annulla, X, Esc, velo    | chiudono senza scrivere                                                                                                                                                                                                                                    |

**Spostare.** Con il dito o il mouse si trascina dalla maniglia: la riga presa si alza di 2 px, le altre fanno posto in 200 ms; `haptic("leggera")` alla presa e al rilascio; con movimento ridotto le righe cambiano posto senza scorrere. **Da tastiera** (obbligatorio, regole §8: mai solo trascinamento): fuoco sulla maniglia, Spazio o Invio la prende, ↑/↓ spostano di un posto, Spazio o Invio la lasciano, Esc annulla; in una zona `aria-live="polite"`: `{titolo} preso, posto {p} di {n}`, `{titolo} al posto {p} di {n}`, `{titolo} lasciato al posto {p} di {n}`, `Spostamento annullato`. Il posto 1 è sempre «La giornata»: si arriva al massimo al posto 2. Ogni rilascio scrive subito.

**Scrittura.** Ogni cambio si vede subito; se la scrittura non riesce torna com'era e compare il messaggio `Non riusciamo a salvare. Controlla la connessione e riprova.` Senza rete la scrittura fallisce con lo stesso messaggio (niente coda per le preferenze) **(default)**. Le preferenze di un'altra persona non si leggono né si scrivono mai. Nessuna riga salvata → valori di partenza di §5.

Computer: stessa pagina in una colonna di 600 px come Impostazioni (regole §2); il foglio è la finestra di F4c.

## 7. Stati

### 7.1 Testi

| Stato                                                   | Dove                                                   | Testo                                                                                                                                                                                             | Azione                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Caricamento (`og1-12`, `sp1-06`)                        | sotto il saluto                                        | scheletro di conti, titolo e 4 righe, con le misure vere; contenitore `aria-busy="true"`, testo nascosto `Caricamento in corso`                                                                   | barra in basso già usabile                                                                           |
| Rete lenta (`rt1-22`): copia locale e lettura oltre 2 s | riga sotto i conti, icona che gira                     | `Aggiorno… Intanto vedi le cose com'erano alle {HH:MM}.`                                                                                                                                          | sparisce in 150 ms all'arrivo dei dati                                                               |
| Aggiornamento non riuscito (`og1-13`)                   | `Alert` sotto i conti                                  | `Non riusciamo ad aggiornare. Vedi le cose com'erano alle {HH:MM}.`                                                                                                                               | `Riprova`                                                                                            |
| Senza rete, con dati (`rt1-23`, computer `07`)          | `Alert variant="offline"` sotto i conti, fermo in cima | lead `Senza rete.` + `Vedi le cose com'erano alle {HH:MM}; quello che aggiungi parte appena torna.`                                                                                               | telefono: nessuna; computer (≥ 760 px): `Riprova` **(default)**; riprova da sola all'evento `online` |
| Senza dati, errore (`rt1-24`)                           | al posto di conti e blocchi                            | icona, titolo `Non riusciamo a caricare la giornata`; senza rete: `Sembra che manchi la rete. Appena torna, la giornata compare da sola.`; con rete: `Riprova tra qualche secondo.` **(default)** | `Riprova` (pulsante secondario)                                                                      |
| Spunta non salvata                                      | messaggio                                              | `Non riusciamo a segnarlo. Riprova.`                                                                                                                                                              | —                                                                                                    |
| Personalizza non salvata                                | messaggio                                              | `Non riusciamo a salvare. Controlla la connessione e riprova.`                                                                                                                                    | —                                                                                                    |

`{HH:MM}` = ora di Roma dell'ultima lettura riuscita (o `savedAt` della copia), con `formatTime`. Forme neutre: «Non riusciamo», mai «Non siamo riusciti» (il design ha la forma maschile). Scena, data e saluto ci sono in tutti gli stati.

### 7.2 Quando si rilegge

Come oggi: all'apertura, al ritorno sulla pagina (`visibilitychange`), al ritorno della rete, al cambio di giorno (mezzanotte di Roma, a pagina aperta), dopo «Riprova». Lettura tutta o niente: se una parte fallisce non si mostra niente di nuovo (§1).

### 7.3 Primo giorno (`og1-10`)

Lista di partenza di oggi (`buildStarter`; `households.first_shopping_item_at`, `starter_list_completed_at`, `calendar_accounts`, `invitations`), sotto i conti e prima di «La giornata». Titolo `Quattro cose per partire bene` con `{k} di 4`. Righe: `Porta qui il tuo calendario` (fatta: `{Outlook} collegato`), `Scrivi la prima cosa nella spesa` / `Prova con «spesa: latte e pane»`, `Aggiungi un impegno di questa settimana`, `{nome} entra nel Nest` / `Si spunta da sola quando entra` con l'etichetta `Invito inviato` (tondo tratteggiato: si spunta da sola). Le righe non fatte portano dove oggi. «La giornata» vuota: `Giornata libera, per ora` / `Gli impegni di oggi compaiono qui, in ordine di ora.` (senza pulsante). Sul computer la lista sta nella colonna destra al posto dei prossimi giorni, con gli stessi testi del telefono **(default: la tavola `05` ha testi e conti diversi)**.

## 8. Telefono, computer, web da telefono

| Larghezza / modo                                                     | Disposizione                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telefono, app (≤ 759 px, `display-mode: standalone` o guscio nativo) | Scena alta 236 px a tutta larghezza con i comandi di F5 nei dischi bianchi; foglio bianco che sale di 24 px; dopo 120 px di scorrimento la barra raccolta di F5 (56 px). La scena scorre a metà velocità; con movimento ridotto nessuna differenza e barra in dissolvenza  |
| Telefono, scheda del browser (≤ 759 px, `display-mode: browser`)     | Niente scena: in cima subito la barra bianca di F5 con lente, Cerca, Notifiche; poi data, saluto, conti e il resto (`web-da-telefono/01`) **(default)**. Niente splash (F6)                                                                                                |
| Computer 1100–1439 px                                                | Barra laterale (lente in cima), barra in alto di F5 (`Oggi`, Cerca, Notifiche, `Nuovo impegno`). Fascia: data, saluto, conti a sinistra; scena in una finestra a destra (risposta 176). Sotto due colonne: sinistra «La giornata» e i riquadri; destra «I prossimi giorni» |
| Computer ≥ 1440 px (contenuto fino a 1200)                           | Tre colonne: «La giornata» · riquadri · «I prossimi giorni»                                                                                                                                                                                                                |
| 760–1099 px                                                          | Barra a icone; una colonna: «La giornata», riquadri, «I prossimi giorni»; scena a destra della fascia (`09`)                                                                                                                                                               |
| Pannello aperto (dettaglio di A3)                                    | Regola di F5: contenuto < 900 px → scena nascosta e seconda colonna sotto la prima (a 1280); a 1440 restano due colonne e la scena. Esc chiude e il fuoco torna alla riga                                                                                                  |

Sul computer: un solo «+» leggero per blocco, nessun «Domani» (c'è «I prossimi giorni»).

## 9. Copia locale di Oggi (per F7 #148 e per il widget nativo N4 #595)

Rivista dopo il `DA CORREGGERE` dell'agente `sicurezza` (commento del 26/11 su #534). I sei punti sono 9.2–9.7.

### 9.1 Funzioni e contenuto

La pagina, dopo ogni lettura riuscita, costruisce l'istantanea e la passa a funzioni uniche di `src/lib/` (richiesta condivisa, insieme a F7): `canKeepLocalCopy()`, `saveTodaySnapshot(s)`, `readTodaySnapshot()`, `clearTodaySnapshot()`. Mai in log, URL, analytics. Una sola istantanea, sovrascritta. Formato in 9.8.

### 9.2 Telefono condiviso (punto 1)

`canKeepLocalCopy()` è vera solo se **tutte** queste condizioni valgono; altrimenti la copia non si scrive, quella che c'era si cancella e il widget non mostra niente:

- app installata (`display-mode: standalone`) o guscio nativo; mai nella scheda del browser, su telefono o computer;
- all'accesso **non** era accesa la casella «Questo telefono non è solo mio» (risposta 180, A20 #553), e la sessione è di quelle che restano attive. Il dato che lo dice lo fissa A20 (nessun dato personale, nessun token); finché A20 non lo dà, `canKeepLocalCopy()` è falsa **(default protettivo)**.

### 9.3 Quando si cancella (punto 2)

Cancellare vuol dire togliere la copia dal deposito, non ignorarla. `clearTodaySnapshot()` si chiama, prima di mostrare qualsiasi cosa, quando:

| Caso                                                  | Come lo si riconosce                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| «Esci»                                                | funzione unica di uscita (LEZIONI: cancella i dati locali in ogni uscita)                                                               |
| apertura di `/accesso`                                | la pagina di accesso cancella i dati locali (LEZIONI)                                                                                   |
| sessione scaduta o revocata                           | nessuna sessione all'apertura, o una lettura qualsiasi risponde 401 (anche `PGRST301` o JWT scaduto)                                    |
| account eliminato                                     | su questo telefono: il flusso di A19 #552 la cancella prima di uscire; sugli altri: la sessione revocata dà 401 (riga sopra)            |
| persona tolta dal Nest                                | una lettura risponde 42501 (non membro), `current_household_id` è nullo o la cornice (`requireNest`) non trova il Nest                  |
| entra in un altro Nest                                | `householdId` o `meId` della sessione diversi da quelli della copia; anche il flusso di accettazione dell'invito (A22 #555) la cancella |
| una lettura risponde «non autenticato» o «non membro» | 401 o 42501 su una qualsiasi delle letture di Oggi o delle altre pagine che leggono con la sessione                                     |

Nel guscio nativo la stessa chiamata cancella anche la copia del widget e chiede al sistema di ridisegnarlo subito (N4).

### 9.4 Durata (punto 3)

La copia ha `expiresAt` = il primo tra la mezzanotte di Roma dopo `savedAt` e `savedAt` + 12 ore **(default, domanda 8)**. `readTodaySnapshot()` cancella e restituisce nulla se `dayKey` non è oggi a Roma o se adesso ≥ `expiresAt`. Il widget applica la stessa regola da solo, anche se l'app non si apre: una copia scaduta è assente.

### 9.5 Ricostruzione (punto 4)

Ogni istantanea si costruisce **da zero** con le sole risposte del server della lettura appena riuscita, per la sessione attuale. Mai unirla con la copia precedente, con eventi in tempo reale o con la coda senza rete (le spunte in attesa non entrano). Così un impegno passato a «Occupato» o «Solo alcune persone», o cancellato, non resta nella copia. Una lettura fallita non scrive niente e non tocca la copia (salvo i casi di 9.3).

### 9.6 Dove si salva (punto 5)

- **Web (app installata):** un solo spazio dell'app, IndexedDB dell'origine con un solo archivio e una sola voce (nomi nella richiesta condivisa). **Mai** nella cache del service worker (`caches`) o di HTTP, nei cookie, in `localStorage` o `sessionStorage`. Nessun invio al server. Nessun token, nessuna intestazione e nessun id di sessione nella copia.
- **Guscio nativo (N4 #595):** uno spazio condiviso solo tra l'app e il widget di FamilyNest (per iPhone un App Group dedicato), escluso dai backup del telefono e del cloud. Due voci: `counts` (solo `dayKey`, `expiresAt` e i tre conti delle due lenti, senza nomi né titoli) leggibile anche a telefono bloccato; `snapshot` (la copia intera) protetta dal blocco (su iPhone protezione dati «completa»: illeggibile a telefono bloccato). Android: memoria privata dell'app, esclusa dal backup, cifrata con una chiave che richiede il telefono sbloccato. «Esci» e ogni caso di 9.3 cancellano tutte e due le voci e aggiornano subito il widget.

### 9.7 Widget e schermata di blocco (punto 6, requisiti per N4 #595)

Il widget non controlla la sessione da solo. A telefono bloccato (schermata di blocco, StandBy, anteprime) mostra **solo i conti** (dalla voce `counts`). Titoli, luoghi, nomi dei figli, chi porta e chi riprende si vedono solo a telefono sbloccato. Un tocco con `eventId` apre l'app su `eventHref`, che rifà tutti i controlli (sessione, Nest, visibilità). Le prove su iPhone (TestFlight) le scrive N4 nella sua lista, con almeno: bloccato, StandBy, dopo «Esci», dopo la scadenza, dopo l'uscita dal Nest.

### 9.8 Formato v1

Stabile: il widget lo legge senza la logica della pagina. JSON, campi in inglese:

```ts
type TodaySnapshotV1 = {
  version: 1;
  savedAt: string; // ISO, istante della lettura
  expiresAt: string; // ISO, 9.4
  dayKey: string; // "2027-11-17", Roma
  householdId: string;
  meId: string;
  people: { id: string; name: string; color: string; initials: string }[]; // solo chi compare nelle righe
  lenses: Record<
    "io" | "nest",
    {
      counts: { events: number; todos: number; shopping: number };
      dayTitle: string; // "restano 2 impegni"
      day: SnapshotRow[]; // oggi, nell'ordine di §4
      tomorrow: SnapshotRow[]; // al massimo 3
      tiles: SnapshotTile[]; // riquadri accesi, nell'ordine della persona
    }
  >;
};
type SnapshotRow = {
  kind: "event" | "masked" | "together";
  eventId: string | null; // solo per "event" (collegamento del widget)
  startsAt: string; // ISO
  endsAt: string; // ISO
  allDay: boolean;
  title: string; // "masked": "Laura ha un impegno" già composto; "together": "Liberi insieme"
  line: string | null; // seconda riga già composta
  peopleIds: string[];
};
type SnapshotTile = {
  key: "todos" | "shopping" | "deadlines";
  title: string; // "Le mie cose" / "Da fare in casa" / "Spesa" / "Scadenze"
  size: "expanded" | "count";
  count: number;
  rows: {
    id: string;
    title: string;
    line: string | null;
    peopleIds: string[];
  }[]; // vuoto se "count"
};
```

Testi già composti in italiano: il widget li mostra così come sono. Campi **esclusi**: note, avvisi, `viewer_ids`, campi «da verificare», titoli dei mascherati, qualsiasi `private` di altri, date di nascita, dati di altri Nest, token e dati di sessione. Il formato si documenta in `docs/agenti/APP.md` con la PR; un cambio di forma alza `version`. Serve un nuovo verdetto `sicurezza` sulla PR di sviluppo.

## 10. Dati

**Letti** (sessione utente, RLS): `household_members` (`id`, `name`, `color`, `kind`, il mio da `user_id`); `list_calendar_events(oggi, oggi + 8 giorni)` (DB-1: `id`, `starts_at`, `ends_at`, `visibility`, `author_member_id`, `is_masked`, `title`, `location`, `member_ids`, `escort_member_id`, `pickup_member_id`, `escort_undecided`, `pickup_undecided`, `all_day`, `counts_for_free_time`); `todos` (`id`, `title`, `due_date`, `is_private`, `done_at`, `created_by_member_id`, `created_at`) con `todo_assignees`; `shopping_items` (`id`, `name`, `quantity`, `checked_at`, `created_at`) con `shopping_item_assignees`; `deadlines` (`id`, `title`, `due_date`, `is_private`, `for_member_id`, `recurrence`, `recurrence_interval_days`, `created_at`) con `deadline_assignees`; per la lista di partenza come oggi; le preferenze dei riquadri (DB-5). **Non** si leggono più `pinned_spaces`.

**Scritti:** `todos.done_at`, `done_by_member_id` e `shopping_items.checked_at` (come oggi, con la coda); le preferenze dei riquadri (DB-5).

**Da DB-5 #514** (da aggiungere alla sua richiesta, nessuna `richiesta-db` nuova):

- tabella delle preferenze dei riquadri per persona: `household_id`, `member_id`, chiave del riquadro (enum con almeno `todos`, `shopping`, `deadlines`, `pets`; `meal`, `birthdays`, `together` con i loro lavori o già ora, a scelta dell'architetto), posizione (intero, univoca per persona), `is_shown` (boolean), misura (enum `expanded` | `count`), `updated_at`;
- «La giornata» non si salva (sempre prima, sempre estesa);
- nessuna riga = valori di partenza (§5), applicati dalla pagina, non scritti dal database;
- RLS: legge e scrive solo il membro stesso, nessun altro adulto, nemmeno l'amministratore; test pgTAP in tutti e due i versi;
- una scrittura che salva tutto l'elenco in una transazione (per esempio `save_today_tiles(...)`, che verifica chiavi e posizioni e rifiuta doppioni), così uno spostamento non lascia due riquadri allo stesso posto;
- cancellazione del membro → righe cancellate (`on delete cascade`).

## 11. Dati di prova dei CA

Nest A «Casa D'Angelo» (`SEED_HOME_A`), creati in quest'ordine: Marco (adulto, utente dei test, corallo), Laura (adulta, glicine), Sofia (figlia, menta), Tommaso (figlio, blu), Biscotto (animale, ambra), Miele (animale, cannella). Nest B «Casa Bianchi»: Paolo (adulto, utente), impegno «Riunione condominio» mercoledì 17 novembre 2027 18:00–19:00, spesa «Farina».

Adesso = **mercoledì 17 novembre 2027, 15:52** di Roma (`page.clock.pauseAt`), salvo dove il CA dice altro. Impegni del Nest A, `household` e scritti da Marco se non detto:

| #   | Giorno | Ora         | Titolo                   | Persone        | Viaggio                     | Note                         |
| --- | ------ | ----------- | ------------------------ | -------------- | --------------------------- | ---------------------------- |
| 1   | mer 17 | 10:00–11:00 | Colloquio di lavoro      | Laura          |                             | `private`, autrice Laura     |
| 2   | mer 17 | 13:00–14:00 | Palestra                 | Marco          |                             |                              |
| 3   | mer 17 | 15:00–16:00 | Appuntamento in banca    | Laura          |                             | `busy`, autrice Laura        |
| 4   | mer 17 | 17:00–18:30 | Nuoto Sofia              | Sofia          | porta Laura, riprende Marco | luogo «Piscina comunale»     |
| 5   | mer 17 | 19:30–21:30 | Cena di lavoro           | Laura          |                             | autrice Laura                |
| 6   | gio 18 | 08:10–08:30 | Scuola                   | Sofia, Tommaso | porta Marco                 |                              |
| 7   | gio 18 | 17:30–18:30 | Toelettatura di Biscotto | Biscotto       | porta Laura                 |                              |
| 8   | gio 18 | 18:00–19:00 | Calcio Tommaso           | Tommaso        | porta Marco                 |                              |
| 9   | ven 19 | 20:30–23:00 | Cena fuori               | Marco, Laura   |                             | luogo «Trattoria sotto casa» |

Cose da fare aperte: «Chiamare l'idraulico» (Marco, entro ven 19), «Pagare la mensa» (Laura, entro ven 19), «Comprare il regalo per la maestra» (privata di Marco, senza data). Spesa aperta, in quest'ordine: Latte intero (2 bottiglie, Laura), Pane integrale (Marco), Uova (Una confezione da 6, Laura), Mele, Detersivo, Caffè; presa: Burro. Scadenze: «Antiparassitario di Biscotto» mar 23 novembre 2027, ogni mese, per Biscotto; «Bollo auto» lun 29 novembre 2027, ogni anno; «Assicurazione casa» 15 gennaio 2028.

Come li vede Marco alle 15:52:

- **Lente Io:** conti `2 impegni`, `2 da fare`, `6 in spesa`. Giornata `restano 2 impegni`: 13:00 Palestra `Fino alle 14:00` (attenuata) · linea `15:52` · 17:00 Nuoto Sofia `La porta Laura, la riprendi tu` · 21:30 Liberi insieme `Tu e Laura`. Le mie cose `2 da fare`: Chiamare l'idraulico `Entro venerdì`, Comprare il regalo per la maestra.
- **Lente Nest:** conti `3 impegni`, `2 da fare`, `6 in spesa`. Giornata `restano 3 impegni`: Palestra `Tu, fino alle 14:00` · `Laura ha un impegno` `Fino alle 16:00` · linea · Nuoto Sofia · 19:30 Cena di lavoro `Laura, fino alle 21:30` · Liberi insieme. Da fare in casa `2 da fare`: Chiamare l'idraulico, Pagare la mensa.
- **Spesa:** `6`, righe Latte intero `2 bottiglie`, Pane integrale, Uova `Una confezione da 6`, `Altre 3 cose`. **Scadenze:** `3`, righe `mar 23` Antiparassitario di Biscotto `Ogni mese`, `lun 29` Bollo auto `Ogni anno`.
- **Domani (Io):** Scuola 08:10 `Li porti tu`, Calcio Tommaso 18:00 `La porti tu`; non c'è Toelettatura di Biscotto.
- Mai nel browser di Marco: `Colloquio di lavoro`, `Appuntamento in banca`.
- **Copia locale (CA-32, CA-50):** a 15:52 `expiresAt` = 18 novembre 2027 00:00 di Roma (`2027-11-17T23:00:00Z`). Per CA-50 Laura cambia la «Cena di lavoro» in `busy` e Marco cancella «Palestra» prima della lettura nuova.

## 12. Test esistenti da rifare

`tests/e2e/oggi.spec.ts`, `oggi-casa`, `oggi-da-fare`, `oggi-giorni`, `oggi-impegni`, `oggi-partenza`, `oggi-stati`, `oggi-struttura`, `oggi-visibilita`, `lente-benvenuto`, `lente-iniziale`, `pezzi-oggi-lente`; `tests/visual/oggi.spec.ts` e i riferimenti di Oggi (li rigenera il tester visivo); i test in `tests/a11y` che aprono `/oggi`. I test di altre pagine che passano da Oggi (accesso, primo avvio, invito) vanno controllati: la PR elenca quelli toccati.
