# Design del tablet (Passi 16 e 17) · passaggio al progetto

Approvato da Francesco con il Passo 17, l'ultimo passo di design (decisione D8 in `docs/mockup/DECISIONI.md`). Con questa cartella **il design è completo sui quattro formati**: telefono (`docs/design/telefono/`), web da telefono e computer (`docs/design/computer/`), Passi 12–16 (`docs/design/passi-12-16/`) e tablet (qui). Le decisioni D1–D8 vincono sulle tavole.

Estratto il 26/11/2026 dal secondo canvas di Fable «FamilyNest: computer e web da telefono» (https://claude.ai/artifact/PVgH6JrYhzhkPXu6js4Ktc, versione 1795711570-0525), pagine «Passo 16 · Tablet · …» e «Passo 17 · …». Dal primo canvas «FamilyNest: nuovo design» (https://claude.ai/artifact/8VKqAujpP3P8TmqSyetXfE, versione 1795714346-c681) vengono il testo delle domande 212–219 e il giudizio di Fable sul design.

**104 immagini per 53 tavole**: 51 in chiaro, 51 in scuro (19 dal canvas, 32 ottenute da me), 2 tavole uniche (regole e tabella dei 44 px). Doppia densità (una tavola da 1194 px è un PNG da 2388 px), ritagliate dalla loro cornice, ridotte con pngquant: **14,5 MB**. Misure: in orizzontale 1194 × 834 e 1024 × 768 px, in verticale 768 × 1024 e 834 × 1112 px.

## Il principio

Il tablet **non ha pagine sue**: conta la finestra, non l'apparecchio. Stesse pagine, stessi testi, stessi dati di prova, stesso nome dal componente unico, stesso logo. Cambiano solo la disposizione e le misure del tocco.

## Le regole (versione finale, tavola `regole/01-…`)

| Finestra                                                               | Che cosa succede                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta meno di 600 px, qualunque larghezza (un telefono grande girato)   | Sempre la forma del telefono: barra in basso, una colonna (risposte 208 e 213).                                                                                                                                                                                            |
| Larga meno di 900 px (tablet in verticale 768–834 px, metà schermo)    | Le pagine del telefono con la barra in basso. Liste e moduli in una colonna di 640 px al centro; «Nuovo impegno» e il dettaglio come foglio dal basso largo 640 px; il mese con la griglia del computer e i titoli; la scena di Oggi con il suo disegno largo (768 × 300). |
| Da 900 a 1279 px, alta almeno 600 (tablet in orizzontale 1024–1194 px) | Le pagine del computer con la barra laterale a sole icone. Il dettaglio nel pannello a destra (380 px); «Nuovo impegno» in una finestra; dove i volti non stanno (1024 px, tutta la casa) diventano «Chi vedo».                                                            |
| Da 1280 px                                                             | Tutto come il computer, barra laterale intera.                                                                                                                                                                                                                             |

Le stesse soglie valgono per tutta l'app (risposta 214): la tavola delle regole del computer è aggiornata in `docs/design/computer/regole/p17-01-…`.

- **Rotazione**: la pagina resta la stessa, nello stesso punto (stessa data, stessa riga in cima); la navigazione passa dalla barra in basso a quella laterale con la voce scelta; quello che è aperto resta aperto (il foglio diventa pannello o finestra, con quello che avevi scritto); il fuoco resta sullo stesso elemento; dissolvenza di 200 ms, immediata con il movimento ridotto.
- **Tocco**: ogni area almeno 44 × 44 px. Nelle pagine del computer usate sul tablet i comandi piccoli salgono a 44 px quando l'ultimo gesto è stato un tocco (cartella `orizzontale-comandi-44-px/`). Nel mese col dito si tocca la cella del giorno (risposta 218).
- **Tastiera esterna**: le scorciatoie del computer; le lettere accanto ai comandi compaiono solo con la tastiera collegata; l'anello del fuoco quando si usa la tastiera.
- **Mouse o trackpad**: come sul computer, compreso il fumetto dei titoli lunghi; le misure tornano quelle del computer.
- **Tema**: chiaro e scuro seguono il sistema; al buio la scena è la notte.
- **Splash e accesso**: lo splash è quello del telefono, centrato; l'accesso in verticale è quello del telefono, in orizzontale quello del computer a due metà.
- **Stati** (vuoto, caricamento, errore, senza rete): nessuna tavola propria; in verticale quelli del telefono, in orizzontale quelli del computer.

## I file

| File             | Che cosa c'è                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decisioni.md`   | Domande 212–219 con le risposte di Francesco e le **regole per chi sviluppa** (anche per telefono e computer): campo «Solo per noi» e prezzi «circa», soglie uniche, ora di 45 px e campo della spesa di 48 px sul computer, 44 px su tutti i formati nei test, mese col dito, icona del piatto, barretta di Tommaso #4E7BE2, due ruoli nuovi della tavolozza. |
| `<area>/note.md` | Per ogni tavola: nome dei PNG, didascalia, orientamento e misura, passo, pagina del canvas, nota di Fable e, se c'è, la nota della tavola al buio. In cima le note delle pagine del canvas.                                                                                                                                                                    |

## Le aree

| Cartella                     | Tavole | Chiaro | Scuro | di cui `scuro-derivato/` | Contenuto                                                                                                                                                                                                                 |
| ---------------------------- | -----: | -----: | ----: | -----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regole/`                    |      1 |      — |     — |                        — | La tavola delle regole di passaggio (Passo 17, sostituisce quella del Passo 16)                                                                                                                                           |
| `orizzontale-comandi-44-px/` |     13 |     12 |    12 |                        5 | La tabella dei comandi a 44 px; settimana, corsie, giorno, mese toccato, dettaglio nel pannello a 1194 px; settimana e corsie con «Chi vedo» a 1024 px; accesso a 1194 e 1024 px; «Nuovo impegno», Oggi, Casa · Spesa     |
| `orizzontale/`               |      5 |      5 |     5 |                        2 | Le tavole del Passo 16 in orizzontale non ridisegnate: Oggi con il dettaglio, mese, Casa · Da fare, liste da riusare, «Il tuo Nest»                                                                                       |
| `verticale/`                 |     14 |     14 |    14 |                        5 | Oggi con la scena nuova (768 e 834 px), mese a griglia, «Nuovo impegno» e dettaglio come foglio dal basso, spesa, da fare, impostazioni, «Il tuo Nest» nella colonna di 640 px; settimana, giorno, liste, accesso, splash |
| `altre-pagine/`              |     18 |     18 |    18 |                       18 | Una prova per pagina nei due orientamenti: Animali, Riepilogo, «Chiedi a …», Spazi, Contatti, Documenti, desideri, aiutanti, Ricette, Pasti, Compleanni, Chi porta, Tempo insieme                                         |
| `correzioni/`                |      2 |      2 |     2 |                        2 | Correzioni piccole del Passo 17 sul tablet: «Chi porta, chi riprende» con «Nessuno, per ora» in testo secondario, Pasti con il segnaposto sabbia e il piatto                                                              |

## Come leggere le cartelle

- **Vale il passo più recente** (17 > 16). Quando il Passo 17 ha ridisegnato una tavola del Passo 16 (stesso schermo, stessa misura, stesso testo) ho tenuto solo la più recente: il `note.md` lo dice con «Sostituisce». 21 tavole del Passo 16 sono state tolte così, più la tavola delle regole del Passo 16.
- **Nomi dei file**: `NN-didascalia-chiaro.png` e `NN-didascalia-scuro.png` per la stessa tavola; le tavole uniche non hanno `-chiaro`/`-scuro`. L'orientamento è scritto nel `note.md`.
- **Da dove viene lo scuro.** Tre casi, scritti tavola per tavola:
  1. **dal canvas, in coppia con il chiaro**: la pagina «Passo 17 · Tablet · al buio» (14 schermi) e le tavole al buio del Passo 16; la coppia l'ho trovata confrontando il testo delle due tavole (uguale al 100%). Tre di queste (settimana, «Nuovo impegno», Oggi in orizzontale) sono al buio solo nella versione del Passo 16, prima dei 44 px: da lì si prendono i colori, le misure dal chiaro;
  2. **ottenuto da me (32 tavole, in `scuro-derivato/`)**: il canvas non ha quella tavola al buio. Ho applicato alla tavola chiara la tavolozza scura del canvas (la classe `th-d`, come fa Fable) e ho messo la scena della notte al posto di quella del giorno (per il tablet in verticale quella larga di «Passo 17 · Tablet · al buio»). Sono una prova fedele della regola, non tavole approvate una per una: vale la tavolozza (`docs/design/tavolozza.md`).
- Al buio la barretta di Tommaso è **#4E7BE2**: le tavole del canvas usano #3F6FE0, non si copia.

## Telefono e computer corretti nel Passo 17

Le tavole corrette stanno nelle cartelle già esistenti, con il prefisso `p17-`; ogni `note.md` ha una sezione «Correzioni del Passo 17».

| Cartella                                           | Tavole nuove                                                            | Che cosa sostituiscono                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `computer/turni-settimana-tipo-sintesi-p12-16/`    | `p17-01-chi-porta-chi-riprende-chiaro.png`                              | Corregge «Nessuno, per ora» in tutte le tavole della settimana dei viaggi                    |
| `computer/stati-piani-compleanni-p12-16/`          | `p17-01-i-piani-scuro.png`                                              | `01-piani-scuro.png` (tolta)                                                                 |
| `telefono/stati-piani-compleanni-p12-16/`          | `p17-01-i-piani-telefono-chiaro.png`, `-scuro.png`                      | Le icone dei Piani di `telefono/piani/`                                                      |
| `computer/ricette-pasti-riepilogo-chiedi-p12-16/`  | `p17-01-pasti-chiaro.png`                                               | `08-pasti-chiaro.png` (tolta)                                                                |
| `telefono/ricette-pasti-riepilogo-chiedi-p12-16/`  | `p17-01-ricette-…`, `p17-02-una-ricetta-…`, `p17-03-pasti-…`            | Le icone dei segnaposto di Ricette e Pasti                                                   |
| `computer/web-da-telefono-e-senza-account-p12-16/` | `p17-01-la-lista-dal-link-chiaro.png`, `scuro-derivato/…-scuro.png`     | `05-la-lista-dal-link-chiaro.png` e `-scuro.png` (tolte: mostravano «N. 33»)                 |
| `telefono/web-da-telefono-e-senza-account-p12-16/` | `p17-01-la-lista-dal-link-web-…`, `p17-02-la-lista-dal-link-telefono-…` | `03-la-lista-dei-desideri-web-…` (tolte: mostravano «N. 33»)                                 |
| `computer/regole/`                                 | `p17-01-dal-telefono-al-computer.png`                                   | `01-dal-telefono-al-computer.png` (tolta: soglie 1100 e 760 px, superate dalla risposta 214) |

Splash: la tavola dello splash scuro non cambia; nella nota ora si legge «resta solo il colore del cielo» (non «solo azzurro»). Sul tablet in verticale lo splash non copre più l'accesso (`verticale/04-…`).

## Limiti dell'estrazione

- Le tavole sono fotografate con il visualizzatore dei canvas in locale, al loro formato reale e a doppia densità; font e icone quelli del canvas. Didascalie e note sono nel `note.md`, non nell'immagine.
- Non ho rifotografato le tavole di telefono e computer corrette sul posto dal Passo 17 fuori dalla pagina «Passo 17 · Correzioni piccole» (per esempio l'icona del piatto nelle tavole già archiviate, o «Nessuno, per ora» nelle tavole vecchie del computer): valgono le tavole `p17-` e `decisioni.md`.
- Le tavole del canvas hanno ancora due errori del computer che non vanno copiati (risposte 215 e 216, in `decisioni.md`) e alcuni comandi del telefono sotto i 44 px (217).
- La pagina «Indice» dei canvas non è salvata come immagine: domande e stato sono in `decisioni.md`.
- Come sempre sono tavole: niente è stato provato su un tablet vero o in un browser.
