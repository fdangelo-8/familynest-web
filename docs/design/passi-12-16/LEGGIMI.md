# Design dei Passi 12–16 · passaggio al progetto (telefono, web da telefono, computer)

Approvato da Francesco dopo il Passo 16 (decisione D7 in `docs/mockup/DECISIONI.md`): è la fonte di verità per telefono, web da telefono e computer insieme a `docs/design/telefono/` (Passi 1–9) e `docs/design/computer/` (Passi 10–11), e vince su di loro dove è diverso. **Il tema scuro c'è al lancio** (decisione di Francesco del 26/11). Il tablet resta fuori: arriva con il Passo 17 in `docs/design/tablet/`.

Estratto il 26/11/2026 dal secondo canvas di Fable «FamilyNest: computer e web da telefono» (https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, versione 1795707258-333f), dove ci sono tutte le tavole dei Passi 12–16, anche quelle del telefono (risposta 199). Dal primo canvas «FamilyNest: nuovo design» (https://claude.ai/artifact/8VKqAujpP3P8TmqSyetXfE, versione 1795707290-756f) vengono il testo delle domande 177–211 e le correzioni fatte sul posto.

**348 immagini per 209 tavole**: 139 in chiaro, 204 in scuro, 5 tavole uniche (valori e regole). Doppia densità (una tavola da 1280 px è un PNG da 2560 px), ritagliate dalla loro cornice, ridotte con pngquant: circa 39,5 MB. Larghezze: computer 1280 e 1440 px, telefono e web da telefono 390 px.

## I file

| File                                  | Che cosa c'è                                                                                                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/tavolozza.md`, `.json`   | **La fonte di verità dei colori**, comune ai formati: 73 ruoli (75 dal Passo 17) con il valore chiaro e quello scuro, colori delle persone, tinte delle barrette, regola del pallino, scena della notte, contrasti del tema scuro. |
| `regole-tema-scuro.md`                | Come si accende il tema scuro, scena della notte, foto, email, splash, pallino, verde petrolio #1F7D8A con il bianco, bordo dei campi #869390.                                                                                     |
| `decisioni.md`                        | Domande 177–211 con le risposte di Francesco e dove sono applicate; decisioni di Francesco fuori dalle domande; che cosa scrive il canvas e non è una domanda.                                                                     |
| `<formato>/<area>-p12-16/note.md`     | Per ogni tavola: nome dei PNG, didascalia, misura, passo, pagina del canvas, nota di Fable e, se c'è, la nota della tavola al buio. In cima le note delle pagine del canvas.                                                       |
| skill `design-system`, `riferimento/` | Traduzione per l'app: `token.md` (tavolozza comune in chiaro e al buio, pallino, barrette, notte, regole del tema scuro), `telefono.md` e `computer.md` (rimandi). I token nel CSS li cambia una `richiesta-condivisa`.            |

## Dove stanno le tavole

Ogni area del passaggio ha una cartella con il suffisso `-p12-16`, come le cartelle per passo del telefono (`ritocchi-p6`, `splash-p9`): le tavole del computer in `docs/design/computer/<area>-p12-16/`, quelle del telefono e del web da telefono in `docs/design/telefono/<area>-p12-16/`. Il `note.md` di ogni cartella ha solo le tavole di quel formato.

- **Nomi dei file**: `NN-didascalia[-telefono|-web]-chiaro.png` e `…-scuro.png` per la stessa tavola. Senza suffisso è computer. Le tavole uniche non hanno `-chiaro`/`-scuro`.
- Fanno eccezione `splash-scuro-p12-16/`, tutta nel telefono (anche la tavola dei tempi `06-…`, larga 870 px), e `regole-e-valori-p12-16/`, nel computer ma comune ai formati.
- **Vale il passo più recente** (16 > 15 > 14 > 13 > 12). Dentro il passaggio è già tenuta solo la versione più recente (il `note.md` lo dice con «Sostituisce»).

| Area                              | Computer | di cui `scuro-derivato/` | Telefono e web | di cui `scuro-derivato/` |
| --------------------------------- | -------: | -----------------------: | -------------: | -----------------------: |
| `regole-e-valori`                 |        4 |                        — |              — |                        — |
| `calendario`                      |       18 |                        3 |              6 |                        — |
| `oggi`                            |        5 |                        — |              3 |                        — |
| `casa-e-animali`                  |        9 |                        2 |              8 |                        — |
| `accesso-profilo-impostazioni`    |        9 |                        1 |              7 |                        — |
| `spazi`                           |       10 |                        4 |              1 |                        — |
| `contatti-documenti-conti-luoghi` |       50 |                       19 |              4 |                        — |
| `desideri-e-aiutanti`             |       26 |                       11 |              1 |                        — |
| `turni-settimana-tipo-sintesi`    |       28 |                       12 |              2 |                        — |
| `novita-proposte-sfondi`          |       16 |                        7 |              2 |                        — |
| `gamification`                    |       56 |                       23 |              7 |                        — |
| `partenza-messaggio-foto-mail`    |       38 |                       17 |              — |                        — |
| `ricette-pasti-riepilogo-chiedi`  |        4 |                        — |              6 |                        — |
| `web-da-telefono-e-senza-account` |        2 |                        — |              8 |                        4 |
| `stati-piani-compleanni`          |        2 |                        — |              5 |                        — |
| `splash-scuro`                    |        — |                        — |             11 |                        — |

I numeri sono immagini (PNG), comprese quelle di `scuro-derivato/`.

## Le tavole scure in `scuro-derivato/`: non sono di Fable

**103 tavole scure non le ha disegnate Fable.** Il canvas non ha quelle tavole al buio: le ha ricavate l'agente di estrazione applicando alla tavola chiara la tavolozza scura del canvas (la classe `th-d`, come fa Fable: «nessuna pagina è ridisegnata, sono le tavole approvate con la tavolozza scura») e, dove c'è, mettendo la scena della notte al posto di quella del giorno. Le foto restano come sono.

- **Non sono approvate una per una da Francesco.** Sono una prova della regola, utile per vedere come viene una pagina al buio, non un disegno da copiare.
- **La fonte di verità resta la tavolozza** (`docs/design/tavolozza.md` e i ruoli in `riferimento/token.md`): se una tavola di `scuro-derivato/` e la tavolozza dicono cose diverse, vale la tavolozza.
- Stanno in una sottocartella `scuro-derivato/` dentro ogni cartella d'area, e nel `note.md` sono scritte «ottenuto da me».
- Se Francesco vuole vederle approvate una per una, vanno chieste a Fable.

Le altre tavole scure vengono dal canvas: disegnate da Fable in coppia con il chiaro (Passi 14–16), oppure solo al buio per pagine già approvate nei Passi 5–11, il cui chiaro è già in `docs/design/telefono/` o `docs/design/computer/`.

## Tavole vecchie sostituite

La versione dei Passi 12–16 ha preso il posto di queste tavole; la vecchia resta nella storia git e il `note.md` della cartella vecchia lo dice in fondo («Tavole sostituite dai Passi 12–16»).

| Tavola tolta                                                        | Al suo posto (in `docs/design/`)                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `computer/accesso/02-accesso-mail-o-password-sbagliate.png`         | `computer/accesso-profilo-impostazioni-p12-16/01-accesso-mail-o-password-non-corrispondono-chiaro.png` |
| `computer/il-tuo-impostazioni-notifiche/01-il-tuo-nest.png`         | `computer/accesso-profilo-impostazioni-p12-16/12-il-tuo-nest-chiaro.png`                               |
| `computer/il-tuo-impostazioni-notifiche/02-un-invito-in-attesa.png` | `computer/accesso-profilo-impostazioni-p12-16/02-il-tuo-nest-l-invito-in-attesa-chiaro.png`            |
| `computer/calendario/01-settimana-con-le-ore.png`                   | `computer/calendario-p12-16/01-settimana-con-le-ore-chiaro.png`                                        |
| `computer/calendario/02-settimana-a-corsie-miele-e-mi.png`          | `computer/calendario-p12-16/05-settimana-a-corsie-chiaro.png`                                          |
| `computer/calendario/03-giorno-a-colonne-chi-e-dove.png`            | `computer/calendario-p12-16/12-giorno-a-colonne-le-iniziali-chiaro.png`                                |
| `computer/calendario/04-mese.png`                                   | `computer/calendario-p12-16/06-il-mese-chiaro.png`                                                     |
| `computer/calendario/05-settimana-pannello-aperto-1280-px.png`      | `computer/calendario-p12-16/02-settimana-pannello-aperto-1280-px-chiaro.png`                           |
| `computer/calendario/07-nuovo-impegno.png`                          | `computer/calendario-p12-16/13-per-chi-chiaro.png`                                                     |
| `computer/animali/01-animali-biscotto.png`                          | `computer/casa-e-animali-p12-16/01-animali-chiamare-dal-chiaro.png`                                    |
| `computer/animali/03-una-scadenza-con-fatta.png`                    | `computer/casa-e-animali-p12-16/02-la-prossima-da-confermare-chiaro.png`                               |
| `computer/oggi/01-oggi-1280-px.png`                                 | `computer/oggi-p12-16/01-oggi-il-viaggio-del-calcio-chiaro.png`                                        |
| `computer/ricette-e-pasti/08-pasti-la-settimana.png`                | `computer/ricette-pasti-riepilogo-chiedi-p12-16/p17-01-pasti-chiaro.png` (Passo 17)                    |
| `computer/pagine-senza-account/05-computer-la-lista.png`            | `computer/web-da-telefono-e-senza-account-p12-16/p17-01-la-lista-dal-link-chiaro.png` (Passo 17)       |
| `computer/pagine-senza-account/01-telefono-la-lista.png`            | `telefono/web-da-telefono-e-senza-account-p12-16/p17-01-la-lista-dal-link-web-chiaro.png` (Passo 17)   |
| `computer/pagine-senza-account/04-telefono-link-spento.png`         | `telefono/web-da-telefono-e-senza-account-p12-16/04-aiutante-link-spento-o-scaduto-web-chiaro.png`     |
| `telefono/calendario/giorno-insieme.png`                            | `telefono/calendario-p12-16/14-il-giorno-telefono-chiaro.png`                                          |
| `telefono/ricette/rc1-14-una-ricetta-vostra-senza-foto.png`         | `telefono/ricette-pasti-riepilogo-chiedi-p12-16/07-una-ricetta-senza-foto-telefono-chiaro.png`         |

Le altre tavole nuove sono pagine o stati che prima non c'erano e si aggiungono. Due tavole del telefono aggiornano pagine disegnate più volte nei passi precedenti, e lì le vecchie non sono tolte: «Il tuo Nest», con i propositi (`telefono/accesso-profilo-impostazioni-p12-16/11-…`), vince su `telefono/animali/4-10-il-tuo-nest.png` e `telefono/scelte-p7/sc1-19-il-tuo-nest.png`; «La prossima», da confermare (`telefono/casa-e-animali-p12-16/04-…`), vince su `telefono/animali/4-4-la-prossima.png` per i pulsanti e la riga «Tra un mese da oggi».

**Tavole già approvate corrette sul posto** nel canvas (barrette, «Mi», «Cena fuori», dati di prova, bordo dei campi, iniziali, regola del pallino, taglia, segnaposto): l'estrazione non le ha fotografate di nuovo. Le tavole in `docs/design/telefono/` e `docs/design/computer/` che non sono nella tabella qui sopra restano quelle di prima (per esempio con le barrette e il bordo dei campi vecchi): **per i colori vale la tavolozza**, per il resto le correzioni scritte in `decisioni.md`.

## Passo 17 (arrivato)

> **Aggiornamento del 26/11/2026:** il Passo 17 è approvato (D8 in `docs/mockup/DECISIONI.md`). I cinque punti qui sotto sono disegnati: le tavole corrette sono nelle cartelle `*-p12-16/` con il prefisso `p17-`, il tablet è in `docs/design/tablet/`, le domande 212–219 e la barretta di Tommaso al buio (#4E7BE2, deciso) in `docs/design/tablet/decisioni.md`. Il testo che segue resta come memoria.

Il Passo 17 è l'ultimo: chiude il tablet e qualche dettaglio. Fable non tocca più le tavole approvate di telefono, web da telefono e computer, salvo questi punti. **Fino ad allora valgono le correzioni qui sotto, non le tavole.**

1. «Nessuno, per ora» usa il testo secondario (`--c-testo2`) anche in «Chi porta, chi riprende», su computer e tablet.
2. Pagina «Piani»: #BFE5E1 va portato nella tavolozza; al buio le due icone almeno a 3 a 1.
3. Pasti senza foto: segnaposto sabbia con l'icona del piatto anche su computer; la stessa icona in tutti gli schermi delle ricette (210).
4. Lista dei desideri aperta da link: togliere «N. 33», il numero di scarpe (decisione di Francesco, D7). Dentro l'app resta.
5. Pulizie: la nota «solo azzurro» sotto lo splash scuro (valgono i valori di `regole-tema-scuro.md` §5); lo splash che copre l'accesso.

Chi sviluppa applica già i punti 1–4 e la regola dell'altezza della risposta 208 (sotto 600 px di altezza si usa sempre la forma del telefono, anche sul web da telefono e sul computer).

## Da chiarire

- **Barretta di Tommaso al buio.** La tavola della tavolozza dice `--c-tommaso-barra` #4E7BE2 (3,5 : 1 sul fondo dell'impegno #1B2D49); il foglio di stile del canvas dà alla classe `pT` il ruolo `--c-tommaso`, #3F6FE0, che al buio arriva solo a 3,0 : 1. **Deciso nel Passo 17: #4E7BE2** (`docs/design/tablet/decisioni.md`).
- I quattro colori liberi della tavolozza delle persone (rosa, azzurro, sabbia, ardesia) non hanno valori scuri; il rosa è diventato `--c-rosa` (chi è invitato), uguale nei due temi.
- Fable non elenca uno per uno «gli ultimi cinque colori» portati nella tavolozza nel Passo 16: in `tavolozza.md` §6 c'è quello che dicono le note.

## Limiti dell'estrazione

- Le tavole sono fotografate con il visualizzatore dei canvas in locale, al loro formato reale; font Figtree e Fraunces caricati, icone e foto quelle del canvas. Didascalie e note sono nel `note.md`, non nell'immagine.
- Le tre tavole animate dello splash scuro non sono salvate come immagine: i tempi sono nella tavola dei tempi (`telefono/splash-scuro-p12-16/06-…`) e in `docs/design/computer/splash.md`. Il fotogramma «3 · Oggi emerge» è fermo a metà dissolvenza.
- La pagina «Indice» del secondo canvas non è salvata come immagine: domande e stato sono in `decisioni.md`.
- Le tavole del tablet dei Passi 16 e quelle dentro le pagine delle correzioni non sono estratte.
