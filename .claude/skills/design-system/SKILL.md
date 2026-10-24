---
name: design-system
description: Design system di FamilyNest Web - token di colore, tipografia, spaziature, componenti e tono di voce. Usala prima di scrivere o rivedere qualsiasi interfaccia, CSS o testo visibile all'utente.
---

# Design system di FamilyNest

> **Stato: v1.0, compilata il 22/10/2026 dal mockup approvato** (`docs/mockup/tokens.css`, `components.css`, `design-system.md`, `design-system.html`) e dalle decisioni di Francesco (`docs/mockup/DECISIONI.md` e decisioni D-1 … D-10 nella issue #8).

## Fonti e precedenza

1. Decisioni di Francesco in `docs/mockup/DECISIONI.md` (vincono sul mockup).
2. Valori: `docs/mockup/tokens.css` (202 variabili), più 2 colori approvati da Francesco dopo il mockup (`--color-filo-campo`, `--color-allerta-scuro`, #43 punti 2 e 4, issue #52). Il blocco pronto da copiare in `src/app/globals.css` è `docs/agenti/design/token.css` (uguale a `tokens.css` tranne l'aggancio dei font a `next/font` e i 2 colori aggiunti con la #52).
3. Aspetto dei componenti: `docs/mockup/components.css`, portato nell'app **con gli stessi nomi di classe** (decisione D-2).
4. Comportamento e accessibilità di ogni componente: `docs/mockup/design-system.md` §7–§11.
5. Questa skill: regole d'uso, stati che il mockup non disegna, componenti React, tono di voce. Dove il mockup e questa skill sembrano in contrasto, vale il mockup e si apre una domanda nella issue.

## Regole sempre valide

- Solo CSS proprio. I valori vivono come variabili in `:root` dentro `src/app/globals.css`; i componenti usano **solo variabili**, mai colori, font o misure scritti a mano. Eccezioni ammesse: `0`, `1`, `100%`, `50%`, `auto`, `env(safe-area-inset-*)`, le larghezze delle media query (le variabili non funzionano lì).
- Se un valore manca, non si inventa: lo aggiunge il designer qui e in `docs/agenti/design/token.css`, con una issue `proposta-design` se cambia il mockup.
- Niente Tailwind, niente librerie di componenti, niente CSS-in-JS.
- Mobile first: si scrive prima il layout a 390 px, poi si adatta a 1280 px con media query.
- **Classi del design system globali, con i nomi del mockup (D-2).** Tutte le classi di `docs/mockup/components.css` (tranne il blocco «IMPALCATURA DEL MOCKUP», classi `mock-*`) stanno in `src/app/globals.css` o in un file importato da lì, con lo stesso nome: `.btn-primary`, `.campo--errore`, `.foglio`… Così pagine, tester e revisore confrontano 1:1 con il mockup.
- I componenti React condivisi vivono in `src/components/ui/<Nome>/` e applicano quelle classi globali: niente CSS module per i componenti del design system. Una pagina può avere un suo CSS module solo per la disposizione propria (griglie, spaziature tra blocchi), sempre con i token.
- Se una pagina ha bisogno di una variante nuova, la definisce il designer qui (nome di classe nello stile del mockup: `blocco__parte--variante`, in italiano), non lo sviluppatore.
- Niente estetica "generata dall'AI": niente gradienti, card inclinate, ombre sulle schede, illustrazioni, emoji, CTA generiche ("Clicca qui", "Invia"), icone `+` senza testo dove il mockup ha un'etichetta.
- Tema scuro completo: **fuori perimetro** (decisione aperta). `.tema-notte` e i token `--color-notte*`, `--color-latte*` servono solo alle schermate scure già disegnate: accesso, chiusura dell'onboarding, schede e blocchi «porta».
- Il colore delle persone (`--color-membro-*`) vive solo negli avatar, nei punti del mese e negli adesivi. Mai su testi, schede o sfondi.
- `--color-inchiostro-3` non si usa mai per il testo (3,33:1). Il rosso (`--color-allerta`) solo per errori e urgente, mai per «tra poco».
- Niente stile in linea (`style=`). Le posizioni calcolate dei blocchi del calendario si decidono nella specifica di quelle pagine.
- Niente icone o campi legati alla salute dei figli (D1): l'icona `stethoscope` non entra nello sprite dell'app.

## Token

Tutti i valori di `docs/mockup/tokens.css`, senza arrotondamenti. Nome variabile → valore → uso.

### Colori: base

| Variabile              | Valore    | Uso                                            |
| ---------------------- | --------- | ---------------------------------------------- |
| `--color-carta`        | `#F1F2EE` | sfondo delle pagine                            |
| `--color-carta-2`      | `#E7E8E2` | segnaposto foto, scheletri di caricamento      |
| `--color-superficie`   | `#FFFFFF` | schede, campi, barre                           |
| `--color-inchiostro`   | `#17181C` | testo principale, azione principale            |
| `--color-inchiostro-2` | `#5A5D64` | testo secondario                               |
| `--color-inchiostro-3` | `#8A8D93` | solo elementi non testuali (tacche, segni)     |
| `--color-filo`         | `#DFE0DA` | bordi e divisori                               |
| `--color-filo-2`       | `#CFD1CA` | bordi tratteggiati, cornici di selezione       |
| `--color-filo-campo`   | `#82858B` | bordo dei campi a riposo (**aggiunto**, #52)   |
| `--color-notte`        | `#1B1A17` | blocchi scuri: porte, piano, onboarding        |
| `--color-notte-2`      | `#2A2925` | elementi sopra notte                           |
| `--color-latte`        | `#F4F2EC` | testo e superfici chiare su inchiostro e notte |
| `--color-latte-2`      | `#B9B5AC` | testo secondario su notte                      |

### Colori: Liberi insieme

| Variabile               | Valore    | Uso   |
| ----------------------- | --------- | ----- |
| `--color-insieme`       | `#FBF3D6` | fondo |
| `--color-insieme-bordo` | `#C9A43A` | bordo |
| `--color-insieme-testo` | `#6B5413` | testo |

### Colori: impegni «Occupato» (righe grigie)

| Variabile            | Valore    | Uso |
| -------------------- | --------- | --- |
| `--color-occupato-1` | `#ECEDE7` |     |
| `--color-occupato-2` | `#E4E5DE` |     |

### Colori: stato

| Variabile               | Valore    | Uso                                                              |
| ----------------------- | --------- | ---------------------------------------------------------------- |
| `--color-ok`            | `#237A4B` |                                                                  |
| `--color-avviso`        | `#A15C07` |                                                                  |
| `--color-allerta`       | `#C8322F` |                                                                  |
| `--color-allerta-scuro` | `#A82A27` | passaggio e premuto di `.btn-pericolo-pieno` (**aggiunto**, #52) |
| `--color-info`          | `#3355CC` |                                                                  |
| `--color-bianco`        | `#FFFFFF` |                                                                  |

### Colori: membri (solo negli avatar)

| Variabile                  | Valore    | Uso |
| -------------------------- | --------- | --- |
| `--color-membro-pomodoro`  | `#F06A4F` |     |
| `--color-membro-glicine`   | `#B9A3E8` |     |
| `--color-membro-salvia`    | `#8DBF9B` |     |
| `--color-membro-cobalto`   | `#5C7FE0` |     |
| `--color-membro-zafferano` | `#F2B33D` |     |

### Colori: marchi dei calendari esterni (solo nei loghi)

| Variabile                 | Valore    | Uso |
| ------------------------- | --------- | --- |
| `--color-marchio-outlook` | `#0F6CBD` |     |
| `--color-marchio-google`  | `#188038` |     |
| `--color-marchio-icloud`  | `#1C1C1E` |     |

### Colori: trasparenze

| Variabile                  | Valore                  | Uso                        |
| -------------------------- | ----------------------- | -------------------------- |
| `--color-velo`             | `rgba(23,24,28,.30)`    | sotto fogli e modali       |
| `--color-ombra`            | `rgba(23,24,28,.06)`    |                            |
| `--color-ombra-forte`      | `rgba(23,24,28,.30)`    |                            |
| `--color-ombra-adesivo`    | `rgba(0,0,0,.25)`       |                            |
| `--color-avatar-su-colore` | `rgba(255,255,255,.55)` | cerchio dentro gli adesivi |

### Font

| Variabile          | Valore                                                                       | Uso                       |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------- |
| `--font-titoli`    | `"Parkinsans",ui-sans-serif,system-ui,sans-serif`                            |                           |
| `--font-testo`     | `"Host Grotesk",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif` |                           |
| `--font-codice`    | `ui-monospace,"SF Mono",Menlo,monospace`                                     | solo nella documentazione |
| `--weight-sottile` | `300`                                                                        |                           |
| `--weight-normale` | `400`                                                                        |                           |
| `--weight-medio`   | `500`                                                                        |                           |
| `--weight-semi`    | `600`                                                                        |                           |
| `--weight-forte`   | `650`                                                                        |                           |
| `--weight-pieno`   | `700`                                                                        |                           |

### Scala tipografica (mobile; *-desktop dove cambia)

| Variabile                           | Valore    | Uso                                         |
| ----------------------------------- | --------- | ------------------------------------------- |
| `--text-display-size`               | `44px`    |                                             |
| `--text-display-line`               | `48px`    |                                             |
| `--text-display-tracking`           | `-.04em`  |                                             |
| `--text-display-desktop-size`       | `56px`    |                                             |
| `--text-display-desktop-line`       | `60px`    |                                             |
| `--text-ora-xl-size`                | `64px`    |                                             |
| `--text-ora-xl-line`                | `56px`    |                                             |
| `--text-ora-xl-tracking`            | `-.04em`  |                                             |
| `--text-ora-l-size`                 | `52px`    |                                             |
| `--text-ora-l-line`                 | `48px`    |                                             |
| `--text-ora-l-tracking`             | `-.04em`  |                                             |
| `--text-numero-size`                | `44px`    |                                             |
| `--text-numero-line`                | `48px`    |                                             |
| `--text-numero-tracking`            | `-.04em`  |                                             |
| `--text-titolo-pagina-size`         | `32px`    |                                             |
| `--text-titolo-pagina-line`         | `36px`    |                                             |
| `--text-titolo-pagina-tracking`     | `-.03em`  |                                             |
| `--text-titolo-pagina-desktop-size` | `40px`    |                                             |
| `--text-titolo-pagina-desktop-line` | `44px`    |                                             |
| `--text-titolo-scheda-size`         | `22px`    |                                             |
| `--text-titolo-scheda-line`         | `26px`    |                                             |
| `--text-titolo-scheda-tracking`     | `-.02em`  |                                             |
| `--text-frase-size`                 | `22px`    |                                             |
| `--text-frase-line`                 | `30px`    |                                             |
| `--text-frase-tracking`             | `-.015em` |                                             |
| `--text-sezione-size`               | `15px`    |                                             |
| `--text-sezione-line`               | `24px`    |                                             |
| `--text-corpo-forte-size`           | `15px`    |                                             |
| `--text-corpo-forte-line`           | `20px`    |                                             |
| `--text-corpo-size`                 | `15px`    |                                             |
| `--text-corpo-line`                 | `22px`    |                                             |
| `--text-ora-riga-size`              | `15px`    |                                             |
| `--text-ora-riga-line`              | `20px`    |                                             |
| `--text-ora-riga-tracking`          | `-.01em`  |                                             |
| `--text-nota-size`                  | `13px`    |                                             |
| `--text-nota-line`                  | `18px`    |                                             |
| `--text-etichetta-size`             | `12px`    |                                             |
| `--text-etichetta-line`             | `16px`    |                                             |
| `--text-etichetta-tracking`         | `.02em`   |                                             |
| `--text-micro-size`                 | `11px`    |                                             |
| `--text-micro-line`                 | `14px`    |                                             |
| `--text-controllo-size`             | `14px`    | testo di bottoni, selettori, righe compatte |
| `--text-controllo-line`             | `20px`    | testo di bottoni, selettori, righe compatte |
| `--text-numero-m-size`              | `36px`    | giorni alle scadenze                        |
| `--text-numero-m-line`              | `36px`    | giorni alle scadenze                        |
| `--text-numero-s-size`              | `30px`    | contatori piccoli                           |
| `--text-numero-s-line`              | `34px`    | contatori piccoli                           |
| `--text-cella-size`                 | `18px`    | numeri del mese e della striscia            |
| `--text-cella-line`                 | `26px`    | numeri del mese e della striscia            |
| `--text-avatar-xs-size`             | `8px`     |                                             |
| `--text-avatar-s-size`              | `10px`    |                                             |
| `--text-avatar-m-size`              | `13px`    |                                             |
| `--text-avatar-l-size`              | `18px`    |                                             |
| `--text-avatar-xl-size`             | `30px`    |                                             |
| `--tracking-codice`                 | `.12em`   |                                             |
| `--tracking-maiuscolo`              | `.08em`   |                                             |

### Punti di rottura (riferimento: le media query non leggono le variabili)

| Variabile                  | Valore   | Uso |
| -------------------------- | -------- | --- |
| `--breakpoint-mobile-max`  | `767px`  |     |
| `--breakpoint-desktop-min` | `1024px` |     |

### Spaziature

| Variabile      | Valore | Uso |
| -------------- | ------ | --- |
| `--space-0`    | `0`    |     |
| `--space-half` | `2px`  |     |
| `--space-1`    | `4px`  |     |
| `--space-2`    | `8px`  |     |
| `--space-3`    | `12px` |     |
| `--space-4`    | `16px` |     |
| `--space-5`    | `20px` |     |
| `--space-6`    | `24px` |     |
| `--space-8`    | `32px` |     |
| `--space-10`   | `40px` |     |
| `--space-12`   | `48px` |     |
| `--space-16`   | `64px` |     |

### Griglia

| Variabile                | Valore   | Uso                                           |
| ------------------------ | -------- | --------------------------------------------- |
| `--grid-margine-mobile`  | `20px`   |                                               |
| `--grid-margine-desktop` | `40px`   |                                               |
| `--grid-colonne-desktop` | `12`     | griglia di riferimento per le colonne desktop |
| `--grid-gutter`          | `24px`   |                                               |
| `--grid-contenuto-max`   | `1200px` |                                               |
| `--grid-colonna-stretta` | `720px`  | pagine di impostazioni e dettaglio su desktop |

### Raggi

| Variabile        | Valore  | Uso                                        |
| ---------------- | ------- | ------------------------------------------ |
| `--radius-xs`    | `6px`   | kbd, etichetta fonte                       |
| `--radius-s`     | `8px`   | etichette, chip, voce attiva dei selettori |
| `--radius-m`     | `12px`  | controlli: bottoni, campi, selettori       |
| `--radius-l`     | `16px`  | schede                                     |
| `--radius-xl`    | `24px`  | fogli e modali                             |
| `--radius-tondo` | `999px` | avatar, interruttori, pallini              |

### Bordi

| Variabile           | Valore  | Uso                                       |
| ------------------- | ------- | ----------------------------------------- |
| `--border-sottile`  | `1px`   |                                           |
| `--border-medio`    | `1.5px` |                                           |
| `--border-evidenza` | `3px`   | filo nero in cima alla scheda in evidenza |

### Ombre ed elevazione

| Variabile          | Valore                                   | Uso |
| ------------------ | ---------------------------------------- | --- |
| `--shadow-nessuna` | `none`                                   |     |
| `--shadow-scheda`  | `0 1px 2px var(--color-ombra)`           |     |
| `--shadow-barra`   | `0 8px 24px var(--color-ombra)`          |     |
| `--shadow-foglio`  | `0 -8px 32px var(--color-ombra)`         |     |
| `--shadow-modale`  | `0 30px 80px var(--color-ombra-forte)`   |     |
| `--shadow-adesivo` | `0 10px 24px var(--color-ombra-adesivo)` |     |

### Misure

| Variabile                      | Valore   | Uso                                               |
| ------------------------------ | -------- | ------------------------------------------------- |
| `--size-tocco`                 | `44px`   | area minima di tocco                              |
| `--size-controllo`             | `40px`   | bottoni icona, selettori, chip grandi             |
| `--size-azione`                | `52px`   | bottoni principali, campi                         |
| `--size-riga`                  | `56px`   | righe di lista                                    |
| `--size-riga-alta`             | `64px`   | righe evento, righe con due testi                 |
| `--size-barra`                 | `64px`   | barra di navigazione mobile, bottone Aggiungi     |
| `--size-nav-desktop`           | `72px`   | barra di navigazione desktop                      |
| `--size-etichetta`             | `28px`   | etichette e chip piccoli                          |
| `--size-chip`                  | `36px`   | chip filtro                                       |
| `--size-interruttore-l`        | `44px`   |                                                   |
| `--size-interruttore-a`        | `26px`   |                                                   |
| `--size-interruttore-pallino`  | `20px`   |                                                   |
| `--size-casella`               | `22px`   | checkbox e radio                                  |
| `--size-icona-s`               | `16px`   |                                                   |
| `--size-icona-m`               | `20px`   |                                                   |
| `--size-icona-l`               | `24px`   |                                                   |
| `--size-avatar-xs`             | `18px`   |                                                   |
| `--size-avatar-s`              | `24px`   |                                                   |
| `--size-avatar-m`              | `32px`   |                                                   |
| `--size-avatar-l`              | `44px`   |                                                   |
| `--size-avatar-xl`             | `72px`   |                                                   |
| `--size-quadrato-nest`         | `40px`   |                                                   |
| `--size-colonna-ora`           | `48px`   | colonna dell'orario nelle righe                   |
| `--size-colonna-giorni`        | `72px`   | colonna dei giorni nelle scadenze                 |
| `--size-cta-aggiungi`          | `128px`  | larghezza del bottone Aggiungi in basso           |
| `--size-pannello-desktop`      | `320px`  |                                                   |
| `--size-menu-desktop`          | `280px`  |                                                   |
| `--size-modale`                | `880px`  |                                                   |
| `--size-dialogo`               | `400px`  |                                                   |
| `--size-maniglia-l`            | `40px`   |                                                   |
| `--size-maniglia-a`            | `4px`    |                                                   |
| `--size-adesivo`               | `56px`   |                                                   |
| `--size-qr`                    | `168px`  |                                                   |
| `--size-foto`                  | `64px`   |                                                   |
| `--size-foto-scheda`           | `160px`  |                                                   |
| `--size-ora-calendario`        | `50px`   | altezza di un'ora nella vista Giorno mobile       |
| `--size-ora-desktop`           | `40px`   | altezza di un'ora nella griglia settimana desktop |
| `--size-cella-mese`            | `48px`   |                                                   |
| `--size-pallino`               | `6px`    |                                                   |
| `--size-pallino-urgente`       | `8px`    |                                                   |
| `--size-tacca`                 | `4px`    |                                                   |
| `--size-bottone-s`             | `32px`   | puntina, chiudi nei fogli                         |
| `--size-bottone-icona`         | `36px`   | quadratino con icona dentro bottoni e campi       |
| `--size-scelta`                | `72px`   | schede di scelta, righe scadenza                  |
| `--size-radio-pieno`           | `7px`    |                                                   |
| `--size-contatore`             | `136px`  |                                                   |
| `--size-modulo`                | `152px`  |                                                   |
| `--size-porta`                 | `120px`  |                                                   |
| `--size-palette`               | `680px`  |                                                   |
| `--size-colonna-dati`          | `104px`  |                                                   |
| `--size-riga-occupato`         | `6px`    | larghezza delle righe diagonali di «Occupato»     |
| `--size-punto-membro`          | `9px`    | avatar senza iniziale sotto i giorni del mese     |
| `--size-frame-mobile`          | `390px`  |                                                   |
| `--size-frame-mobile-altezza`  | `844px`  |                                                   |
| `--size-frame-desktop`         | `1280px` |                                                   |
| `--size-frame-desktop-altezza` | `800px`  |                                                   |

### Movimento

| Variabile          | Valore                      | Uso |
| ------------------ | --------------------------- | --- |
| `--durata-rapida`  | `200ms`                     |     |
| `--durata-normale` | `300ms`                     |     |
| `--durata-ampia`   | `600ms`                     |     |
| `--curva`          | `cubic-bezier(.32,.72,0,1)` |     |

### Opacità

| Variabile                | Valore | Uso |
| ------------------------ | ------ | --- |
| `--opacity-passato`      | `.5`   |     |
| `--opacity-disabilitato` | `.4`   |     |

### Livelli

| Variabile    | Valore | Uso |
| ------------ | ------ | --- |
| `--z-base`   | `1`    |     |
| `--z-nav`    | `4`    |     |
| `--z-velo`   | `5`    |     |
| `--z-foglio` | `6`    |     |
| `--z-toast`  | `7`    |     |

### Breakpoint

Le media query non leggono le variabili: si scrivono i numeri. Le sole tre media query ammesse sono `@media (min-width: 768px)`, `@media (max-width: 1023px)` e `@media (min-width: 1024px)`.

| Nome    | Larghezza     | Layout                                                                                                                                                                             |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mobile  | fino a 767 px | Stili di base (nessuna media query). Una colonna, barra in alto, navigazione in basso, fogli dal basso.                                                                            |
| tablet  | 768–1023 px   | Layout mobile. Il centramento del contenuto al massimo su `--grid-colonna-stretta` (`design-system.md` §8) lo applica la fondamenta layout (#10), con `@media (min-width: 768px)`. |
| desktop | da 1024 px    | `@media (min-width: 1024px)`: navigazione in alto, colonne, modali centrati, toast in basso a destra.                                                                              |

Riferimenti dei mockup: 390 × 844 px (`--size-frame-mobile`) e 1280 × 800 px (`--size-frame-desktop`). Nel mockup le regole `.frame-desktop .x` diventano nell'app `@media (min-width: 1024px) { .x }`, le regole `.frame-mobile .x` diventano `@media (max-width: 1023px) { .x }`, le regole su `.frame-mobile, .frame-desktop` valgono su `body`. Le larghezze fisse delle cornici non si portano: l'app è fluida.

## Tipografia

- **Parkinsans** (`--font-titoli`), peso sottile (300): titoli di pagina, ore, numeri, frasi. Ore e numeri hanno tutti lo stesso stile, con cifre tabellari.
- **Host Grotesk** (`--font-testo`): tutto il resto, pesi 400–700 (650 = `--weight-forte`).
- Testo di base del `body`: `--font-testo`, `--text-corpo-size` / `--text-corpo-line`, colore `--color-inchiostro`, fondo `--color-carta`, `-webkit-font-smoothing: antialiased`.

### Caricamento dei font

Nel mockup i font arrivano da un `<link>` a Google Fonts. Nell'app si usano **`next/font/google`** (stessi file, scaricati alla build e serviti dal nostro dominio: nessuna richiesta del browser a Google, quindi nessun indirizzo IP delle famiglie inviato a terzi, e salto del testo al caricamento ridotto al minimo dal font di riserva calibrato).

- `Parkinsans`: `subsets: ["latin", "latin-ext"]`, font variabile (nessun `weight` fisso, copre 300–800), `display: "swap"`, `variable: "--font-parkinsans"`.
- `Host_Grotesk`: stesse opzioni, `variable: "--font-host-grotesk"`.
- Le due classi `.variable` vanno sull'elemento `<html>` in `src/app/layout.tsx` (non su `<body>`), perché `--font-titoli` e `--font-testo` sono dichiarati in `:root`.
- In `:root`: `--font-titoli: var(--font-parkinsans), "Parkinsans", ui-sans-serif, system-ui, sans-serif;` e `--font-testo: var(--font-host-grotesk), "Host Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;` (già scritti in `docs/agenti/design/token.css`). La pila di riserva è quella del mockup.
- `--font-codice` serve solo alla documentazione: non si usa nell'app.

### Classi di testo

Classi globali in `globals.css` (servono a tutte le pagine). La classe cambia l'aspetto, non il livello: `h1`/`h2` restano in ordine.

| Classe             | Font e peso                     | Token (mobile → desktop)                                    | Esempio dal mockup                        |
| ------------------ | ------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `.t-display`       | Parkinsans 300                  | `--text-display-*` → `--text-display-desktop-*`             | Buon pomeriggio                           |
| `.t-titolo-pagina` | Parkinsans 300                  | `--text-titolo-pagina-*` → `--text-titolo-pagina-desktop-*` | Calendari collegati                       |
| `.t-titolo-scheda` | Parkinsans 400                  | `--text-titolo-scheda-*`                                    | Completa il profilo di Sofia              |
| `.t-frase`         | Parkinsans 300                  | `--text-frase-*`                                            | Stasera siete liberi insieme dalle 21:30. |
| `.t-numero`        | Parkinsans 300, cifre tabellari | `--text-numero-*`                                           | 14                                        |
| `.t-sezione`       | Host Grotesk 650                | `--text-sezione-*`                                          | Questa settimana                          |
| `.t-corpo-forte`   | Host Grotesk 650                | `--text-corpo-forte-*`                                      | Nuoto Sofia                               |
| `.t-corpo`         | Host Grotesk 400                | `--text-corpo-*`                                            | Piscina comunale, la porta Laura          |
| `.t-controllo`     | Host Grotesk 600                | `--text-controllo-*`                                        | Aggiungi                                  |
| `.t-nota`          | Host Grotesk 500                | `--text-nota-*`                                             | Entro giovedì                             |
| `.t-etichetta`     | Host Grotesk 650                | `--text-etichetta-*`                                        | OUTLOOK                                   |
| `.t-micro`         | Host Grotesk 600                | `--text-micro-*`                                            | Lun                                       |
| `.t-secondario`    | —                               | colore `--color-inchiostro-2`                               | ritocco                                   |
| `.t-forte`         | —                               | peso `--weight-pieno`                                       | ritocco                                   |
| `.t-allerta`       | —                               | colore `--color-allerta`                                    | ritocco                                   |

## Contrasti (WCAG 2.1 AA)

Tabella completa in `docs/mockup/design-system.md` §2. Coppie da ricordare:

| Testo o segno          | Fondo                   | Rapporto | Uso                                                                             |
| ---------------------- | ----------------------- | -------- | ------------------------------------------------------------------------------- |
| `--color-inchiostro`   | `--color-carta`         | 15,78:1  | testo principale                                                                |
| `--color-inchiostro-2` | `--color-carta`         | 5,86:1   | testo secondario sulle pagine; numeri dei giorni fuori dal mese (#52)           |
| `--color-inchiostro-2` | `--color-superficie`    | 6,59:1   | testo secondario nelle schede                                                   |
| `--color-latte`        | `--color-inchiostro`    | 15,85:1  | bottoni principali, voci scelte                                                 |
| `--color-latte`        | `--color-notte`         | 15,55:1  | toast, schede scure, schermate notte                                            |
| `--color-allerta`      | `--color-carta`         | 4,72:1   | errori sulle pagine (minimo raggiunto)                                          |
| `--color-bianco`       | `--color-allerta`       | 5,31:1   | bottone pericoloso pieno                                                        |
| `--color-bianco`       | `--color-allerta-scuro` | 6,94:1   | bottone pericoloso pieno, passaggio e premuto (#52)                             |
| `--color-filo-campo`   | `--color-superficie`    | 3,70:1   | bordo del campo contro il suo fondo bianco (#52, minimo non testuale 3:1)       |
| `--color-filo-campo`   | `--color-carta`         | 3,29:1   | bordo del campo contro la pagina (#52)                                          |
| `--color-info`         | `--color-carta`         | 5,64:1   | anello di focus su fondo chiaro                                                 |
| `--color-info`         | `--color-notte`         | 2,74:1   | **insufficiente**: su fondo scuro l'anello di focus è `--color-latte` (15,55:1) |

## Iconografia

- Lucide `lucide-static` 0.460.0, a tratto: `stroke: currentColor`, `fill: none`, `stroke-width: var(--border-medio)`, estremità e giunzioni arrotondate.
- Taglie: 16 px `--size-icona-s` (`.icona--s`), 20 px `--size-icona-m` (`.icona`, predefinita), 24 px `--size-icona-l` (`.icona--l`).
- Nell'app: un unico sprite `<svg class="sprite-icone" aria-hidden="true">` nel layout radice, con i `<symbol id="i-nome" viewBox="0 0 24 24">` copiati **identici** dagli sprite dei mockup: 79 icone (elenco in `design-system.md` §6, senza `stethoscope`). Nessun pacchetto nuovo. Il componente `Icon` scrive `<svg class="icona" aria-hidden="true"><use href="#i-nome"/></svg>`.
- Icona decorativa: sempre `aria-hidden="true"`. Bottone con sola icona: `aria-label` scritto come azione.
- I calendari esterni non usano loghi originali: `.logo-marchio` (iniziale sul colore del marchio).

## Movimento

- Fogli e modali entrano in `--durata-normale` con `--curva`, escono in `--durata-rapida`.
- Interruttori, chip, caselle, cambi di fondo al passaggio del mouse: `--durata-rapida`.
- Spinner: un giro ogni `--durata-ampia`, lineare. Scheletri: pulsazione tra opacità 1 e `--opacity-passato` in `--durata-ampia`, alternata.
- Riga spuntata: resta al suo posto per `--durata-ampia` prima di scendere.
- `@media (prefers-reduced-motion: reduce)`: animazioni e transizioni spente in tutta l'app. Lo spinner resta fermo, il bottone resta `aria-busy`.
- Niente rimbalzi, parallasse, comparse a scorrimento o animazioni decorative.

## Stati comuni a tutti i controlli

Il mockup disegna focus, disabilitato, errore e caricamento; **non disegna il passaggio del mouse né il «premuto»** (citato come stato ma senza stile). Qui sotto li completa il designer con i token del sistema. L'unico colore aggiunto per questi stati è `--color-allerta-scuro`, per `.btn-pericolo-pieno`, approvato da Francesco nella #52. Si scrivono come regole aggiuntive sulle classi del mockup (es. `.btn-primary:hover`), senza toccare le regole copiate.

| Stato               | Regola                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normale             | Come in `components.css`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Passaggio del mouse | Solo dentro `@media (hover: hover)`, transizione `background-color` in `--durata-rapida`. Fondo `--color-inchiostro` → `--color-notte-2`. Fondo `--color-superficie` → `--color-carta`. Fondo `--color-carta` → `--color-carta-2`. Fondo trasparente (righe cliccabili, voci): `--color-carta` se sta su una superficie bianca, `--color-carta-2` se sta sulla pagina. Fondo `--color-latte` (`.btn-chiaro`) → `--color-latte-2`. Voci non scelte di navigazione e selettore: testo da `--color-inchiostro-2` a `--color-inchiostro`. Fondo `--color-allerta` (`.btn-pericolo-pieno`) → `--color-allerta-scuro` (**approvato**, #52). Link sottolineati e `.btn-pericolo`: nessun cambio. |
| Premuto (`:active`) | Stesso fondo del passaggio del mouse, anche su schermi touch. Nessuno spostamento, nessun ridimensionamento.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Focus da tastiera   | Globale: `:focus-visible { outline: var(--border-medio) solid var(--color-info); outline-offset: var(--space-half); }`. Sui fondi scuri `.tema-notte`, `.toast`, `.scheda--scura`, `.scheda-modulo--scura` e `.split-onboarding__notte` l'anello è `--color-latte` (**aggiunto rispetto al mockup**: `--color-info` su `--color-notte` arriva solo a 2,74:1). I campi (`.campo__input`, `.campo-frase`) hanno `outline: none` e l'anello interno `inset 0 0 0 var(--border-medio) var(--color-inchiostro)` a ogni `:focus`, come nel mockup.                                                                                                                                              |
| Disabilitato        | `opacity: var(--opacity-disabilitato)`, `cursor: not-allowed`, nessun effetto di passaggio o premuto. Attributo `disabled` sui controlli nativi, `aria-disabled="true"` sui link. Vale per tutti i controlli: bottoni, campi, casella, interruttore, chip, voci del selettore, scelta colore.                                                                                                                                                                                                                                                                                                                                                                                             |
| Errore              | Campo: `.campo--errore` + `.campo__errore` con icona `circle-alert` 16 px, `aria-invalid="true"` e `aria-describedby`. L'errore compare dopo l'invio, non mentre si scrive; all'invio il focus va al primo campo sbagliato (**aggiunto rispetto al mockup**). Parte di pagina: `.avviso--errore` con azione. Pagina intera: `.errore-pagina` con «Riprova».                                                                                                                                                                                                                                                                                                                               |
| Caricamento         | Bottone: `.is-caricamento` → `.spinner` prima del testo, `.btn__testo` a `--opacity-passato`, `aria-busy="true"`, larghezza invariata, niente clic ripetuti. Contenuto: `.skeleton` con la forma del contenuto, contenitore `aria-busy="true"` + testo nascosto «Caricamento in corso». Mai spinner a pagina intera.                                                                                                                                                                                                                                                                                                                                                                      |

Aree di tocco: ogni controllo ha almeno 44 × 44 px (`--size-tocco`). Dove il disegno è più piccolo (`.btn-icona--piccolo` 32 px, `.casella` e `.tondo-spunta` 22 px, `.toggle` 26 px di altezza, `.chip` 36 px, `.selettore__voce` 32 px di altezza) l'area si allarga con un `::before` trasparente centrato o con il padding della riga, senza cambiare il disegno.

## Componenti

Classi: quelle del mockup, globali (D-2). Componenti React: nomi in inglese (regola del progetto) in `src/components/ui/<Nome>/`, ognuno applica le classi indicate. Ogni componente accetta una `className` aggiuntiva. Misure: quelle di `components.css`, regola per regola.

### Componenti React di base (fondamenta #8)

| Componente React                                                  | Classi del mockup                                                                                                                                                                                                   | Varianti                                                                                                                                                                             | Stati                                                         | Accessibilità                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Icon`                                                            | `.icona` (+ `--s`, `--l`), `.sprite-icone`                                                                                                                                                                          | `size`: `s` 16, `m` 20 (predefinita), `l` 24                                                                                                                                         | colore = `currentColor`                                       | `aria-hidden="true"` sempre; `name` solo tra i simboli dello sprite                                                                                                                         |
| `VisuallyHidden`                                                  | `.visivamente-nascosto`                                                                                                                                                                                             | —                                                                                                                                                                                    | —                                                             | al posto di `display: none` per testi da leggere                                                                                                                                            |
| `Button`                                                          | `.btn-primary`, `.btn-secondary`, `.btn-chiaro`, `.btn-tenue`, `.btn-tratteggiato`, `.btn-link` (+ `--secondario`), `.btn-pericolo`, `.btn-pericolo-pieno`; `.btn--pieno`, `.btn--piccolo`, `.btn-primary--freccia` | 52 px o piccolo 40 px; a tutta larghezza; con freccia (onboarding); icona a sinistra facoltativa                                                                                     | normale, passaggio, premuto, focus, disabilitato, caricamento | testo visibile sempre, verbo specifico; `<a>` se porta altrove, `<button>` se agisce sul posto; caricamento con `aria-busy`                                                                 |
| `IconButton`                                                      | `.btn-icona` (+ `--carta`, `--piccolo`, `__punto`)                                                                                                                                                                  | 40 px; carta 52 px; piccolo 32 px; pallino «novità»                                                                                                                                  | normale, passaggio, premuto, focus, disabilitato              | `aria-label` obbligatorio («Indietro», «Chiudi», «Notifiche, 3 nuove»); area 44 px                                                                                                          |
| `Spinner`                                                         | `.spinner`                                                                                                                                                                                                          | —                                                                                                                                                                                    | gira; fermo con movimento ridotto                             | `aria-hidden`; lo stato è `aria-busy` sul bottone                                                                                                                                           |
| `TextField`, `SelectField`, `DateField`, `TimeField`, `FieldPair` | `.campo` (+ `--errore`, `__etichetta`, `__input`, `__aiuto`, `__errore`, `__select-box`), `.campo-doppio`                                                                                                           | testo, mail, numero, area di testo; select con `chevron-down` 16 px; data (`type="date"`) e ora (`type="time"`) **native, vestite come `.campo__input`** (D-9); due campi affiancati | vuoto, compilato, focus, errore, disabilitato                 | `<label for>` sempre visibile; errore con `aria-invalid` + `aria-describedby`; date e ore convertite nel fuso `Europe/Rome` con le funzioni di `src/lib/`                                   |
| `Checkbox`                                                        | `.casella`; con `variant="round"` `.tondo-spunta` al posto di `.casella` (#63)                                                                                                                                      | `square` (predefinita, quadrata) o `round` (tonda, liste di Casa)                                                                                                                    | vuota, spuntata, focus, disabilitata                          | `role="checkbox"` + `aria-checked` + `aria-label` con l'azione («Segna come fatto: …», «Preso: Latte»)                                                                                      |
| `Toggle`                                                          | `.toggle`                                                                                                                                                                                                           | —                                                                                                                                                                                    | spento, acceso, focus, disabilitato                           | `role="switch"` + `aria-checked` + nome; effetto immediato, senza Salva                                                                                                                     |
| `SegmentedControl`                                                | `.selettore` (+ `--carta`, `__voce`, `__conteggio`)                                                                                                                                                                 | normale, carta; conteggio facoltativo                                                                                                                                                | voce scelta, voce normale, passaggio, focus, disabilitata     | gruppo con `aria-label`; ogni voce `<button aria-pressed>`                                                                                                                                  |
| `SectionSwitcher` (#63)                                           | `.selettore`, `.selettore__voce`, `.selettore__conteggio`                                                                                                                                                           | 2–5 voci; voce della pagina attuale = `<button aria-pressed="true">`, altre = link `next/link`; conteggio 1–99, «99+» oltre, niente con 0, negativo o assente                        | voce attuale, link, passaggio, premuto, focus                 | gruppo `role="group"` con `aria-label` («Sezione della casa»); sui link niente `aria-pressed` né `aria-current`; nessuna voce disabilitata                                                  |
| `QuickAddField` (#63)                                             | `.campo-rapido` (+ `--attivo`, `__piu`, `__input`), `label.visivamente-nascosto`                                                                                                                                    | normale; `active` (sempre attivo, stato vuoto di Spesa)                                                                                                                              | riposo, fuoco, con testo, attivo                              | etichetta nascosta = `aria-label` del modulo = testo d'esempio; Invio aggiunge, testo vuoto non fa niente; nessun bottone dentro                                                            |
| `Chip`, `ChipGroup`                                               | `.chip` (+ `--persona`, `--statico`, `__conteggio`, `__valore`), `.gruppo-chip` (+ `--scorre`)                                                                                                                      | persona (con avatar), statico; gruppo che va a capo o scorre                                                                                                                         | scelto, non scelto, passaggio, focus, disabilitato            | `<button aria-pressed>`; gruppo `role="group"` con `aria-label`                                                                                                                             |
| `Avatar`                                                          | `.avatar` (+ `--xs`, `--m`, `--l`, `--xl`, `--punto`, `--vuoto`), `.membro-*`, `.avatar-gruppo`                                                                                                                     | 18 / 24 (predefinita) / 32 / 44 / 72 px, punto 9 px, vuoto tratteggiato                                                                                                              | —                                                             | `aria-hidden` se il nome è scritto accanto, altrimenti `role="img"` con il nome; oltre 4 persone si scrive «Tutto il Nest»                                                                  |
| `Tag`                                                             | `.etichetta` (+ `--allerta`, `--insieme`, `--piccola`, `--scura`)                                                                                                                                                   | —                                                                                                                                                                                    | —                                                             | non cliccabile; mai solo colore                                                                                                                                                             |
| `Card`                                                            | `.scheda` (+ `--carta`, `--evidenza`, `--imbottita`, `--scura`, `--tratteggiata`)                                                                                                                                   | —                                                                                                                                                                                    | —                                                             | senza ombra; se tutta la scheda porta altrove il link è sul titolo                                                                                                                          |
| `List`, `ListRow`                                                 | `.lista`, `.riga-lista` e parti, `.icona-riquadro`                                                                                                                                                                  | inizio facoltativo (icona, avatar, casella), una o due righe, fine facoltativa                                                                                                       | normale, passaggio (se cliccabile), focus, spuntata (barrata) | `<ul>`/`<li>`; una riga cliccabile non contiene controlli                                                                                                                                   |
| `Sheet`                                                           | sotto 1024 px `.foglio` (+ `--alto` e parti), da 1024 px `.modale` (+ `--singola` e parti), `.velo`                                                                                                                 | foglio normale o alto; modale con pannello `__lato` o singola                                                                                                                        | chiuso, in apertura, aperto, in chiusura                      | `role="dialog"`, `aria-modal="true"`, nome = titolo `h2`; focus al primo campo, intrappolato, restituito; Esc, «Chiudi», velo; su mobile trascinando giù oltre un quarto dell'altezza (D-5) |
| `ConfirmDialog`                                                   | `.dialogo` (+ parti), `.velo`                                                                                                                                                                                       | una o più azioni                                                                                                                                                                     | aperto                                                        | `role="alertdialog"`, `aria-modal="true"`; il focus parte da «Annulla»; Esc e velo = Annulla                                                                                                |
| `Toast`, `ToastProvider`, `useToast()`                            | `.toast` (+ parti)                                                                                                                                                                                                  | testo; grassetto all'inizio (`lead`) o alla fine (`emphasis`); icona a scelta (`icon`, predefinita `check`, `null` = nessuna, #63); con «Annulla»                                    | visibile                                                      | `role="status"`; 5 secondi; uno alla volta, il nuovo sostituisce il vecchio (D-6)                                                                                                           |
| `EmptyState`                                                      | `.stato-vuoto` (+ `--grande` e parti)                                                                                                                                                                               | normale con icona; grande senza icona, con bottoni                                                                                                                                   | —                                                             | sempre con almeno un'azione                                                                                                                                                                 |
| `Skeleton`, `SkeletonGroup`                                       | `.skeleton` (+ `--testo`, `--testo-corto`, `--titolo`, `--riga`, `--scheda`, `--cerchio`, `--grande`, `--notte`), `.gruppo-skeleton`                                                                                | —                                                                                                                                                                                    | pulsa; fermo con movimento ridotto                            | scheletri `aria-hidden`; il gruppo ha `aria-busy="true"` e il testo nascosto                                                                                                                |
| `Alert`                                                           | `.avviso` (+ `--errore`, `--avviso`, `--info`, `--ok`, `--senza-azione`)                                                                                                                                            | con o senza azione a destra                                                                                                                                                          | —                                                             | `role="alert"` per gli errori, `role="status"` per gli altri                                                                                                                                |
| `PageError`                                                       | `.errore-pagina` (+ parti)                                                                                                                                                                                          | —                                                                                                                                                                                    | —                                                             | `role="alert"`; bottone «Riprova»                                                                                                                                                           |

#### Comportamenti che il mockup non scrive

- **Posizioni:** nel mockup fogli, modali, dialoghi e toast sono `position: absolute` dentro la cornice; nell'app sono `position: fixed` rispetto alla finestra. Mentre un foglio, un modale o un dialogo è aperto la pagina sotto non scorre.
- **Foglio su mobile:** `max-height: calc(100dvh - var(--size-barra))` con scorrimento interno; `.foglio--alto` occupa da `--size-barra` al fondo. Entra da sotto (`translateY(100%)` → `0`). Rilasciato prima di un quarto della sua altezza torna su in `--durata-rapida`. Margine in basso: `--space-6` + `env(safe-area-inset-bottom)`.
- **Modale da 1024 px:** in alto a `--space-12`, `max-height: calc(100dvh - 2 * var(--space-12))`, entra con dissolvenza. Stesso contenuto del foglio.
- **Dialogo:** centrato in verticale a ogni larghezza, come in `components.css` (D-4). La guida del mockup diceva «Su mobile in basso, su desktop al centro»: è sbagliata e la frase giusta, corretta in `docs/mockup/design-system.md` (#43 punto 5, #52), è «Al centro dello schermo a ogni larghezza: su mobile largo quanto lo schermo meno i margini laterali, su desktop largo `--size-dialogo`.». Bottoni in colonna a tutta larghezza: prima le azioni, ultimo «Annulla» (`.btn-secondary`).
- **Toast:** mobile `bottom: calc(var(--size-barra) + var(--space-10))` dove c'è la navigazione in basso; nelle schermate senza, `bottom: calc(var(--space-6) + env(safe-area-inset-bottom))`. Da 1024 px come `.frame-desktop .toast`. Resta fermo finché ha il focus o il mouse sopra. Dopo «Annulla» sparisce e l'elemento torna al suo posto: nessun secondo messaggio.
- **Campi data e ora (D-9):** `<input type="date">` e `<input type="time">` con la classe `.campo__input`, come nel mockup. Il calendario che si apre è quello del sistema. Si salvano in UTC e si mostrano nel fuso `Europe/Rome`.

#### Schermate notte, adesivi e testo legale (aggiunte per l'accesso, #11)

Regole in più sulle classi del mockup, solo token esistenti. Vanno nel blocco «STATI AGGIUNTI DAL DESIGNER» di `src/app/components.css`.

- **Avviso su fondo notte (**aggiunto rispetto al mockup**: correzione di leggibilità decisa dal coordinatore, modificabile da Francesco, [commento nella #11](https://github.com/fdangelo-8/familynest-web/issues/11#issuecomment-6359346297)).** Nel mockup `.avviso` ha fondo `--color-superficie` ma non dichiara il colore del testo: dentro `.tema-notte` eredita `--color-latte` e il testo su bianco arriva a 1,12:1 (illeggibile, vedi `01-accesso` errore su mobile). Regola: `.tema-notte .avviso { color: var(--color-inchiostro); }` (17,74:1 sul bianco) e `.tema-notte .avviso :focus-visible { outline-color: var(--color-info); }` (l'anello chiaro della regola dei fondi scuri sparirebbe sul bianco; `--color-info` sul bianco 6,34:1). Cambia solo il colore del testo (e dell'anello di focus): riquadro bianco, filo rosso e icona rossa restano come nel mockup. **Nota per il tester visivo:** nello stato errore di `01-accesso` su mobile il riferimento è il testo `--color-inchiostro`, non il latte del mockup; la differenza è voluta.
- **Adesivi (D1).** Il quarto adesivo del mockup («Pediatra · tra 14 giorni», `membro-glicine`, `adesivo--destra`) non si porta, in nessuna schermata (`01`, `02`–`05`, `08`). Restano tre adesivi, nell'ordine e con le classi del mockup: «Nuoto · gio 17:00» (`membro-salvia`, avatar S), «Latte e pane» (`adesivo--destra membro-zafferano`, icona `shopping-basket`), «Liberi insieme · ven sera» (`adesivo--rientro adesivo--insieme membro-insieme`, icona `heart`). Lo spazio si chiude da solo: `.adesivi` è una colonna con `gap`. Nessun adesivo sostitutivo.
- **Entrata degli adesivi su mobile** (la frase è del mockup `01-accesso`, «entrano uno alla volta, durata ampia, curva standard»; i ritardi e il keyframe sono **ricavati**): solo in `.schermo-notte`, `.schermo-notte .adesivo { animation: appare var(--durata-ampia) var(--curva) both; }` con `animation-delay` `0`, `var(--durata-rapida)` e `calc(2 * var(--durata-rapida))` per il primo, secondo e terzo adesivo. Riusa il keyframe `appare` (solo opacità): nessun movimento inventato. Con movimento ridotto la regola globale spegne l'animazione e gli adesivi sono già fermi. Su desktop (`.split-onboarding__notte`) sono fermi, come nel mockup.
- **`.legale__link` (nuova parte, **aggiunto rispetto al mockup**: nel mockup la frase legale è testo semplice, senza link).** I link «Termini d'uso» e «Informativa sulla privacy» dentro la frase legale, sia in `p.legale` (mobile, notte) sia in `p.t-nota.t-secondario` (desktop, carta). Regola: `color: inherit; text-decoration: underline; text-decoration-thickness: var(--border-sottile); text-underline-offset: var(--space-half);`. Sottolineatura più sottile e più vicina di quella di `.btn-link` (`--border-sottile` e `--space-half` invece di `--border-medio` e `--space-1`): è voluta, per il testo a 12–13 px; non va allineata a `.btn-link`. Nessun cambio al passaggio del mouse (come gli altri link sottolineati), focus globale. Sono link dentro una frase: l'area di 44 px non si applica (eccezione «in linea» di WCAG 2.5.5). Portano a `/termini` e `/privacy` (#11).
- **Schermate notte e passi tra 768 e 1023 px (**ricavato**)** (fascia tablet, layout mobile): stessa larghezza di contenuto delle pagine della fondamenta #10 (`.pagina` larga al massimo `--grid-colonna-stretta` con il margine dentro: 680 px di contenuto). Una sola regola, dentro `@media (min-width: 768px)`: `.schermo-notte, .passo-onboarding { padding-inline: max(var(--grid-margine-mobile), calc((100% - var(--grid-colonna-stretta)) / 2 + var(--grid-margine-mobile))); }`. Il fondo resta a tutta larghezza; i padding in alto e in basso non cambiano.

#### Correzioni approvate dalle proposte (#43 punti 2–5, issue #52)

Approvate da Francesco il 22/10/2026: si discostano dal mockup **di proposito**. Il tester visivo confronta queste parti con la skill, non con `docs/mockup/components.css`.

- **Bordo dei campi (punto 2).** Nelle regole copiate dal mockup `.campo__input` e `.campo-rapido` il bordo a riposo diventa `box-shadow: inset 0 0 0 var(--border-sottile) var(--color-filo-campo);` (si cambia solo la variabile, sul posto, con un commento `/* #52 */`). Vale per tutti i tipi di `.campo__input`: testo, mail, numero, area di testo, select (`.campo__select-box`), data e ora. Stati: riposo `--color-filo-campo` 1 px; nessun passaggio del mouse (come prima); focus `inset 0 0 0 var(--border-medio) var(--color-inchiostro)` (invariato, 17,74:1); `.campo-rapido--attivo` invariato; errore `inset 0 0 0 var(--border-medio) var(--color-allerta)` (invariato, 5,31:1 sul bianco, 4,72:1 sulla carta); disabilitato `--opacity-disabilitato` sull'intero campo (invariato, esente dal contrasto). Restano a `--color-filo-2`: `.btn-secondary`, `.kbd`, cornici della cella e del giorno scelti, maniglia, tacche, tratteggi, interruttore spento, cerchi di `.scelta__radio` e `.passo-partenza__cerchio` (non sono campi: fuori dall'approvazione). `.campo-frase` non ha bordo nel mockup e resta senza; `.campo-ricerca` ha già il bordo `--color-inchiostro`.
- **Giorni fuori dal mese (punto 3).** `.griglia-mese__cella--fuori .griglia-mese__numero { color: var(--color-inchiostro-2); }` al posto di `--color-inchiostro-3` (5,86:1 sulla carta invece di 2,96:1). Restano visibili e cliccabili come oggi. È lo stesso grigio dei sabati e delle domeniche: è voluto, perché un grigio diverso e ancora leggibile (≥4,5:1) non si distinguerebbe a occhio; il mese si capisce dalla posizione (prima dell'1 e dopo l'ultimo giorno) e l'`aria-label` dice già il mese («28 settembre»). Un giorno fuori dal mese e festivo (es. «1 novembre») resta `--color-allerta`, come oggi. Il numero di oggi resta bianco latte su inchiostro.
- **Bottone rosso pieno (punto 4).** Dentro `@media (hover: hover)`: `.btn-pericolo-pieno` entra nell'elenco delle transizioni (`background` in `--durata-rapida` con `--curva`) e `.btn-pericolo-pieno:hover:not(:disabled, [aria-disabled="true"]) { background: var(--color-allerta-scuro); }`. Fuori dalla media query, stessa regola con `:active`. Testo `--color-bianco` invariato (6,94:1). Disabilitato e in caricamento: nessun cambio di fondo. `.btn-pericolo` (link rosso sottolineato) non cambia.
- **Dialogo su mobile (punto 5).** Nessun cambio al codice: il dialogo è già al centro. Cambia solo la frase della guida (vedi «Dialogo» sopra).

#### Componenti condivisi di Casa (#63)

Nati per Spesa (#21), riusati da Da fare (#23) e Scadenze (#24). Specifica completa nella [#63](https://github.com/fdangelo-8/familynest-web/issues/63). Regole nuove nel blocco «STATI AGGIUNTI DAL DESIGNER», solo token esistenti; nessuna differenza tra 390 e 1280 px.

- **Spunta tonda (`.tondo-spunta`).** Vuota: anello `--border-medio` `--color-inchiostro-2`; piena: fondo `--color-inchiostro`, `check` 16 px `--color-latte`. Nessun passaggio del mouse né premuto, come `.casella`. Disabilitata: in «Disabilitato esteso a tutti i controlli» (`--opacity-disabilitato`, `cursor: not-allowed`) (**decisione del designer, modificabile da Francesco**). Area di tocco 44 × 44 (proposta 7 della #43, **approvata** da Francesco il 22/10): `.tondo-spunta` entra nell'elenco «Area di tocco di almeno 44 x 44» con `.casella` (`position: relative` + `::before` invisibile, `max(100%, var(--size-tocco))`); il disegno resta 22 × 22, l'anello di focus resta attorno al tondo. In una `.riga-lista` l'area resta dentro la riga e non arriva al testo.
- **Selettore con voci-link.** Il link `.selettore__voce` ha lo stesso aspetto e gli stessi passaggio, premuto e focus della voce non scelta (regole esistenti, scritte sulla classe; la sottolineatura la toglie il reset `:where(a)`). Area di tocco: `.selettore__voce` (bottoni e link, anche di `SegmentedControl` e della lente) entra nello stesso elenco del tondo (#43 punto 7, approvata): voce visibile 32 px, area alta 44 px e larga quanto la voce, senza sovrapposizioni tra voci affiancate. Nessun'altra regola nuova. La voce della pagina attuale tiene il passaggio `--color-notte-2` come in `SegmentedControl`. Il conteggio delle voci non scelte a 2,22:1 è la proposta P1 della #21: non si corregge qui.
- **Campo rapido.** `.campo-rapido:focus-within` uguale a `.campo-rapido--attivo` (bordo `--border-medio` `--color-inchiostro`, `+` su inchiostro con icona latte): è l'indicatore di focus, perché l'input ha `outline: none` nel mockup. `--attivo` anche quando c'è testo o con `active`. Cambio immediato, senza transizione; nessun passaggio del mouse; il «+» è decorativo (non cliccabile). Nessuno stato disabilitato né errore. Bordo a riposo `--color-filo-campo` (#52).
- **Icona del toast (**decisione del designer, modificabile da Francesco**).** L'icona dice cosa è successo, come nel mockup: `check` per le azioni fatte (predefinita), `scissors` per lo strappo, quella del mockup della pagina altrove (`pin`, `gift`, `send`). **Se non è successo niente, nessuna icona** (`icon: null`): doppione («**Latte** è già in lista.»), modifica non salvata. Non si usa `circle-alert` nei toast. Senza icona il testo parte dal padding: nessuno spazio vuoto.
- **Strappo.** `.strappo__lama { transform: translateX(var(--strappo-avanzamento, 0)); transition: transform var(--durata-rapida) var(--curva); }`; `.strappo.is-trascinato .strappo__lama { transition: none; cursor: grabbing; }`. Passaggio (in `@media (hover: hover)`) e premuto della lama: fondo `--color-notte-2`, **senza transizione di fondo** (la lama è una maniglia; la sua transizione resta solo `transform`; si scosta dalla regola generale del passaggio: **decisione del designer, modificabile da Francesco**). Durante il trascinamento il fondo `--color-notte-2` arriva da `:active`, non da `.is-trascinato`. `--strappo-avanzamento` lo imposta la pagina con `style.setProperty`, mai `style=` nel JSX. L'anello di focus sta dentro lo strappo (3,5 px contro 4 px di margine), `overflow: hidden` non lo taglia. Nessun componente React: lo strappo lo costruisce la pagina Spesa.
- **Segnaposto `/casa/da-fare` e `/casa/scadenze`.** `PlaceholderPage` con il trattamento di Casa, icone `square-check` e `file-clock`, senza selettore (**diverso dal mockup 16 e 17**, provvisorio fino a #23 e #24; **decisione del designer, modificabile da Francesco**).

### Classi senza componente React (per ora)

Si usano direttamente come classi nelle pagine; se una pagina vuole un componente React lo chiede con una issue `richiesta-condivisa`. Barra e navigazione (`.barra`, `.quadrato-nest`, `.nav-basso`, `.btn-aggiungi`, `.nav-alto`, `.menu-laterale`) appartengono alla fondamenta «layout e navigazione». Le altre: `.lente`, `.periodo`, `.tacche-passi`, `.pagina`, `.pagina-desktop`, `.colonne`, `.colonna`, `.intestazione`, `.intestazione-desktop`, `.sezione`, `.sottotitolo-gruppo`, `.prossimo`, `.contatore`, `.scheda-modulo`, `.puntina`, `.porta`, `.spazi-fissati`, `.scheda-spazio`, `.sintesi`, `.parola`, `.tabella-dati`, `.riga-opzione`, `.riga-evento`, `.riga-gia-fatti`, `.riga-scadenza`, `.riga-notifica`, `.riga-regalo`, `.foto`, `.scheda-regalo`, `.strappo`, `.pallino-urgente`, `.kbd`, `.logo-marchio`, `.anteprima-avatar`, `.cerchi-membri`, `.scelta-colore`, `.campo-frase`, `.campo-ricerca`, `.evidenzia`, `.scelta`, `.gruppo-scelte`, `.palette`, il calendario (`.striscia-giorni`, `.griglia-mese`, `.giorno-persone`, `.colonna-ore`, `.area-orari`, `.blocco-orario`, `.linea-adesso`, `.griglia-settimana`) e l'onboarding (`.split-onboarding`, `.passo-onboarding`, `.schermo-notte`, `.marchio`, `.adesivi`, `.adesivo`, `.claim`, `.citazione`, `.legale`, `.codice-invito`, `.qr`, `.lista-partenza`, `.passo-partenza`, `.profilo-testa`).

## Pattern

- **Aggiungere:** un solo modulo (`Sheet`) con il campo frase in alto e il selettore del tipo (Impegno, Spesa, Da fare, Scadenza).
- **Confermare e annullare:** dopo ogni azione reversibile un `Toast` con «Annulla». Niente dialoghi per ciò che si può annullare.
- **Eliminare:** sempre con `ConfirmDialog`: titolo a domanda con il nome tra «», conseguenza nel testo, bottone rosso pieno con il verbo + «Annulla».
- **Vuoto:** cosa manca e come cominciare, con un'azione. Mai solo «Nessun dato».
- **Caricamento:** scheletri con la forma del contenuto; bottoni con spinner.
- **Errore:** di un campo → sotto il campo; di una parte → `Alert` con azione («Riprova», «Ricollega»); di tutta la pagina → `PageError` con «Riprova».
- **Foglio o modale:** stesso contenuto, cambia solo il contenitore.
- **Privacy:** visibilità a tre livelli (Solo io, Occupato, Tutto il Nest) scelta con un `SegmentedControl`; gli «Occupato» sono righe grigie senza dettagli.

## Tono di voce

- Si parla come una persona di casa: diretto, caldo, mai di marketing. Del tu. Frasi brevi, prima l'informazione.
- Nomi delle persone al posto dei ruoli («la porta Laura», non «accompagnatore»).
- Bottoni: verbo specifico e oggetto quando serve («Aggiungi Sofia», «Collega il calendario», «Elimina impegno»). La stessa azione ha lo stesso nome in tutto il percorso: il bottone «Aggiungi» produce il toast «Aggiunto».
- Errori: cosa è successo e cosa fare. Mai codici, mai colpa all'utente, mai scuse vuote.
- Niente punti esclamativi, emoji, parole inglesi quando c'è quella italiana, parole tecniche («API», «token», «sync failed»). Virgolette basse «» per i titoli citati.
- Maiuscola solo a inizio frase e nei nomi propri (le etichette dei marchi come «OUTLOOK» sono l'unica eccezione del mockup).

| Situazione                 | Sì (dal mockup)                                                                                         | No                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Saluto in Oggi             | «Buon pomeriggio, Marco»                                                                                | «Benvenuto nella tua dashboard!»      |
| Tempo che manca            | «tra 1 h 8 min»                                                                                         | «In arrivo: 68 minuti rimanenti»      |
| Stato vuoto                | «Giornata libera, per ora» · «Collega il calendario o aggiungi un impegno.»                             | «Nessun evento trovato.»              |
| Errore di sincronizzazione | «Non riusciamo a sincronizzare Outlook dalle 13:10: la password potrebbe essere cambiata.»              | «Errore 401: autenticazione fallita.» |
| Errore di un campo         | «Scrivi il nome per continuare.»                                                                        | «Campo obbligatorio.»                 |
| Senza connessione          | «Sei offline. Vedi le cose aggiornate alle 15:40; le modifiche partiranno appena torna la connessione.» | «Network error.»                      |
| Conferma                   | «Aggiunto. Nuoto Sofia, giovedì alle 17.» · «Fatto: Chiamare il commercialista» + «Annulla»             | «Operazione completata con successo!» |
| Eliminazione               | «Eliminare «Nuoto Sofia»?» · «Laura e Sofia non lo vedranno più nel calendario.»                        | «Sei sicuro di voler procedere?»      |
| Elemento sparito           | «Questo impegno non c'è più» · «Forse l'ha eliminato chi l'aveva creato.»                               | «404 Not Found»                       |
| Visibilità                 | «Gli altri vedono solo che sei occupato.»                                                               | «Privacy impostata su: Busy»          |
| Spesa                      | «Strappa qui: togli i presi»                                                                            | «Elimina elementi completati»         |

### Date e ore

Sempre nel fuso `Europe/Rome`, con le funzioni centralizzate di `src/lib/` (requisito della issue #8, decisioni D-7, D-8, D-10).

| Uso                 | Esempio                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Ora                 | «17:00», «8:00» (24 ore, minuti sempre a due cifre)                                 |
| Giorno              | «Martedì 20 ottobre» a inizio frase, «martedì 20 ottobre» dentro la frase           |
| Giorno breve / mese | «Lun» · «Ottobre 2026»                                                              |
| Intervallo          | «19 – 25 ottobre», «28 settembre – 4 ottobre», «29 dicembre 2026 – 4 gennaio 2027»  |
| Tempo che manca     | «tra meno di un minuto», «tra 1 minuto», «tra 8 minuti», «tra 2 h», «tra 1 h 8 min» |
| Giorni              | «ieri», «domani», «tra 6 giorni»                                                    |

### Testi standard dei componenti di base

Da usare quando la pagina non ne indica di più specifici.

| Dove                                         | Testo                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Testo nascosto durante il caricamento        | «Caricamento in corso»                                                                                                                       |
| Bottone in caricamento                       | stesso testo del bottone; dove il mockup lo cambia si segue il mockup («Accesso con Google in corso»)                                        |
| X di fogli e modali                          | `aria-label` «Chiudi»                                                                                                                        |
| Freccia indietro                             | `aria-label` «Indietro»                                                                                                                      |
| Azione del toast, ultimo bottone del dialogo | «Annulla»                                                                                                                                    |
| Errore di una parte                          | «Non riusciamo a caricare <cosa>. Controlla la connessione e riprova.» + «Riprova»                                                           |
| Errore di tutta la pagina                    | Titolo «Questa pagina non si è caricata». Testo «Controlla la connessione e riprova. Se il problema resta, torna a Oggi.» Bottone «Riprova». |
| Pagina inesistente                           | Titolo «Questa pagina non c'è». Testo «Il link potrebbe essere vecchio o scritto male.» Bottone «Torna a Oggi».                              |
| Salvataggio non riuscito                     | «Non siamo riusciti a salvare. Controlla la connessione e riprova.» + «Riprova»                                                              |

## Cosa non fare

- Valori scritti a mano, Tailwind, librerie di componenti, stile in linea, classi rinominate rispetto al mockup.
- Ombre sulle schede: si staccano dal fondo con il bianco e il filo interno di 1 px. Ombre solo per barre, fogli, modali e adesivi.
- Rosso per dire «tra poco»; `--color-inchiostro-3` per il testo; colore delle persone fuori dagli avatar.
- Hamburger (il Nest si apre dal quadrato colorato), righello del tempo in cima a Oggi, selettore Oggi/Domani/Weekend in Oggi.
- Bottoni dentro altri bottoni o link.
- Testi segnaposto («Lorem ipsum», «Titolo qui»), parole tecniche, punti esclamativi, emoji.
- Campi data e ora senza la classe `.campo__input` o formattati fuori dalle funzioni di `src/lib/`.
- Spinner a pagina intera.

## Registro delle modifiche

| Data       | Modifica                                                                                                                                                                                                                                                                                                                                        | Issue |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 22/10/2026 | Prima versione dal mockup v1.0: 202 token, font con `next/font` (D-1), classi globali con i nomi del mockup (D-2), stati di passaggio e premuto ricavati dai token, focus su fondo scuro, componenti React di base, comportamenti non scritti (D-4, D-5, D-6, D-9), formati di date e ore, tono di voce e testi standard.                       | #8    |
| 23/10/2026 | Schermate notte: testo scuro e anello blu per `.avviso` dentro `.tema-notte` (correzione di leggibilità decisa dal coordinatore nella #11, modificabile da Francesco), tre adesivi senza «Pediatra» (D1), entrata degli adesivi su mobile, nuova parte `.legale__link`, centramento delle schermate notte e dei passi nella fascia 768–1023 px. | #11   |
| 23/10/2026 | Correzioni approvate da Francesco (#43 punti 2–5): nuovo `--color-filo-campo` `#82858B` per il bordo dei campi, giorni fuori dal mese in `--color-inchiostro-2`, nuovo `--color-allerta-scuro` `#A82A27` per passaggio e premuto di `.btn-pericolo-pieno`, frase del dialogo su mobile corretta nella guida.                                    | #52   |
| 23/10/2026 | Componenti condivisi di Casa: `Checkbox` tonda, `SectionSwitcher`, `QuickAddField`, `Toast` con `lead` e `icon` (regola dell'icona: nessuna se non è successo niente), regole dello strappo e del campo rapido, segnaposto di Da fare e Scadenze; area di tocco 44 px per `.tondo-spunta` e `.selettore__voce` (#43 punto 7, approvata).        | #63   |
