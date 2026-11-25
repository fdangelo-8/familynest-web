# #537 · A4 · Calendario settimana: dettagli del requisito

Allegato del requisito nella issue #537. La issue contiene obiettivo, regole principali e criteri di accettazione (CA); qui ci sono i casi lunghi, i testi completi e i dati di prova. Se questo file e la issue si contraddicono, vale la issue.

Fonti: `docs/design/telefono/calendario/` (`settimana-tutti`, `settimana-tu-e-laura`, `settimana-a-corsie`, `un-giorno-libero`), `decisioni-p8/ap1-30`, `pagine-mancanti-p7/mn1-22`, `mn1-33 … mn1-35`, risposte 81, 83, 148, 174 di `decisioni-fable.md`, DB-1 (#510).

## 1. «C'entra»: la regola unica del filtro

Una persona **c'entra** in un impegno visibile se:

| Riga                                     | C'entra                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Impegno intero con persone               | è tra le persone (`member_ids`), oppure lo porta (`escort_member_id`), oppure lo riprende (`pickup_member_id`) |
| Impegno intero senza persone             | ne è l'autore (`author_member_id`)                                                                             |
| Riga mascherata («occupato» di un altro) | ne è l'autore (`author_member_id`, l'unico dato che la riga porta)                                             |

Chi ha scritto l'impegno ma non c'è dentro **non** c'entra (Marco che crea «Calcio Tommaso» per Tommaso non c'entra, se non lo porta né lo riprende). «Da decidere» non fa entrare nessuno. La stessa regola vale per il filtro, per le corsie, per l'ordine dei pallini della riga e per i sovrapposti. È una funzione pura nuova in `src/components/calendario/`, usata anche da A5 e A6; **non** cambia `isInvolved` di `src/lib/calendar.ts`, che serve alla lente di Oggi.

## 2. Testi

Tutti in `messages/it.ts` dell'area (F1 #477), con le forme del plurale di F1. `{n}` in lettere da 2 a 12 («due», «tre», …, «dodici»), in cifre da 13.

### 2.1 Descrizione sotto il filtro: `{chi}, {come}`

| Filtro                         | `{chi}`                                           |
| ------------------------------ | ------------------------------------------------- |
| «Tutti», Nest di 1 persona     | `Solo tu`                                         |
| «Tutti», Nest di n ≥ 2 persone | `Tutti e {n}` (es. `Tutti e sei`)                 |
| 1 persona: io / un altro       | `Solo tu` / `Solo {nome}`                         |
| 2 persone                      | `Tu e {nome}` / `{nome} e {nome}`                 |
| 3 persone                      | `Tu, {nome} e {nome}` / `{nome}, {nome} e {nome}` |
| 4 o più                        | `In {n}` (es. `In quattro`)                       |

Io sempre per primo come «Tu»; gli altri nell'ordine del Nest. `{come}`: `in elenco` oppure `a corsie`. Link a destra: `Vedi a corsie` in elenco, `Vedi l'elenco` a corsie. La descrizione sta in una zona `aria-live="polite"`.

### 2.2 Intestazione di un giorno (elenco)

`{Giorno N}` + informazione. I conti usano solo le righe visibili con il filtro (mascherate comprese, «Liberi insieme» esclusa).

| Giorno                                     | Informazione                                          | Chiuso?                                             |
| ------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| Passato, con impegni                       | `{n} impegni, finiti` / `1 impegno, finito`           | sì; pulsante con `aria-expanded`, si apre sul posto |
| Passato, senza                             | `niente in programma`                                 | sì; non è un pulsante                               |
| Oggi, con impegni che iniziano dopo adesso | `oggi, restano {n} impegni` / `oggi, resta 1 impegno` | no                                                  |
| Oggi, impegni tutti già iniziati           | `oggi, nient'altro in programma`                      | no                                                  |
| Oggi, senza impegni                        | `oggi, niente in programma`                           | no                                                  |
| Futuro                                     | `{n} impegni` / `1 impegno` / `niente in programma`   | no                                                  |

Il nome del giorno è quello di oggi (`dayHeading`: `Mercoledì 9`, con il mese per i giorni del secondo mese). «niente scuola» del disegno arriva con B10/DB-10 (#520): finché non c'è, non si scrive.

### 2.3 Righe dell'elenco

- **Colonna dell'ora:** `HH:MM` dell'inizio nel giorno (un impegno iniziato il giorno prima mostra `00:00`, come oggi). «Tutto il giorno» (`all_day`): `Tutto il giorno`, in cima al giorno.
- **Titolo:** il titolo; riga mascherata: `{nome} ha un impegno` (testo esistente `formatBusyLabel`, senza genere) con l'icona del lucchetto; nome accessibile esistente `formatBusyAccessibleName`.
- **Seconda riga**, in quest'ordine di precedenza:
  1. Se l'impegno ha un viaggio (chi porta, chi riprende o un «Da decidere»): la frase del viaggio (2.4).
  2. Altrimenti `{chi}, fino alle HH:MM`, dove `{chi}` sono le persone dell'impegno (figli, adulti, animali; io come `Tu`, per primo), tolte quelle il cui nome è già nel titolo (regola esistente `titleHasName`). Se `{chi}` è vuoto: `Fino alle HH:MM`.
  3. Riga mascherata: `Fino alle HH:MM`.
  4. Se l'impegno finisce in un altro giorno: `fino a {giorno lungo} alle HH:MM` (`Tu, fino a giovedì 10 giugno alle 10:00`). «Tutto il giorno» non ha seconda riga, salvo il viaggio.
- Il luogo non compare nella riga (si vede nel dettaglio, A3 #536).
- **Pallini:** le persone dell'impegno, poi chi lo porta, poi chi lo riprende, senza doppioni; con un filtro acceso, le persone scelte che c'entrano vanno per prime (nell'ordine del filtro), le altre seguono nell'ordine detto. Più di 4: l'etichetta esistente (`peopleTag`). Riga mascherata: il pallino dell'autore.

### 2.4 Frase del viaggio

Persone dell'impegno: 1 → forme singolari, più di 1 → plurali (stessa convenzione di `formatEscortPhrase`). L'andata è al passato se l'impegno è già iniziato; il ritorno se è già finito.

| Caso                    | Presente, altri / io                                              | Passato, altri / io                          |
| ----------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Porta (singolare)       | `la porta {nome}` / `la porti tu`                                 | `l'ha portata {nome}` / `l'hai portata tu`   |
| Porta (plurale)         | `li porta {nome}` / `li porti tu`                                 | `li ha portati {nome}` / `li hai portati tu` |
| Riprende (singolare)    | `la riprende {nome}` / `la riprendi tu`                           | `l'ha ripresa {nome}` / `l'hai ripresa tu`   |
| Riprende (plurale)      | `li riprende {nome}` / `li riprendi tu`                           | `li ha ripresi {nome}` / `li hai ripresi tu` |
| Porta da decidere       | `chi la porta è da decidere` / `chi li porta è da decidere`       | uguale                                       |
| Riprende da decidere    | `chi la riprende è da decidere` / `chi li riprende è da decidere` | uguale                                       |
| Tutti e due da decidere | `andata e ritorno da decidere`                                    | uguale                                       |

Andata e ritorno si uniscono con `, ` e la prima lettera diventa maiuscola: `La porta Laura, la riprendi tu`. Le frasi stanno in **un solo punto** condiviso (richiesta condivisa nella issue); oggi `formatEscortPhrase` copre solo il presente di «porta».

### 2.5 Altri testi, stati e accessibilità della settimana

| Dove                         | Testo o comportamento                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gruppo del filtro            | `role="group"`, nome accessibile `Chi vedi`; pulsante `Tutti`; pallini con nome accessibile = nome della persona; tutti con `aria-pressed`                                                                                        |
| Pulsante                     | `Manda la settimana` (icona WhatsApp)                                                                                                                                                                                             |
| Corsie, didascalia           | `In ogni giorno: mattina, pomeriggio, sera. L'ultima riga è «Liberi insieme».`                                                                                                                                                    |
| Corsie, tabella              | `<table>` con didascalia nascosta `Chi è preso, {annuncio della settimana}` (es. `Chi è preso, settimana dal 7 al 13 giugno`); intestazioni di riga = nomi; riga finale `Liberi insieme`                                          |
| Corsie, cella                | fasce occupate separate da `, ` (es. `mattina, pomeriggio`) oppure `libero`; riga Liberi insieme: `la sera` oppure `no`                                                                                                           |
| Corsie, giorno               | pulsante con testo visibile `{lun}` `{9}` e nome accessibile che comincia con il testo visibile seguito dal giorno lungo; `aria-pressed` sul giorno scelto                                                                        |
| Vuoto, «Tutti»               | testi esistenti: `Questa settimana è ancora vuota` / `Gli impegni che aggiungi compaiono qui, giorno per giorno.` / `Aggiungi un impegno` (in elenco e a corsie)                                                                  |
| Vuoto, con filtro            | titolo `Settimana libera, per {chi2}`; testo `Nessun impegno per {chi3}. Gli altri hanno {n} impegni.` (singolare `Gli altri hanno 1 impegno.`; {n} = righe visibili della settimana con «Tutti»); pulsante `Aggiungi un impegno` |
| Caricamento                  | scheletro con `aria-busy="true"` e testo nascosto `Caricamento in corso`; intervallo, frecce, selettore già visibili                                                                                                              |
| Errore alla prima lettura    | pagina d'errore esistente (`ErrorMain`) con `Riprova`                                                                                                                                                                             |
| Errore dopo una lettura      | testo esistente `Non riusciamo ad aggiornare il calendario. Vedi gli impegni salvati alle HH:MM.` + `Riprova`; il contenuto resta                                                                                                 |
| Errore di un'altra settimana | testo esistente `Non riusciamo a caricare questa settimana. Controlla la connessione e riprova.` + `Riprova`                                                                                                                      |
| Dopo «Riprova»               | se l'avviso sparisce col fuoco su «Riprova», il fuoco va al titolo della settimana (come oggi)                                                                                                                                    |

`{chi2}`: 1 persona → `te` o `{nome}`; 2 → `tutti e due`; n → `tutti e {n}`. `{chi3}`: come `{chi}` di 2.1 senza «Solo», in minuscolo, con `te` al posto di `tu` (`te e Laura`, `Miele`).

## 3. Corsie

- Una riga per persona del filtro («Tutti» = tutte, nell'ordine del Nest); in fondo la riga «Liberi insieme» (icona cuore) se «Liberi insieme» si vede (regola 5 della issue).
- Sette colonne lun–dom; tre fasce per giorno, ora di Roma: **mattina** 00:00–13:00, **pomeriggio** 13:00–19:00, **sera** 19:00–24:00.
- Una fascia è piena (colore della persona) se almeno un impegno in cui la persona c'entra (sezione 1) ha `inizio < fine fascia` e `fine > inizio fascia`. Gli impegni «Tutto il giorno» non riempiono fasce (come in DB-1 per Liberi insieme e sovrapposti). Le righe mascherate riempiono la riga del loro autore. Gli impegni `private` degli altri non arrivano dal database e non riempiono niente.
- Riga «Liberi insieme»: solo la fascia sera, gialla, nei giorni con una sera «Liberi insieme» (stesso calcolo dell'elenco).
- La colonna del giorno scelto è evidenziata; il giorno scelto all'apertura è oggi se la settimana lo contiene, altrimenti lunedì. Sotto la tabella c'è l'elenco del solo giorno scelto, con la stessa intestazione e le stesse righe dell'elenco (non chiuso, anche se passato).
- Le ore delle fasce sono un default dell'analista ricavato da `settimana-a-corsie.png` (domanda aperta 3): stanno in una costante sola.

## 4. Sovrapposti nell'elenco

- Fonte: `list_event_overlaps(p_from, p_to)` di DB-1 sulla settimana (7 giorni). Una riga dell'elenco è «sovrapposta» se la funzione la restituisce per una persona visibile con il filtro («Tutti» = tutte). Abbinamento: righe intere per `event_id` + `starts_at`; righe mascherate per `member_id` = autore + `starts_at` + `ends_at`.
- Le righe sovrapposte di uno stesso giorno che si toccano nel tempo e sono consecutive nell'elenco stanno in un solo contorno rosso con l'etichetta `Alla stessa ora` (come `mn1-22`). Una riga non sovrapposta che cade in mezzo divide il contorno in due; ognuna delle parti ha l'etichetta.
- Nelle corsie non c'è nessun segno (non disegnato).
- La lettura dei sovrapposti fa parte della lettura della settimana: se fallisce, fallisce la settimana (LEZIONI: niente `ok: true` con un pezzo mancante).

## 5. Il messaggio della settimana

Rotta `/calendario/messaggio?settimana=<lunedì YYYY-MM-DD>` (settimana mancante o non valida → quella di oggi, con la regola di `parseWeekParam`).

### 5.1 Che cosa entra

Solo impegni con `visibility = household` (mai `busy`, `private`, `selected`, né righe mascherate, **nemmeno i propri**), dei 7 giorni della settimana scelta, scelti dagli interruttori:

| Interruttore                   | Di partenza | Effetto                                                  |
| ------------------------------ | ----------- | -------------------------------------------------------- |
| `Gli impegni dei figli`        | acceso      | impegni con almeno un figlio tra le persone              |
| `Chi porta e chi riprende`     | acceso      | la parte `. Porta …, riprende …`                         |
| `Le cose ancora da decidere`   | acceso      | la sezione `Da decidere`                                 |
| `Gli impegni di tutta la casa` | spento      | gli altri impegni `household` (adulti, animali, nessuno) |
| `Compleanni e ricorrenze`      | spento      | **nascosto** finché B9 (#387) e DB-11 (#521) non ci sono |

Mai nel testo: luogo, note, persone scelte, ore di fine, link, nome dell'app. Il filtro del calendario non conta: contano solo gli interruttori.

### 5.2 Forma del testo (copiato e inviato)

```
*La settimana di {nome del Nest}*
{intervallo come il titolo della settimana}

*{Gio} {10}* · {HH:MM} {titolo}[. {viaggio}] · {HH:MM} {titolo}[. {viaggio}]
…

*Da decidere*
{riga}
…
```

- Asterischi = grassetto di WhatsApp; nel riquadro della pagina si vedono come grassetto, senza asterischi. Righe separate da `\n`, una riga vuota tra i blocchi, nessuno spazio in fondo.
- Un giorno compare solo se ha almeno un impegno incluso; impegni in ordine di inizio. «Tutto il giorno»: al posto dell'ora `tutto il giorno`.
- `{titolo}`: il titolo con la prima lettera minuscola, salvo se la prima parola è il nome di una persona del Nest (`Nuoto Sofia` → `nuoto Sofia`; `Sofia dal nonno` resta così).
- `{viaggio}` (solo con «Chi porta e chi riprende» acceso; sempre il nome, mai «tu»): `Porta {nome}`, `Riprende {nome}`, `Porta {nome}, riprende {nome}`. Le parti «Da decidere» non vanno qui.
- Sezione `Da decidere` (solo con l'interruttore acceso e almeno una riga): una riga per impegno incluso con un viaggio «Da decidere»: `Chi porta {persone} {giorno della settimana} ({HH:MM} {titolo})`; per il ritorno `Chi riprende …`; per tutti e due `Chi porta e chi riprende …`. `{persone}` = i figli dell'impegno (`Sofia`, `Sofia e Tommaso`); se non ci sono figli, le persone dell'impegno; se nessuna, la parola si toglie. Esempio: `Chi porta Sofia giovedì (17:00 danza Sofia)`.
- Nessun impegno incluso: dopo l'intervallo una riga vuota e `Niente in programma.`

### 5.3 Pagina e azioni

| Elemento                              | Comportamento                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freccia indietro                      | torna a `/calendario?settimana=<stessa settimana>`                                                                                                                                                                                                                                                                                                                                                            |
| Titolo                                | `Il messaggio della settimana` (h1); sotto `Pronto da incollare nella chat di famiglia o da mandare ai nonni.`                                                                                                                                                                                                                                                                                                |
| Riquadro                              | il testo di 5.2, aggiornato a ogni cambio; selezionabile                                                                                                                                                                                                                                                                                                                                                      |
| `Che cosa mettere`                    | riga con sottotitolo = parti accese separate da `, ` (`Impegni dei figli`, `viaggi`, `da decidere`, `impegni di casa`; prima lettera maiuscola), oppure `Niente`; apre il foglio (F4c) con i 4 interruttori, `Mai dentro` / `Impegni privati, spesa, cose da fare, scadenze, documenti, conti. Quello che esce dall'app lo decidi tu, riga per riga.` e `Fatto`. `Fatto` applica, la X chiude senza cambiare. |
| `Quale settimana`                     | riga con sottotitolo = scelta attuale; apre un foglio con la settimana di partenza, `Questa settimana` e `La prossima`, senza doppioni, in ordine di tempo. Etichette: `Questa settimana, {intervallo}`, `La prossima, {intervallo}`, altrimenti `{intervallo}`. Scegliere chiude il foglio e aggiorna testo e indirizzo (`?settimana=`, con `replaceState`).                                                 |
| Nota                                  | `Dentro non ci sono mai gli impegni privati, la spesa, le scadenze di casa.`                                                                                                                                                                                                                                                                                                                                  |
| `Copia`                               | copia il testo 5.2 negli appunti; avviso (F4a) `Copiato. Incollalo dove vuoi.` con l'azione `Apri WhatsApp`; una vibrazione breve (≤ 20 ms) solo dove il browser ha `navigator.vibrate`                                                                                                                                                                                                                       |
| `Manda su WhatsApp` e `Apri WhatsApp` | aprono in una nuova scheda `https://wa.me/?text=` + `encodeURIComponent(testo 5.2)` (`noopener`)                                                                                                                                                                                                                                                                                                              |
| Copia non riuscita                    | avviso `Non riusciamo a copiare. Tieni premuto sul testo per copiarlo a mano.`                                                                                                                                                                                                                                                                                                                                |
| Caricamento                           | riquadro a scheletro con `aria-busy="true"`; `Copia` e `Manda su WhatsApp` con `aria-disabled="true"`                                                                                                                                                                                                                                                                                                         |
| Errore di lettura                     | avviso di errore `Non riusciamo a preparare il messaggio. Controlla la connessione e riprova.` + `Riprova`; pulsanti con `aria-disabled="true"`                                                                                                                                                                                                                                                               |

Interruttori e settimana scelta vivono nella pagina (memoria): non si salvano sul telefono né sul server. Negli analytics al massimo eventi generici (`week_message_copied`, `week_message_whatsapp`), mai il testo.

## 6. Stato condiviso tra Giorno, Settimana e Mese

- Filtro (persone scelte) e modo (elenco o corsie) stanno in memoria in un componente client montato da `src/app/(app)/calendario/layout.tsx` (area della pagina): restano passando tra Giorno, Settimana, Mese e messaggio e cambiando settimana; tornano «Tutti» ed «elenco» ricaricando la pagina o uscendo dall'area.
- Non vanno nell'indirizzo né in `localStorage`/`sessionStorage`: gli id delle persone non escono dalla memoria della pagina, e non c'è niente da cancellare all'uscita.
- Una persona che non è più nel Nest si toglie dal filtro in silenzio; se il filtro resta vuoto torna «Tutti».
- Giorno (A5) e Mese (A6) leggeranno lo stesso stato; A4 lo prepara e lo usa solo nella Settimana e nel messaggio (che lo ignora).

## 7. Predisposizione per il computer (risposta 174, default 1 del piano)

- Oggi a tutte le larghezze: il contenuto del telefono in una colonna centrata, con la barra laterale di F5 (#506). Spariscono dalla settimana la griglia con le ore da computer, i pannelli a destra (impegno, altri, sere) e la lente: la lente non cambia il calendario.
- La scelta della disposizione passa da **una funzione pura**, per esempio `weekArrangement({ wide, lens, choice })` → `"elenco" | "corsie" | "ore"`: oggi restituisce sempre `choice`. Quando arriva il secondo canvas cambia solo lei: a computer «Nest» → `corsie`, «Io» → `ore` (risposta 174).
- Le funzioni pure della griglia con le ore (`layoutDay`, `hoursSinceGridStart`) possono restare nel modello con i loro test; i componenti da computer non più usati si tolgono.

## 8. Dati di prova dei CA

Nest A «Casa Bianchi»: Marco (adulto, utente dei test, corallo), Laura (adulta, glicine), Sofia (figlia, menta), Tommaso (figlio, blu), Biscotto (animale, ambra), Miele (animale, cannella), creati in quest'ordine. Nest B: Paolo (adulto), un impegno «Riunione condominio» mercoledì 9 giugno 2027 20:00–21:00.

Settimana **7–13 giugno 2027**; adesso = **mercoledì 9 giugno 2027, 15:52** di Roma (`page.clock.pauseAt`). Impegni del Nest A, tutti `household` e scritti da Marco se non detto:

| #   | Giorno | Ora             | Titolo                | Persone        | Viaggio                     | Note                     |
| --- | ------ | --------------- | --------------------- | -------------- | --------------------------- | ------------------------ |
| 1   | lun 7  | 10:00–11:00     | Spesa grande          | Marco          |                             |                          |
| 2   | lun 7  | 18:00–19:00     | Corso di inglese      | Laura          |                             |                          |
| 3   | mer 9  | 08:10–13:00     | Scuola                | Sofia, Tommaso | porta Laura                 |                          |
| 4   | mer 9  | 09:30–11:00     | Riunione di progetto  | Marco          |                             | luogo «Milano»           |
| 5   | mer 9  | 12:30–14:00     | Pranzo con Chiara     | Laura          |                             |                          |
| 6   | mer 9  | 15:00–16:00     | Appuntamento in banca | Laura          |                             | `busy`, autrice Laura    |
| 7   | mer 9  | 17:00–18:30     | Nuoto Sofia           | Sofia          | porta Laura, riprende Marco |                          |
| 8   | gio 10 | 17:00–18:00     | Danza Sofia           | Sofia          | porta «Da decidere»         |                          |
| 9   | gio 10 | 17:00–18:30     | Commercialista        | Marco          |                             |                          |
| 10  | gio 10 | 18:00–19:00     | Calcio Tommaso        | Tommaso        | porta Marco                 |                          |
| 11  | ven 11 | 09:00–10:00     | Colloquio di lavoro   | Marco          |                             | `busy`, autore Marco     |
| 12  | ven 11 | 15:00–16:00     | Impegno di Laura      | Laura          |                             | `busy`, autrice Laura    |
| 13  | sab 12 | 10:00–11:00     | Toelettatura Biscotto | Biscotto       |                             |                          |
| 14  | sab 12 | 10:00–11:00     | Regalo per Marco      | Laura          |                             | `private`, autrice Laura |
| 15  | dom 13 | tutto il giorno | Giornata al mare      | Marco          |                             | `all_day`                |

Martedì 8 non ha impegni. I titoli di 6, 12 e 14 non devono mai arrivare al browser di Marco. Con questi dati, come li vede Marco:

- **Elenco, «Tutti»:** lunedì `2 impegni, finiti` (chiuso); martedì `niente in programma`; mercoledì `oggi, resta 1 impegno` con le righe 3, 4, 5, 6 (`Laura ha un impegno`), la linea `15:52`, la 7, poi «Liberi insieme» dalle 18:30; giovedì `3 impegni` (8, 9, 10; 9 e 10 nel contorno `Alla stessa ora`); venerdì `2 impegni` (11 intera, perché è di Marco; 12 mascherata); sabato `1 impegno` (13; la 14 non esiste); domenica `1 impegno` (15). In tutto 14 righe visibili.
- **Frasi:** riga 3 `Li ha portati Laura` (iniziata); riga 7 `La porta Laura, la riprendi tu`; riga 8 `Chi la porta è da decidere`; riga 10 `La porti tu`; riga 4 `Tu, fino alle 11:00`; riga 5 `Laura, fino alle 14:00`; riga 6 `Fino alle 16:00`.
- **Filtro {Marco, Laura}:** restano 1–7, 9–12, 15; spariscono 8 e 13. Riga 3: primo pallino Laura.
- **Filtro {Miele}:** vuoto con filtro, `Settimana libera, per Miele` / `Nessun impegno per Miele. Gli altri hanno 14 impegni.`
- **Corsie, «Tutti»:** Marco/mer = `mattina, pomeriggio`; Laura/mer = `mattina, pomeriggio`; Laura/ven = `pomeriggio`; Laura/sab = `libero`; Marco/dom = `libero`; Biscotto/sab = `mattina`; «Liberi insieme»/mer = `la sera`.
- **Messaggio, interruttori di partenza** (testo copiato esatto):

```
*La settimana di Casa Bianchi*
7 – 13 giugno

*Mer 9* · 08:10 scuola. Porta Laura · 17:00 nuoto Sofia. Porta Laura, riprende Marco
*Gio 10* · 17:00 danza Sofia · 18:00 calcio Tommaso. Porta Marco

*Da decidere*
Chi porta Sofia giovedì (17:00 danza Sofia)
```

- **Messaggio con anche «Gli impegni di tutta la casa»:** si aggiungono 1, 2, 4, 5, 9, 13, 15; mai 6, 11, 12, 14 né «Milano».
