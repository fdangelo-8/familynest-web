# Design per computer e web da telefono · passaggio al progetto

Approvato da Francesco il **25/11/2026** (Passi 10 e 11) come fonte di verità per computer e web da telefono, accanto a `docs/design/telefono/` (decisione D5 in `docs/mockup/DECISIONI.md`). Le correzioni del Passo 12 arriveranno dopo: vedi «In attesa del Passo 12». Regole d'uso e token per l'app: skill `design-system`, `.claude/skills/design-system/riferimento/computer.md`.

Estratto il 25/11/2026 dal secondo canvas di Fable «FamilyNest: computer e web da telefono» (https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, versione 1795605754-95ff): Passo 10 e Passo 11, approvati da Francesco. Completa il passaggio del telefono in `docs/design/telefono/` e ne segue la struttura.

**149 immagini** in 15 cartelle, salvate a doppia densità (deviceScaleFactor 2: una tavola da 1280 px è un PNG da 2560 px). Larghezze: computer a 1280 px (con la barra laterale intera, o a icone quando il pannello a destra è aperto), computer largo a 1440 px, finestra stretta a 1040 px, web da telefono a 390 px. Ogni cartella ha un `note.md` con il nome di ogni PNG, la didascalia, la misura e la nota di Fable (scelte, stati, movimenti, critica onesta).

## Come leggere le cartelle

- Vale il passo più recente: **11 > 10**. Le dodici tavole della pagina «Passo 11 · Correzioni al Passo 10» hanno preso il posto delle tavole uguali del Passo 10 nelle cartelle `oggi/`, `calendario/`, `casa/` e `accesso/`. Nel `note.md` c'è anche la nota della versione del Passo 10, che spesso spiega meglio la pagina.
- Le pagine per computer adattano il telefono approvato: stessi Componenti 2.0, stessi testi, stessi dati di prova. Le regole di adattamento sono in `regole.md`; i token nuovi o diversi in `tokens-computer.md`.
- Nel web da telefono le pagine sono quelle dell'app: le cartelle mostrano solo quello che cambia nel browser.

| Cartella                         | Immagini | Contenuto                                                                                                                                                                                              | Passo                  |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `regole/`                        | 2        | Le due tavole delle regole: dal telefono al computer; mouse, tastiera e fuoco                                                                                                                          | 10, aggiornata nell'11 |
| `accesso/`                       | 9        | Accesso, errore (un fuoco solo), creazione dell'account con i consensi, primo avvio in quattro passi (modulo centrato), collegamento non riuscito, invito, Pronto · 1280                               | 10 + correzioni 11     |
| `oggi/`                          | 9        | Oggi a 1280 e 1440, pannello aperto a 1280 e a 1440, primo giorno, caricamento, senza rete, ricerca, finestra stretta (1040)                                                                           | 10 + correzioni 11     |
| `calendario/`                    | 11       | Settimana con le ore, a corsie («Mi» per Miele), giorno a colonne, mese con i segni, pannello aperto a 1280 e 1440, «Nuovo impegno» nella finestra e nel fumetto, settimana vuota, caricamento, errore | 10 + correzioni 11     |
| `casa/`                          | 7        | Spesa («Prese»), da fare, scadenze, liste da riusare (1440); spesa vuota, caricamento, senza rete                                                                                                      | 10 + correzioni 11     |
| `password-e-frase/`              | 13       | Recupero della password a due metà, la mail, link scaduto, errori; «Aggiungi con una frase» nella finestra di «Nuovo impegno», con consenso, «da verificare» ed errori                                 | 11                     |
| `animali/`                       | 8        | Biscotto e Miele, scadenza nel pannello, modifica in una finestra; appena aggiunto, caricamento, senza rete, errore                                                                                    | 11                     |
| `ricette-e-pasti/`               | 13       | Ricette, una ricetta su tre colonne, la cucina passo passo, ingredienti in spesa, ricetta scritta a mano, crediti delle foto, Pasti della settimana; stati                                             | 11                     |
| `riepilogo-e-chiedi/`            | 13       | Riepilogo della domenica su due colonne e i suoi stati; «Chiedi a …» nel pannello e a tutta pagina, energia, consenso, errori                                                                          | 11                     |
| `compleanni-e-scuola/`           | 8        | Compleanni e ricorrenze per mese; calendario scolastico nel profilo di Sofia, regione, giorni senza scuola nel mese (1440), «Scuola chiusa»                                                            | 11                     |
| `il-tuo-impostazioni-notifiche/` | 10       | «Il tuo …» a tessere, invito, profilo; Impostazioni a due colonne; notifiche nel pannello e avvisi del browser                                                                                         | 11                     |
| `piani-e-pagamento/`             | 8        | I tre piani con la tabella, caricamento, errore; pagamento sul sito, dato da correggere, riuscito, non riuscito, il vostro piano con le ricevute                                                       | 11                     |
| `web-da-telefono/`               | 11       | Barra del browser, invito ad aggiungere l'icona, avvisi del browser (anche su iPhone), avvisi bloccati, la tabella delle differenze, funzione che manca, browser vecchio, senza rete · 390             | 11                     |
| `pagine-senza-account/`          | 16       | Lista dei desideri pubblica, invito per chi non ha l'app, pagina dell'aiutante: 10 a 390 px (telefono) e 6 a 1280 px (computer)                                                                        | 11                     |
| `splash/`                        | 11       | Lo splash del telefono ritoccato: tre tempi, versione lunga, verso lo sblocco (fotogrammi fermi)                                                                                                       | 10                     |

Altri file:

- `regole.md`: larghezze, griglia, barra laterale, pannello, finestre, fumetto, ricerca, mouse e fuoco, scorciatoie, ordine di tabulazione.
- `tokens-computer.md`: solo i token nuovi o diversi rispetto a `docs/design/telefono/tokens.md`, con file e riga del canvas.
- `splash.md`: lo splash finale con la dissolvenza in tre tempi, i tempi esatti dal CSS e la versione con movimento ridotto.
- `decisioni.md`: tabella di copertura (colonne computer e web da telefono, con la cartella di ogni funzione) e domande 170–183 con le risposte.

## In attesa del Passo 12

Il Passo 12 è stato chiesto a Fable il 25/11/2026 e non è ancora nel canvas. Quando arriva, questi punti cambiano le tavole di questo passaggio: fino ad allora valgono le correzioni e le risposte scritte qui, non le tavole.

**Correzioni (sezione 1 del messaggio a Fable)**

1. Barrette colorate degli impegni nelle corsie e nel calendario: contrasto almeno 3:1 sul fondo (decisione di Francesco del 25/11). Oggi ci arrivano Tommaso (3,9) e Miele (3,5); Marco (2,4), Biscotto (2,2), Laura (1,9) e Sofia (1,6) no. Una versione più scura dello stesso colore solo per la barretta; pallino e fondo restano. Vale per telefono e computer: i valori di `tokens-computer.md` cambieranno.
2. In «Il tuo …» Laura compare come invito in attesa ma altrove vive in casa: per l'invito in attesa un'altra persona di prova.
3. «La prossima» scadenza (Biscotto): si conta dal giorno in cui è stata fatta, e la riga lo dice (per esempio «tra un mese da oggi»).
4. Lista dei desideri: «Body da danza, 8 anni» rivela l'età di Sofia; diventa una taglia in centimetri («taglia 134»).
5. Web da telefono: disegnare il caso con la barra del browser in basso (molti Android e Safari).
6. Errore di accesso: il messaggio resta, ma l'etichetta «Password» non diventa rossa; il fuoco può restare sulla password senza colorarla.
7. Indice: colonna «Che cosa c'è» più larga.
8. Chiama su computer: accanto a «Copia il numero» anche il link per chiamare.

**Risposte 177–183 da applicare** (testo completo in `decisioni.md`): striscia per sabato e domenica con il pannello aperto (177); «Mi» anche sul telefono (178); «Cena fuori» ovunque (179); casella «Questo telefono non è solo mio» nell'accesso dal browser (180); nessuna mail a chi prenota (181); link dell'aiutante spegnibile e rinnovato a ogni rinnovo (182); pagine mancanti nel Passo 12 (183).

**Pagine che mancano su computer (sezione 3 del messaggio)**, a 1280 e 1440 px, con il pannello dove serve: Spazi (le prime quattro a tessere, Esplora dentro), Contatti, Documenti, Conti, Luoghi, Novità, Proposte, Sfondi, la lista dei desideri dentro l'app, la gestione degli aiutanti (nonni e babysitter), la settimana tipo dei figli, la sintesi del mattino, i Turni; gamification e Tempo insieme se c'è spazio. Stati pieno, vuoto, errore, caricamento dove servono. Fino ad allora, per queste pagine vale il disegno per telefono adattato con `regole.md`.

## Cosa è escluso

- **Tema scuro**: non ancora disegnato; viene dopo il Passo 12, per telefono e computer.
- **Tablet**: per ultimo, dopo il tema scuro.
- Restano esclusi come nel telefono: Routine (in attesa), «trillo» (ex Citofona, da ristudiare), logo (segnaposto).
- La pagina «Indice» del canvas non è salvata come immagine: il suo contenuto è in `decisioni.md` e qui sopra.
- Le tre tavole animate dello splash («in movimento») non sono salvate come immagine: i tempi sono in `splash.md`.
- I componenti di servizio del canvas (`CNome`, `CIcone`, `CIcone2`, `CPiu`, `CBarra`, `CAggiungi`) non sono tavole.

## Regole fisse

- **Nome del prodotto** sempre dal componente unico (nel canvas `CNome`): segnaposto «FamilyNest»; la casa è «Nest» («Il tuo Nest», «Chiedi a Nest», «Energia di Nest»). Il nome definitivo cambia in un solo punto.
- **Dominio**: nelle pagine del browser c'è il segnaposto «[DOMINIO]».
- **Dati di prova**: Marco, Laura, Sofia (9 anni), Tommaso, il cane Biscotto e il gatto Miele; oggi è mercoledì 18 novembre.
- **Niente dati sanitari dei figli**; le pagine senza account mostrano il minimo (niente dati dei figli oltre al nome).
- **Prezzi** dei piani: segnaposto.

## Limiti dell'estrazione

- Le tavole sono fotografate con il visualizzatore dei canvas in locale, al loro formato reale e a doppia densità; font Figtree e Fraunces caricati, icone e foto quelle del canvas. Ogni tavola è stata ritagliata dalla sua cornice: le didascalie e le note sono nel `note.md`, non nell'immagine.
- PNG ridotti con pngquant (256 colori; con retinatura solo in `ricette-e-pasti/`, che ha le foto). Peso totale delle immagini: circa 10,4 MB.
- Le note sono il testo che Fable ha scritto sotto ogni tavola; il nome dal componente unico è ricomposto nella riga (per esempio «Il tuo Nest»).
- La tabella di copertura non è nel secondo canvas: viene dall'indice del primo, già estratto in `docs/design/telefono/decisioni-fable.md`.

## Da chiarire con Fable

- **Il «respiro» dello splash lungo.** La nota di Fable parla di «un respiro di un decimo di secondo» (100 ms) tra lo schiarimento del fondo e l'uscita verso Oggi; nel CSS del canvas il respiro va da 2,45 s a 2,50 s, cioè 50 ms (`splash.md`, tabella dei tempi). I due valori non coincidono: va chiarito con Fable quale vale. Chi sviluppa lo splash non lo sceglie da sé: scrive la domanda nella issue.
