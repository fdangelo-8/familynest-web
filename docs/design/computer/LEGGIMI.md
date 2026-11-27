# Design per computer e web da telefono · passaggio al progetto

Approvato da Francesco il **25/11/2026** (Passi 10 e 11) come fonte di verità per computer e web da telefono, accanto a `docs/design/telefono/` (decisione D5 in `docs/mockup/DECISIONI.md`). **Dal 26/11/2026 i Passi 12–16 (tema scuro compreso) completano e correggono questo passaggio** (D7): tavole nelle cartelle `*-p12-16/`, guida in `docs/design/passi-12-16/LEGGIMI.md`, colori in `docs/design/tavolozza.md`, che vince su `tokens-computer.md` dove è diversa. Regole d'uso e token per l'app: skill `design-system`, `.claude/skills/design-system/riferimento/computer.md`.

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

## Passi 12–16

Le correzioni del Passo 12 (barrette, persona di prova dell'invito, «La prossima», taglia nella lista dei desideri, barra del browser in basso, errore di accesso senza rosso, «Chiama»), le risposte 177–211, le pagine che mancavano su computer e il tema scuro sono arrivati con i Passi 12–16: tavole in `docs/design/computer/*-p12-16/` e `docs/design/telefono/*-p12-16/`, guida in `docs/design/passi-12-16/LEGGIMI.md`. Le tavole di questo passaggio che hanno una versione nuova sono state tolte (elenco nella guida e in fondo al `note.md` di ogni cartella); per le altre, i colori sono quelli di `docs/design/tavolozza.md`.

## Cosa è escluso

- **Tablet**: arriva con il Passo 17.
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

## Chiarito con Fable

- **Il «respiro» dello splash lungo** (Passo 12): vale la nota, **100 ms**. Il fondo comincia a schiarirsi a 1,95 s, arriva al colore del cielo a 2,40, resta solo il cielo per un decimo di secondo, Oggi emerge da 2,50 a 2,90; durata 2,9 s. La tabella dei tempi di `splash.md` (respiro da 2,45 a 2,50 s) è superata su questo punto (`docs/design/passi-12-16/decisioni.md`).
