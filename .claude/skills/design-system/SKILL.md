---
name: design-system
description: Design system di FamilyNest Web - token di colore, tipografia, spaziature, componenti e tono di voce. Usala prima di scrivere o rivedere qualsiasi interfaccia, CSS o testo visibile all'utente.
---

# Design system di FamilyNest

> **Stato: v1.0, compilata il 22/10/2026 dal mockup approvato** (`docs/mockup/tokens.css`, `components.css`, `design-system.md`, `design-system.html`) e dalle decisioni di Francesco (`docs/mockup/DECISIONI.md`). Issue di riferimento: #8.

## Fonti e precedenza

1. Decisioni di Francesco in `docs/mockup/DECISIONI.md` (vincono sul mockup).
2. Valori: `docs/mockup/tokens.css` (202 variabili). Il blocco pronto da copiare in `src/app/globals.css` è `docs/agenti/design/token.css` (identico, cambia solo l'aggancio dei font a `next/font`).
3. Aspetto dei componenti: `docs/mockup/components.css`. Ogni regola dei componenti React si scrive partendo da lì, con gli stessi token.
4. Comportamento e accessibilità di ogni componente: `docs/mockup/design-system.md` §7–§11.
5. Questa skill: regole d'uso, stati che il mockup non disegna, componenti nuovi, tono di voce. Dove il mockup e questa skill sembrano in contrasto, vale il mockup e si apre una domanda nella issue.

## Regole sempre valide

- Solo CSS proprio. I valori vivono come variabili in `:root` dentro `src/app/globals.css`; i componenti usano **solo variabili**, mai colori, font o misure scritti a mano. Eccezioni ammesse: `0`, `1`, `100%`, `50%`, `auto`, `env(safe-area-inset-*)`, le larghezze delle media query (le variabili non funzionano lì).
- Se un valore manca, non si inventa: lo aggiunge il designer qui e in `docs/agenti/design/token.css`, con una issue `proposta-design` se cambia il mockup.
- Niente Tailwind, niente librerie di componenti, niente CSS-in-JS.
- Mobile first: si scrive prima il layout a 390 px, poi si adatta a 1280 px con media query.
- Un componente condiviso vive in `src/components/ui/<Nome>/` con il suo file CSS module; se una pagina ha bisogno di una variante nuova, la definisce il designer qui, non lo sviluppatore.
- Niente estetica "generata dall'AI": niente gradienti, card inclinate, ombre sulle schede, illustrazioni, emoji, CTA generiche ("Clicca qui", "Invia"), icone `+` senza testo dove il mockup ha un'etichetta.
- Tema scuro completo: **fuori perimetro** (decisione aperta). `.tema-notte` e i token `--color-notte*`, `--color-latte*` servono solo alle schermate scure già disegnate: accesso, chiusura dell'onboarding, schede e blocchi «porta».
- Il colore delle persone (`--color-membro-*`) vive solo negli avatar, nei punti del mese e negli adesivi. Mai su testi, schede o sfondi.
- `--color-inchiostro-3` non si usa mai per il testo (3,33:1). Il rosso (`--color-allerta`) solo per errori e urgente, mai per «tra poco».
- Niente stile in linea (`style=`), salvo le variabili di posizione calcolate dei blocchi orari (`--inizio`, `--durata`, `--persone`, `--ore`), come nel mockup.
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
| `--color-filo-2`       | `#CFD1CA` | bordi dei campi, bordi tratteggiati            |
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

| Variabile         | Valore    | Uso |
| ----------------- | --------- | --- |
| `--color-ok`      | `#237A4B` |     |
| `--color-avviso`  | `#A15C07` |     |
| `--color-allerta` | `#C8322F` |     |
| `--color-info`    | `#3355CC` |     |
| `--color-bianco`  | `#FFFFFF` |     |

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

Le media query non leggono le variabili: si scrivono i numeri, sempre questi tre.

| Nome    | Larghezza     | Layout                                                                                                    |
| ------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| mobile  | fino a 767 px | Stili di base (nessuna media query). Una colonna, barra in alto, navigazione in basso, fogli dal basso.   |
| tablet  | 768–1023 px   | `@media (min-width: 768px)`: layout mobile con contenuto centrato al massimo su `--grid-colonna-stretta`. |
| desktop | da 1024 px    | `@media (min-width: 1024px)`: navigazione in alto, colonne, modali centrati, toast in basso a destra.     |

Riferimenti dei mockup: 390 × 844 px (`--size-frame-mobile`) e 1280 × 800 px (`--size-frame-desktop`). Nel mockup le regole `.frame-desktop .x` diventano nell'app `@media (min-width: 1024px) { .x }`; le regole `.frame-mobile, .frame-desktop` diventano regole su `body`.

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

| Testo o segno          | Fondo                | Rapporto | Uso                                                                             |
| ---------------------- | -------------------- | -------- | ------------------------------------------------------------------------------- |
| `--color-inchiostro`   | `--color-carta`      | 15,78:1  | testo principale                                                                |
| `--color-inchiostro-2` | `--color-carta`      | 5,86:1   | testo secondario sulle pagine                                                   |
| `--color-inchiostro-2` | `--color-superficie` | 6,59:1   | testo secondario nelle schede                                                   |
| `--color-latte`        | `--color-inchiostro` | 15,85:1  | bottoni principali, voci scelte                                                 |
| `--color-latte`        | `--color-notte`      | 15,55:1  | toast, schede scure, schermate notte                                            |
| `--color-allerta`      | `--color-carta`      | 4,72:1   | errori sulle pagine (minimo raggiunto)                                          |
| `--color-bianco`       | `--color-allerta`    | 5,31:1   | bottone pericoloso pieno                                                        |
| `--color-info`         | `--color-carta`      | 5,64:1   | anello di focus su fondo chiaro                                                 |
| `--color-info`         | `--color-notte`      | 2,74:1   | **insufficiente**: su fondo scuro l'anello di focus è `--color-latte` (15,55:1) |

## Iconografia

- Lucide `lucide-static` 0.460.0, a tratto: `stroke: currentColor`, `fill: none`, `stroke-width: var(--border-medio)`, estremità e giunzioni arrotondate.
- Taglie: 16 px `--size-icona-s`, 20 px `--size-icona-m` (predefinita), 24 px `--size-icona-l`.
- Nell'app: un unico sprite statico `public/icons.svg` con i `<symbol id="i-nome" viewBox="0 0 24 24">` copiati **identici** dai mockup (80 icone, elenco in `design-system.md` §6, senza `stethoscope`), più la nota di licenza ISC di Lucide. Nessun pacchetto nuovo. Il componente `Icon` scrive `<svg class="…" aria-hidden="true"><use href="/icons.svg#i-nome"/></svg>`.
- Icona decorativa: sempre `aria-hidden="true"`. Bottone con sola icona: `aria-label` scritto come azione.
- I calendari esterni non usano loghi originali: `.logo-marchio` (iniziale sul colore del marchio).

## Movimento

- Fogli e modali entrano in `--durata-normale` con `--curva`, escono in `--durata-rapida`.
- Interruttori, chip, caselle, cambi di fondo al passaggio del mouse: `--durata-rapida`.
- Spinner: un giro ogni `--durata-ampia`, lineare. Scheletri: pulsazione tra opacità 1 e `--opacity-passato` in `--durata-ampia`, alternata.
- Riga spuntata: resta al suo posto per `--durata-ampia` prima di scendere.
- `@media (prefers-reduced-motion: reduce)`: animazioni e transizioni spente in tutta l'app (`animation: none; transition: none`). Lo spinner resta fermo, il bottone resta `aria-busy`.
- Niente rimbalzi, parallasse, comparse a scorrimento o animazioni decorative.

## Stati comuni a tutti i controlli

Il mockup disegna focus, disabilitato, errore e caricamento; **non disegna il passaggio del mouse né il «premuto»** (citato come stato ma senza stile). Qui sotto li completa il designer usando solo token esistenti: nessun colore nuovo.

| Stato               | Regola                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normale             | Come in `components.css`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Passaggio del mouse | Solo dentro `@media (hover: hover)`, transizione `background-color` in `--durata-rapida`. Fondo `--color-inchiostro` → `--color-notte-2`. Fondo `--color-superficie` → `--color-carta`. Fondo `--color-carta` → `--color-carta-2`. Fondo trasparente (righe, giorni, voci): `--color-carta` se sta su una superficie bianca, `--color-carta-2` se sta sulla pagina. Fondo `--color-latte` (`btn-chiaro`) → `--color-latte-2`. Voci di navigazione e selettore non scelte: testo da `--color-inchiostro-2` a `--color-inchiostro`. Link sottolineati e `btn-pericolo`/`btn-pericolo-pieno`: nessun cambio. |
| Premuto (`:active`) | Stesso fondo del passaggio del mouse, anche su schermi touch. Nessuno spostamento, nessun ridimensionamento.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Focus da tastiera   | Globale: `:focus-visible { outline: var(--border-medio) solid var(--color-info); outline-offset: var(--space-half); }`. Su fondo `--color-notte` o `--color-inchiostro` (toast, `.tema-notte`, schede scure) l'anello è `--color-latte`. I campi di testo invece hanno `outline: none` e l'anello interno `inset 0 0 0 var(--border-medio) var(--color-inchiostro)` a ogni `:focus`, come nel mockup.                                                                                                                                                                                                     |
| Disabilitato        | `opacity: var(--opacity-disabilitato)`, `cursor: not-allowed`, nessun effetto di passaggio o premuto. Attributo `disabled` sui controlli nativi, `aria-disabled="true"` sui link. Vale per tutti: bottoni, campi, casella, interruttore, chip, voci del selettore, scelta colore, giorni del selettore di data.                                                                                                                                                                                                                                                                                           |
| Errore              | Campo: `.campo--errore` (anello `--border-medio` `--color-allerta`) + messaggio sotto con icona `circle-alert` 16 px, `aria-invalid="true"` e `aria-describedby`. Parte di pagina: `Alert` di tipo errore. Pagina intera: `PageError`.                                                                                                                                                                                                                                                                                                                                                                    |
| Caricamento         | Bottone: `.is-caricamento` → `Spinner` prima del testo, testo a `--opacity-passato`, `aria-busy="true"`, larghezza invariata, niente clic ripetuti. Contenuto: `Skeleton` con la forma del contenuto, contenitore `aria-busy="true"` + testo nascosto «Caricamento in corso». Mai spinner a pagina intera.                                                                                                                                                                                                                                                                                                |

Aree di tocco: ogni controllo ha almeno 44 × 44 px (`--size-tocco`). Dove il disegno è più piccolo (`btn-icona--piccolo` 32 px, casella 22 px, interruttore 26 px di altezza, giorni del selettore di data su desktop 40 px) l'area si allarga con un `::before` trasparente o con il padding della riga, senza cambiare il disegno.

## Componenti

Nomi dei componenti React in inglese (regola del progetto), classi dei CSS module in inglese; la colonna «Mockup» indica la classe di riferimento in `components.css`. I token restano quelli italiani del mockup.

### Base, da creare nella fondamenta (#8)

| Componente React                       | Mockup                                                                                                                                  | Varianti                                                                                                                                                                                                                                                                            | Stati                                                               | Accessibilità                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Icon`                                 | `.icona`, `.sprite-icone`                                                                                                               | `size`: `s` 16, `m` 20 (predefinita), `l` 24                                                                                                                                                                                                                                        | colore = `currentColor`                                             | `aria-hidden="true"` sempre                                                                                                                       |
| `VisuallyHidden`                       | `.visivamente-nascosto`                                                                                                                 | —                                                                                                                                                                                                                                                                                   | —                                                                   | al posto di `display: none` per testi da leggere                                                                                                  |
| `Button`                               | `.btn-primary`, `.btn-secondary`, `.btn-chiaro`, `.btn-tenue`, `.btn-tratteggiato`, `.btn-link`, `.btn-pericolo`, `.btn-pericolo-pieno` | `variant`: `primary`, `secondary`, `light`, `soft`, `dashed`, `link`, `linkSecondary`, `danger`, `dangerSolid`; `size`: normale 52 px (`--size-azione`) o `small` 40 px (`--size-controllo`); `fullWidth` (`btn--pieno`); `trailingArrow` (`btn-primary--freccia`, solo onboarding) | normale, passaggio, premuto, focus, disabilitato, caricamento       | testo visibile sempre, verbo specifico; `<a>` se porta altrove, `<button>` se agisce sul posto; caricamento con `aria-busy`                       |
| `IconButton`                           | `.btn-icona`                                                                                                                            | normale 40 px; `paper` (`--carta`, 52 px); `small` (32 px, dentro fogli e righe); `dot` (pallino rosso «novità»)                                                                                                                                                                    | normale, passaggio, premuto, focus, disabilitato                    | `aria-label` obbligatorio («Indietro», «Chiudi», «Notifiche, 3 nuove»); area 44 px                                                                |
| `Spinner`                              | `.spinner`                                                                                                                              | —                                                                                                                                                                                                                                                                                   | gira; fermo con movimento ridotto                                   | decorativo; lo stato è `aria-busy` sul bottone                                                                                                    |
| `TextField`, `SelectField`, `FieldRow` | `.campo`, `.campo__select-box`, `.campo-doppio`                                                                                         | testo, mail, numero, area di testo; select con chevron `chevron-down` 16 px a destra; due campi affiancati                                                                                                                                                                          | vuoto, compilato, focus, errore, disabilitato                       | `<label for>` sempre visibile; errore con `aria-invalid` + `aria-describedby`; l'errore compare dopo l'invio, non mentre si scrive                |
| `Checkbox`                             | `.casella`                                                                                                                              | —                                                                                                                                                                                                                                                                                   | vuota, spuntata, focus, disabilitata                                | `role="checkbox"` + `aria-checked` + `aria-label` con l'azione («Segna come fatto: …»)                                                            |
| `Switch`                               | `.toggle`                                                                                                                               | —                                                                                                                                                                                                                                                                                   | spento, acceso, focus, disabilitato                                 | `role="switch"` + `aria-checked` + nome; effetto immediato, senza Salva                                                                           |
| `SegmentedControl`                     | `.selettore`                                                                                                                            | normale (fondo superficie), `paper` (`selettore--carta`); conteggio facoltativo accanto alla voce                                                                                                                                                                                   | voce scelta, voce normale, passaggio, focus, disabilitata           | gruppo con `aria-label`; ogni voce `<button aria-pressed>`                                                                                        |
| `Chip`, `ChipGroup`                    | `.chip`, `.gruppo-chip`                                                                                                                 | `person` (con avatar), `static` (solo lettura); gruppo che va a capo o `scroll` orizzontale                                                                                                                                                                                         | scelto, non scelto, passaggio, focus, disabilitato                  | `<button aria-pressed>`; gruppo `role="group"` con `aria-label`                                                                                   |
| `Avatar`, `AvatarGroup`                | `.avatar`, `.avatar-gruppo`                                                                                                             | taglie `xs` 18, `s` 24 (predefinita), `m` 32, `l` 44, `xl` 72; `dot` 9 px; `empty` tratteggiato; colore con le classi `membro-*`; gruppo `large`, `night`                                                                                                                           | —                                                                   | `aria-hidden` se il nome è scritto accanto, altrimenti `role="img"` con il nome; oltre 4 persone si scrive «Tutto il Nest»                        |
| `Tag`                                  | `.etichetta`                                                                                                                            | normale, `small`, `dark`, `alert`, `together` (giallo «Liberi insieme»)                                                                                                                                                                                                             | —                                                                   | non cliccabile; mai solo colore                                                                                                                   |
| `Card`                                 | `.scheda`                                                                                                                               | normale, `padded`, `highlight` (filo nero in cima), `dark`, `dashed`, `paper`                                                                                                                                                                                                       | —                                                                   | senza ombra; se tutta la scheda porta altrove il link è sul titolo                                                                                |
| `List`, `ListRow`                      | `.lista`, `.riga-lista`, `.icona-riquadro`                                                                                              | con o senza elemento iniziale (icona in riquadro, avatar, casella); testo su una o due righe; elemento finale (chevron, etichetta, interruttore)                                                                                                                                    | normale, passaggio (se cliccabile), focus, spuntata (barrata)       | `<ul>`/`<li>`; mai un controllo dentro una riga che è un link                                                                                     |
| `Sheet`                                | `.velo`, `.foglio`, `.modale`                                                                                                           | mobile: foglio normale o `tall` (`foglio--alto`); desktop: modale a due colonne con pannello di aiuto o `single` (`modale--singola`, 680 px)                                                                                                                                        | chiuso, in apertura, aperto, in chiusura                            | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` sul titolo; focus intrappolato, va al primo campo, torna dove era; Esc, X e velo chiudono |
| `ConfirmDialog`                        | `.dialogo`                                                                                                                              | una conferma, o più scelte (es. «Elimina tutti i prossimi» / «Elimina solo questo»)                                                                                                                                                                                                 | aperto                                                              | `role="alertdialog"`, `aria-modal="true"`, titolo e testo collegati; il focus parte da «Annulla»                                                  |
| `Toast`, `ToastProvider`               | `.toast`                                                                                                                                | solo testo, con icona `check`, con azione «Annulla»                                                                                                                                                                                                                                 | visibile, in uscita                                                 | `role="status"`; resta 5 secondi e si ferma finché ha il focus o il mouse sopra                                                                   |
| `EmptyState`                           | `.stato-vuoto`                                                                                                                          | normale (icona in riquadro + titolo + testo con link), `large` (senza icona, titolo Parkinsans, uno o due bottoni)                                                                                                                                                                  | —                                                                   | sempre con un'azione possibile                                                                                                                    |
| `Skeleton`, `SkeletonGroup`            | `.skeleton`, `.gruppo-skeleton`                                                                                                         | `text`, `textShort`, `title`, `row`, `card`, `large`, `circle`, `night`                                                                                                                                                                                                             | pulsa; fermo con movimento ridotto                                  | `aria-hidden`; il contenitore ha `aria-busy="true"` e il testo nascosto                                                                           |
| `Alert`                                | `.avviso`                                                                                                                               | `error` (rosso), `warning` (arancio), `info` (blu), `success` (verde); con o senza azione a destra (`btn-link`)                                                                                                                                                                     | —                                                                   | `role="alert"` per gli errori, `role="status"` per gli altri                                                                                      |
| `PageError`                            | `.errore-pagina`                                                                                                                        | —                                                                                                                                                                                                                                                                                   | —                                                                   | `role="alert"`; titolo `h1` se è l'unico contenuto della pagina                                                                                   |
| `DatePicker`                           | nuovo (vedi sotto)                                                                                                                      | —                                                                                                                                                                                                                                                                                   | chiuso vuoto, chiuso compilato, aperto, focus, errore, disabilitato | vedi sotto                                                                                                                                        |
| `TimeField`                            | nuovo (vedi sotto)                                                                                                                      | —                                                                                                                                                                                                                                                                                   | vuoto, compilato, focus, errore, disabilitato                       | vedi sotto                                                                                                                                        |

Misure di ogni componente: quelle di `components.css`, regola per regola. Posizioni: nel mockup fogli, modali, dialoghi e toast sono `position: absolute` dentro la cornice; nell'app sono `position: fixed` rispetto alla finestra, con lo scorrimento della pagina bloccato mentre un foglio, un modale o un dialogo è aperto.

#### Dettagli di comportamento non scritti nel mockup

- **Sheet su mobile:** larghezza piena, `max-height: calc(100dvh - var(--size-barra))` con scorrimento interno; `tall` occupa da `--size-barra` al fondo. Entra da sotto (`translateY(100%)` → `0`). Si chiude trascinando giù oltre un terzo della sua altezza, con la X (`IconButton small`, «Chiudi») o toccando il velo. Margine in basso: `--space-6` + `env(safe-area-inset-bottom)`.
- **Sheet tra 768 e 1023 px:** foglio dal basso, largo al massimo `--grid-colonna-stretta`, centrato.
- **Sheet da 1024 px:** modale centrato in alto a `--space-12`, `max-height: calc(100dvh - 2 * var(--space-12))`, entra con dissolvenza. Stesso contenuto del foglio.
- **ConfirmDialog:** su ogni larghezza è centrato in verticale, come in `components.css` (mobile con margini `--grid-margine-mobile`, desktop largo `--size-dialogo`). Bottoni in colonna, a tutta larghezza: prima l'azione (`dangerSolid` se elimina), ultimo «Annulla» (`secondary`). Il velo non chiude il dialogo; Esc equivale ad «Annulla».
- **Toast:** uno alla volta (il nuovo sostituisce il precedente). Mobile: `bottom: calc(var(--size-barra) + var(--space-10))` dove c'è la navigazione in basso, `bottom: calc(var(--space-6) + env(safe-area-inset-bottom))` nelle schermate senza; da 1024 px in basso a destra (`right: --grid-margine-desktop`, `bottom: --space-8`, largo `--size-dialogo`). Fondo `--color-notte`: anello di focus `--color-latte`. Dopo «Annulla» il toast sparisce e l'elemento torna al suo posto: nessun secondo messaggio.
- **SelectField:** `<select>` nativo con l'aspetto di `.campo__input` (`appearance: none`) e il chevron disegnato, come nel mockup. La lista che si apre resta quella del sistema: per le date non si usa (vedi `DatePicker`).

### `DatePicker` — Selettore di data (nuovo)

Il mockup usa `<input type="date">` (es. `10-aggiungi`, `11-dettaglio-impegno`, `17-casa-scadenze`); `LEZIONI.md` vieta l'interfaccia nativa del browser per le date. Questo componente ne prende il posto con lo **stesso aspetto chiuso** del campo del mockup e un calendario costruito con i pezzi di `.periodo` e `.griglia-mese`. Solo token esistenti.

- **Chiuso:** identico a `.campo` (`TextField`): etichetta sopra (es. «Giorno»), riquadro `.campo__input` 52 px, a destra l'icona `calendar` 16 px in `--color-inchiostro-2` nella stessa posizione del chevron del select. Valore scritto per esteso nel fuso `Europe/Rome`: «Martedì 20 ottobre»; con l'anno solo se diverso dall'anno in corso: «Martedì 20 ottobre 2027». Vuoto: «Scegli il giorno» in `--color-inchiostro-2`. È un `<button type="button">` con `aria-haspopup="dialog"`, nome accessibile = etichetta + valore («Giorno, martedì 20 ottobre»). Errore e disabilitato come `.campo`.
- **Aperto su mobile e tablet:** un `Sheet` normale con titolo = etichetta del campo e X «Chiudi». Contenuto, dall'alto:
  1. riga del mese (`.periodo`): «Ottobre 2026» in `.t-titolo-scheda` a sinistra; a destra due `IconButton small` con `chevron-left` «Mese precedente» e `chevron-right` «Mese successivo», distanti `--space-2`;
  2. intestazione dei giorni come `.griglia-mese__intestazione`: L M M G V S D (settimana da lunedì), centrate, `aria-hidden` (il nome completo è sul giorno);
  3. sette colonne di giorni, celle alte `--size-tocco`, numero in Parkinsans 300 `--text-cella-size`/`--text-cella-line`, cifre tabellari, dentro un cerchio di `--size-controllo`. I giorni fuori dal mese non si mostrano (celle vuote).
  4. in fondo, a sinistra, `Button link` «Oggi» (sceglie oggi e chiude).
- **Aperto da 1024 px:** pannello sotto il campo (non modale, senza velo), largo `--size-pannello-desktop`, fondo `--color-superficie`, raggio `--radius-l`, filo interno `--border-sottile` `--color-filo`, ombra `--shadow-barra`, padding `--space-4`, distanza dal campo `--space-2`, `z-index: var(--z-foglio)`. Stesso contenuto; celle alte `--size-controllo`.
- **Stati dei giorni:** normale (testo `--color-inchiostro`); sabato e domenica `--color-inchiostro-2`, come nella griglia del mese; **oggi** = cerchio con anello `inset 0 0 0 var(--border-medio) var(--color-inchiostro)`; **scelto** = cerchio pieno `--color-inchiostro` con numero `--color-latte`; passaggio del mouse = cerchio `--color-carta`; non disponibile (prima di una data minima, se il modulo la prevede) = `--opacity-disabilitato`, `aria-disabled="true"`; focus = anello `--color-info`.
- **Comportamento:** si apre sul mese del valore (o del giorno di oggi). Toccare un giorno lo sceglie e chiude subito: niente bottone «Conferma». Esc, X, velo o clic fuori chiudono senza cambiare. Il focus torna al campo.
- **Tastiera (schema WAI-ARIA «date picker dialog»):** il calendario è `role="grid"` con `aria-label` = mese e anno; frecce = giorno prima/dopo e settimana prima/dopo; Pagina su/giù = mese; Inizio/Fine = lunedì/domenica della settimana; Invio o Spazio = sceglie. Ogni giorno è un `<button>` con nome completo («martedì 20 ottobre 2026»), `aria-pressed="true"` per il giorno scelto, `aria-current="date"` per oggi. Il cambio di mese viene annunciato (`aria-live="polite"` sul titolo del mese).
- **Date:** si salvano in UTC e si mostrano nel fuso `Europe/Rome` con le funzioni centralizzate di `src/lib/` (`LEZIONI.md`).

### `TimeField` — Campo dell'ora (nuovo)

Il mockup usa `<input type="time">` accanto alla data (`.campo-doppio`: «Giorno» | «Dalle»). Per non dipendere dall'interfaccia del browser (12/24 ore, ruote diverse per sistema):

- Aspetto identico a `.campo` / `.campo__input`, icona `clock` 16 px a destra come il chevron del select; `inputmode="numeric"`, `autocomplete="off"`; valore sempre a 24 ore «17:00».
- Mentre si scrive si accettano cifre, «.» «,» «:»; all'uscita dal campo si normalizza: «17» → «17:00», «930» → «09:30», «17.30» / «17,30» / «1730» → «17:30».
- Valore non valido (ore oltre 23, minuti oltre 59, lettere): all'invio `.campo--errore` con «Scrivi l'ora come 17:30.».
- Vuoto: segnaposto «17:00» in `--color-inchiostro-2` solo come esempio; l'etichetta resta sempre visibile sopra.

### Componenti di una sola pagina o di layout (non in #8)

Si creano con la pagina o con la fondamenta «layout e navigazione» che li usa, con una issue `richiesta-condivisa` se finiscono in `src/components/ui/`: `.barra`, `.quadrato-nest`, `.nav-basso`, `.btn-aggiungi`, `.nav-alto`, `.menu-laterale`, `.lente`, `.periodo`, `.tacche-passi`, intestazioni e sezioni (`.pagina`, `.pagina-desktop`, `.colonne`, `.intestazione`, `.sezione`), `.prossimo`, `.contatore`, `.scheda-modulo`, `.puntina`, `.porta`, `.sintesi`, righe dedicate (`.riga-evento`, `.riga-scadenza`, `.riga-notifica`, `.riga-regalo`), `.strappo`, `.campo-frase`, `.campo-rapido`, `.campo-ricerca`, `.palette`, `.kbd`, `.scelta`, `.scelta-colore`, `.tondo-spunta`, `.logo-marchio`, i componenti del calendario (`.striscia-giorni`, `.griglia-mese`, `.giorno-persone`, `.blocco-orario`, `.griglia-settimana`) e quelli dell'onboarding. Le loro misure restano quelle di `components.css`.

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
- Niente punti esclamativi, emoji, parole inglesi quando c'è quella italiana, parole tecniche («API», «token», «sync failed»). Virgolette basse «» per i titoli citati. Ore a 24 ore con i due punti: «17:30».
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
| Pagina non trovata         | «Questo impegno non c'è più» · «Forse l'ha eliminato chi l'aveva creato.»                               | «404 Not Found»                       |
| Visibilità                 | «Gli altri vedono solo che sei occupato.»                                                               | «Privacy impostata su: Busy»          |
| Spesa                      | «Strappa qui: togli i presi»                                                                            | «Elimina elementi completati»         |

### Testi standard dei componenti di base

Da usare quando la pagina non ne indica di più specifici.

| Dove                                      | Testo                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Testo nascosto durante il caricamento     | «Caricamento in corso»                                                                                      |
| Bottone in caricamento                    | stesso testo del bottone se resta chiaro; per l'accesso il mockup usa «Accesso con Google in corso»         |
| X di fogli e modali                       | `aria-label` «Chiudi»                                                                                       |
| Freccia indietro                          | `aria-label` «Indietro»                                                                                     |
| Azione del toast                          | «Annulla»                                                                                                   |
| Secondo bottone del dialogo               | «Annulla»                                                                                                   |
| Errore di una parte                       | «Non riusciamo a caricare <cosa>. Controlla la connessione e riprova.» + «Riprova»                          |
| Errore di tutta la pagina — titolo        | «Questa pagina non si è caricata»                                                                           |
| Errore di tutta la pagina — testo         | «Controlla la connessione e riprova. Se il problema resta, torna a Oggi.» + «Riprova» e link «Torna a Oggi» |
| Pagina inesistente — titolo e testo       | «Questa pagina non c'è» · «Il link potrebbe essere vecchio o scritto male.» + «Torna a Oggi»                |
| Salvataggio non riuscito (toast o avviso) | «Non siamo riusciti a salvare. Controlla la connessione e riprova.» + «Riprova»                             |
| `DatePicker` vuoto                        | «Scegli il giorno»                                                                                          |
| `DatePicker` frecce                       | «Mese precedente» · «Mese successivo»                                                                       |
| `DatePicker` scorciatoia                  | «Oggi»                                                                                                      |
| `TimeField` errore                        | «Scrivi l'ora come 17:30.»                                                                                  |

## Cosa non fare

- Valori scritti a mano, Tailwind, librerie di componenti, stile in linea.
- Ombre sulle schede: si staccano dal fondo con il bianco e il filo interno di 1 px. Ombre solo per barre, fogli, modali, adesivi e il pannello del `DatePicker`.
- Rosso per dire «tra poco»; `--color-inchiostro-3` per il testo; colore delle persone fuori dagli avatar.
- Hamburger (il Nest si apre dal quadrato colorato), righello del tempo in cima a Oggi, selettore Oggi/Domani/Weekend in Oggi.
- Bottoni dentro altri bottoni o link.
- Testi segnaposto («Lorem ipsum», «Titolo qui»), parole tecniche, punti esclamativi, emoji.
- Interfaccia nativa del browser per date e ore: si usano `DatePicker` e `TimeField`.
- Spinner a pagina intera.

## Registro delle modifiche

| Data       | Modifica                                                                                                                                                                                                                 | Issue |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 22/10/2026 | Prima versione dal mockup v1.0: 202 token, font con `next/font`, stati di passaggio e premuto, focus su fondo scuro, componenti di base con nomi React, `DatePicker` e `TimeField` nuovi, tono di voce e testi standard. | #8    |
