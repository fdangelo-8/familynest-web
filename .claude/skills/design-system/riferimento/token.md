# Design system · token

> Parte di consultazione della skill `design-system` (`../SKILL.md`): tutti i valori. Le regole sempre valide sono nella skill.

> **Dal 25/11/2026 (F2, #196):** sono i valori del design per telefono di Fable (`telefono.md`, colonna «Nuovo valore»), nel codice con la PR #585. I valori del vecchio mockup restano in `docs/mockup/tokens.css` (archivio) e, riga per riga, nella colonna «Attuale nel codice» di `telefono.md`.

Tutti i valori del `:root` di `src/app/globals.css`, uguale a `docs/agenti/design/token.css` (lo confronta il test dei token: si cambiano insieme). Nome variabile → valore → uso. Gli esadecimali qui sono in maiuscolo; nel CSS Prettier li scrive in minuscolo e mette lo zero prima dei decimali: il valore è lo stesso. Dalla #313 dimensioni e interlinee del testo sono in rem (stesso valore a 16 px), vedi «Scala tipografica».

### Colori: base

| Variabile                    | Valore                  | Uso                                                                            |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `--color-carta`              | `#FFFFFF`               | sfondo delle pagine: le pagine sono bianche                                    |
| `--color-carta-2`            | `#F4F6F4`               | fondi quieti: avvisi, pulsante quieto, scheletri, segnaposto delle foto        |
| `--color-superficie`         | `#FFFFFF`               | fogli, campi, dischi sopra le foto                                             |
| `--color-fondo-app`          | `#F5F6F4`               | fondo sotto Oggi e dietro la barra                                             |
| `--color-premuto`            | `#ECEFEC`               | riga premuta, da bordo a bordo                                                 |
| `--color-scelta-tenue`       | `#E2E9E5`               | voce scelta del selettore a segmenti, scheda di scelta premuta                 |
| `--color-anello-scelta`      | `#B5CBCB`               | anello decorativo attorno a una scelta (mai unico segno: c'è sempre la spunta) |
| `--color-inchiostro`         | `#10262A`               | testo principale, interruttore acceso, scelte piene                            |
| `--color-inchiostro-2`       | `#55686C`               | testo secondario sulle pagine bianche                                          |
| `--color-inchiostro-2-fondo` | `#4A5F63`               | testo secondario su `--color-fondo-app`                                        |
| `--color-inchiostro-3`       | `#8A989A`               | solo segni non testuali (freccia sottile, segnaposto): 2,98:1, mai testo       |
| `--color-azione`             | `#0F3D44`               | pulsante primario, voce scelta della barra                                     |
| `--color-azione-premuto`     | `#0A2D33`               | primario premuto e al passaggio del mouse                                      |
| `--color-filo`               | `#E4E8E5`               | divisori delle righe a filo                                                    |
| `--color-filo-2`             | `#C3CCC9`               | bordo di tessere e schede di scelta a riposo, cerchio tratteggiato «Aggiungi»  |
| `--color-filo-tenue`         | `#AEB9B7`               | solo decorazione (2,01:1), mai unico bordo di un campo                         |
| `--color-filo-barra`         | `rgba(16, 38, 42, 0.1)` | filo sopra la barra in basso e sopra il piede dei fogli                        |
| `--color-filo-campo`         | `#7F9092`               | bordo del campo a riposo: 3,33:1 sul bianco (#52, «Da chiarire» 1)             |
| `--color-corsia-vuota`       | `#EEF1EF`               | barra vuota delle corsie del calendario (misurato, A4)                         |
| `--color-notte`              | `#1B1A17`               | blocchi scuri: porte, piano, onboarding                                        |
| `--color-notte-2`            | `#2A2925`               | elementi sopra notte                                                           |
| `--color-latte`              | `#F4F2EC`               | testo e superfici chiare su inchiostro e notte                                 |
| `--color-latte-2`            | `#B9B5AC`               | testo secondario su notte                                                      |

### Colori: Liberi insieme

| Variabile               | Valore    | Uso   |
| ----------------------- | --------- | ----- |
| `--color-insieme`       | `#FBEAAB` | fondo |
| `--color-insieme-bordo` | `#E0BE52` | bordo |
| `--color-insieme-testo` | `#4A3906` | testo |

### Colori: adesso

| Variabile              | Valore    | Uso                                                            |
| ---------------------- | --------- | -------------------------------------------------------------- |
| `--color-adesso`       | `#F6C945` | «adesso»: il giallo vuol dire solo questo; testo in inchiostro |
| `--color-adesso-tinta` | `#FCEFC0` | fondo tenue dell'«adesso»                                      |

### Colori: impegni «Occupato» (righe grigie)

| Variabile            | Valore    | Uso |
| -------------------- | --------- | --- |
| `--color-occupato-1` | `#ECEDE7` |     |
| `--color-occupato-2` | `#E4E5DE` |     |

### Colori: stato

| Variabile               | Valore    | Uso                                                              |
| ----------------------- | --------- | ---------------------------------------------------------------- |
| `--color-ok`            | `#1B6B45` | fatto, collegato                                                 |
| `--color-avviso`        | `#A15C07` |                                                                  |
| `--color-allerta`       | `#B3261E` | errori, rosso pieno del dialogo di conferma, link «Elimina»      |
| `--color-allerta-fondo` | `#FCEEEA` | fondo dell'avviso d'errore e del campo sbagliato                 |
| `--color-scaduto`       | `#A8321F` | scadenza passata                                                 |
| `--color-allerta-scuro` | `#A82A27` | passaggio e premuto di `.btn-pericolo-pieno` (**aggiunto**, #52) |
| `--color-info`          | `#3355CC` | anello di focus («Da chiarire» 4: resta)                         |
| `--color-bianco`        | `#FFFFFF` | testo su azione, rosso pieno, blu e ardesia                      |

### Colori: persone e animali

Dove vivono: pallino con l'iniziale, punti del mese, adesivi, filo attorno alla foto, barre delle corsie, e la tinta nel fondo del pallino non scelto. Mai su testi, schede o fondi di pagina.

**Codici e tinte.** I dieci codici dell'enum `member_color` del database (`pomodoro`, `glicine`, `salvia`, `cobalto`, `zafferano`, `lampone`, `ceruleo`, `peonia`, `basilico`, `cannella`, in quest'ordine) non cambiano e non si migra nulla. Quale tinta mostra ogni codice lo dice solo `src/lib/member-colors.ts` (`MEMBER_COLOR_CODES`, `MEMBER_COLOR_SHADES`, `memberColorClass()`, `memberColorLabel()`); nessun altro file riscrive la corrispondenza, e le pagine non scrivono mai i nomi delle tinte. `Avatar` e `ColorChoice` leggono da lì; `MEMBER_COLORS`, `MemberColor` e `memberColorLabel` restano esportati con lo stesso nome. I nomi accessibili (le tinte, con l'iniziale maiuscola) sono in `src/lib/i18n/messages/it.ts` (`memberColors`).

Ogni tinta ha tre token: `--color-membro-<tinta>` (pieno), `-tinta` (fondo tenue), `-corsia` (barra delle corsie).

| Codice (database)    | Tinta    | Pieno     | `-tinta`                | `-corsia`            | Iniziale (`--c-iniziale`) | Contrasto iniziale | Nome accessibile |
| -------------------- | -------- | --------- | ----------------------- | -------------------- | ------------------------- | ------------------ | ---------------- |
| `pomodoro`           | corallo  | `#F2765C` | `#FDEAE5`               | `#EF5839`            | inchiostro                | 5,64:1             | Corallo          |
| `glicine`            | glicine  | `#B9A2EC` | `#F2ECFC`               | `#9978E3`            | inchiostro                | 7,08:1             | Glicine          |
| `salvia`             | menta    | `#8FD0A8` | `#E7F5EC`               | `#419A63`            | inchiostro                | 8,82:1             | Menta            |
| `cobalto`            | blu      | `#3F6FE0` | `#E5ECFC`               | `#3F6FE0` (il pieno) | **bianco**                | 4,60:1             | Blu              |
| `zafferano`          | ambra    | `#E8A15C` | `#FCEEDD`               | `#CE741D`            | inchiostro                | 7,27:1             | Ambra            |
| `lampone`            | sabbia   | `#D9B88F` | manca: tinta del neutro | `#B5803D`            | inchiostro                | 8,41:1             | Sabbia           |
| `ceruleo`            | azzurro  | `#7CC7E0` | manca: tinta del neutro | `#2C95B8`            | inchiostro                | 8,33:1             | Azzurro          |
| `peonia`             | rosa     | `#F0A3C0` | manca: tinta del neutro | `#E4588D`            | inchiostro                | 8,03:1             | Rosa             |
| `basilico`           | ardesia  | `#68778D` | manca: tinta del neutro | `#68778D` (il pieno) | **bianco**                | 4,55:1             | Ardesia          |
| `cannella`           | cannella | `#AF8273` | `#F5ECE8`               | `#AD7F70`            | inchiostro                | 4,70:1             | Cannella         |
| — (solo interfaccia) | neutro   | `#B4BFBC` | `#F1F4F2`               | `#7C8F8A`            | inchiostro                | 8,34:1             | —                |

- **Ardesia `#68778D`:** decisione di Francesco del 25/11/2026, al posto di `#6B7A90` di Fable (con il bianco solo 4,36:1). Con `#68778D` l'iniziale bianca arriva a 4,55:1 a ogni misura del pallino.
- **Tinte che mancano** (sabbia, azzurro, rosa, ardesia): Fable non le ha date e non si inventano. Non esistono i token `-tinta` di questi quattro: le loro classi usano `--color-membro-neutro-tinta`.
- **Neutro:** per chi non ha un colore (per esempio un ex componente). Esiste solo nell'interfaccia, non è un codice del database.
- **Corsie** (decisione di Francesco del 25/11/2026, verificata dal designer il 25/11): stessa tonalità e saturazione del pieno (HSL), luminosità abbassata a passi di 0,5% finché il contrasto è almeno 3:1 sia sul bianco sia su `--color-corsia-vuota` (il più scuro dei fondi delle corsie, quindi vale anche su `--color-carta-2`). Se il pieno arriva già a 3:1 (blu, ardesia), la corsia è il pieno. Risultati: da 3,00:1 a 3,06:1 su `--color-corsia-vuota`, da 3,14:1 a 3,21:1 su `--color-carta-2`, da 3,41:1 a 3,48:1 sul bianco; tonalità spostata al massimo di 0,57 gradi (neutro). Chi cambia una corsia la tiene sopra 3:1 (CA-22 della #196).
- Il giallo non è più un colore di persona: vuol dire «adesso». Con la stessa iniziale chi arriva dopo prende due lettere («Mi» per Miele; domanda 178 aperta per il telefono). Il colore non è mai l'unica informazione: c'è sempre l'iniziale o il nome.
- Spariti con F2: `--color-membro-pomodoro`, `-salvia`, `-cobalto`, `-zafferano`, `-lampone`, `-ceruleo`, `-peonia`, `-basilico` (i token, non i codici). `--color-membro-glicine` e `--color-membro-cannella` restano con il valore nuovo.

**Classi** in `src/app/components.css`: una `.membro-<codice>` per ognuno dei dieci codici, più `.membro-neutro` e `.membro-insieme`. Ognuna imposta:

| Variabile      | Valore                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--c`          | `--color-membro-<tinta>`; per `.membro-insieme` `--color-insieme`                                                               |
| `--c-tinta`    | `--color-membro-<tinta>-tinta`; per lampone, ceruleo, peonia e basilico `--color-membro-neutro-tinta`; non in `.membro-insieme` |
| `--c-corsia`   | `--color-membro-<tinta>-corsia`; non in `.membro-insieme` (la corsia «Liberi insieme» la decide A4)                             |
| `--c-iniziale` | `--color-bianco` per cobalto e basilico, `--color-inchiostro` per gli altri e per `.membro-insieme`                             |

`.avatar` scrive l'iniziale con `color: var(--c-iniziale, var(--color-inchiostro))`: un avatar senza classe `.membro-*` resta in inchiostro.

### Colori: marchi dei calendari esterni (solo nei loghi)

| Variabile                 | Valore    | Uso |
| ------------------------- | --------- | --- |
| `--color-marchio-outlook` | `#0F6CBD` |     |
| `--color-marchio-google`  | `#188038` |     |
| `--color-marchio-icloud`  | `#1C1C1E` |     |

### Colori: trasparenze

| Variabile                  | Valore                  | Uso                          |
| -------------------------- | ----------------------- | ---------------------------- |
| `--color-velo`             | `rgba(23,24,28,.30)`    | sotto fogli e modali         |
| `--color-ombra`            | `rgba(16,38,42,.12)`    | base delle ombre             |
| `--color-ombra-forte`      | `rgba(16,38,42,.20)`    | ombre di fogli, menu, dischi |
| `--color-ombra-adesivo`    | `rgba(0,0,0,.25)`       |                              |
| `--color-avatar-su-colore` | `rgba(255,255,255,.55)` | cerchio dentro gli adesivi   |

### Colori: scena di Oggi

Cielo, case e sole della cima di Oggi; lo splash dissolve verso il cielo dell'ora. Il passaggio `#0F3D44` → `#2F8F99` del segnaposto del marchio sta solo dentro il componente del nome: non è un gradiente da usare altrove.

| Variabile                         | Valore    |
| --------------------------------- | --------- |
| `--color-scena-mattino-cielo`     | `#BFE3F7` |
| `--color-scena-mattino-casa-1`    | `#7DBFC2` |
| `--color-scena-mattino-casa-2`    | `#4E9DA6` |
| `--color-scena-mattino-sole`      | `#FFB84D` |
| `--color-scena-pomeriggio-cielo`  | `#7FC4F2` |
| `--color-scena-pomeriggio-casa-1` | `#57B0B5` |
| `--color-scena-pomeriggio-casa-2` | `#2F8F99` |
| `--color-scena-pomeriggio-sole`   | `#FFF1A8` |
| `--color-scena-sera-cielo`        | `#35539E` |
| `--color-scena-sera-casa-1`       | `#2A7F80` |
| `--color-scena-sera-casa-2`       | `#0C4A52` |
| `--color-scena-sera-sole`         | `#FF9E3C` |
| `--color-scena-tetto`             | `#0F3D44` |

### Font

Un solo font, Figtree, da `next/font/google` (caricamento in `../SKILL.md`, «Caricamento dei font»).

| Variabile          | Valore                                                      | Uso                                             |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| `--font-titoli`    | `var(--font-figtree), ui-sans-serif, system-ui, sans-serif` | titoli, ore, numeri, frasi                      |
| `--font-testo`     | uguale a `--font-titoli`                                    | tutto il resto                                  |
| `--font-codice`    | `ui-monospace,"SF Mono",Menlo,monospace`                    | solo nella documentazione                       |
| `--weight-sottile` | `400`                                                       | `.t-display`, `.t-frase`, `.t-numero` (era 300) |
| `--weight-normale` | `400`                                                       |                                                 |
| `--weight-medio`   | `400`                                                       | `.t-nota`: aiuto ed errore del campo (era 500)  |
| `--weight-semi`    | `600`                                                       |                                                 |
| `--weight-forte`   | `600`                                                       | righe e titoli di riga (era 650)                |
| `--weight-pieno`   | `700`                                                       | titoli di pagina e di sezione                   |

### Scala tipografica (mobile; *-desktop dove cambia)

Dalla #313 (testo ingrandito, WCAG 1.4.4) dimensioni e interlinee sono in **rem**: px diviso 16. Con la radice a 16 px (impostazione normale) il valore in px è quello del design; con il carattere di sistema o del browser più grande, il testo cresce. Le interlinee sono in rem e non senza unità: senza unità i figli erediterebbero il rapporto e al 100% la geometria cambierebbe (una riga da 22 px diventerebbe 17,6 px). Il tracking resta in `em`. Le iniziali degli avatar (`--text-avatar-*`) restano in px: il cerchio ha una misura fissa e il nome c'è sempre come testo o nome accessibile. Con F2 cambiano titolo di pagina, controllo e tracking dell'etichetta, e nascono titolo di sezione, sottotitolo, titolo della barra ed etichetta piccola; gli altri valori sono quelli del vecchio mockup, perché Fable non ha dato la scala del corpo né i testi grandi di Oggi.

| Variabile                           | Valore      | px a 16 | Uso                                       |
| ----------------------------------- | ----------- | ------- | ----------------------------------------- |
| `--text-display-size`               | `2.75rem`   | 44      |                                           |
| `--text-display-line`               | `3rem`      | 48      |                                           |
| `--text-display-tracking`           | `-.04em`    | —       |                                           |
| `--text-display-desktop-size`       | `3.5rem`    | 56      |                                           |
| `--text-display-desktop-line`       | `3.75rem`   | 60      |                                           |
| `--text-ora-xl-size`                | `4rem`      | 64      |                                           |
| `--text-ora-xl-line`                | `3.5rem`    | 56      |                                           |
| `--text-ora-xl-tracking`            | `-.04em`    | —       |                                           |
| `--text-ora-l-size`                 | `3.25rem`   | 52      |                                           |
| `--text-ora-l-line`                 | `3rem`      | 48      |                                           |
| `--text-ora-l-tracking`             | `-.04em`    | —       |                                           |
| `--text-numero-size`                | `2.75rem`   | 44      |                                           |
| `--text-numero-line`                | `3rem`      | 48      |                                           |
| `--text-numero-tracking`            | `-.04em`    | —       |                                           |
| `--text-titolo-pagina-size`         | `1.875rem`  | 30      | titolo di pagina, 700                     |
| `--text-titolo-pagina-line`         | `2.25rem`   | 36      |                                           |
| `--text-titolo-pagina-tracking`     | `-.02em`    | —       |                                           |
| `--text-titolo-pagina-desktop-size` | `2.5rem`    | 40      |                                           |
| `--text-titolo-pagina-desktop-line` | `2.75rem`   | 44      |                                           |
| `--text-titolo-sezione-size`        | `1.3125rem` | 21      | titolo di sezione, 700                    |
| `--text-titolo-sezione-line`        | `1.6875rem` | 27      |                                           |
| `--text-titolo-sezione-tracking`    | `-.012em`   | —       |                                           |
| `--text-sottotitolo-size`           | `1.0625rem` | 17      | sottotitolo, 400, secondario              |
| `--text-sottotitolo-line`           | `1.5625rem` | 25      |                                           |
| `--text-titolo-barra-size`          | `1rem`      | 16      | titolo della barra e dei fogli, 700       |
| `--text-titolo-barra-line`          | `1.375rem`  | 22      |                                           |
| `--text-tag-size`                   | `0.75rem`   | 12      | etichetta piccola, 600, alta 24, raggio 6 |
| `--text-tag-line`                   | `1rem`      | 16      |                                           |
| `--text-titolo-scheda-size`         | `1.375rem`  | 22      |                                           |
| `--text-titolo-scheda-line`         | `1.625rem`  | 26      |                                           |
| `--text-titolo-scheda-tracking`     | `-.02em`    | —       |                                           |
| `--text-frase-size`                 | `1.375rem`  | 22      |                                           |
| `--text-frase-line`                 | `1.875rem`  | 30      |                                           |
| `--text-frase-tracking`             | `-.015em`   | —       |                                           |
| `--text-sezione-size`               | `0.9375rem` | 15      |                                           |
| `--text-sezione-line`               | `1.5rem`    | 24      |                                           |
| `--text-corpo-forte-size`           | `0.9375rem` | 15      |                                           |
| `--text-corpo-forte-line`           | `1.25rem`   | 20      |                                           |
| `--text-corpo-size`                 | `0.9375rem` | 15      |                                           |
| `--text-corpo-line`                 | `1.375rem`  | 22      |                                           |
| `--text-ora-riga-size`              | `0.9375rem` | 15      |                                           |
| `--text-ora-riga-line`              | `1.25rem`   | 20      |                                           |
| `--text-ora-riga-tracking`          | `-.01em`    | —       |                                           |
| `--text-nota-size`                  | `0.8125rem` | 13      |                                           |
| `--text-nota-line`                  | `1.125rem`  | 18      |                                           |
| `--text-etichetta-size`             | `0.75rem`   | 12      |                                           |
| `--text-etichetta-line`             | `1rem`      | 16      |                                           |
| `--text-etichetta-tracking`         | `0`         | —       | etichetta dentro il campo, 400            |
| `--text-micro-size`                 | `0.6875rem` | 11      |                                           |
| `--text-micro-line`                 | `0.875rem`  | 14      |                                           |
| `--text-controllo-size`             | `1rem`      | 16      | testo di pulsanti, link, selettori, 600   |
| `--text-controllo-line`             | `1.375rem`  | 22      | testo di pulsanti, link, selettori        |
| `--text-numero-m-size`              | `2.25rem`   | 36      | giorni alle scadenze                      |
| `--text-numero-m-line`              | `2.25rem`   | 36      | giorni alle scadenze                      |
| `--text-numero-s-size`              | `1.875rem`  | 30      | contatori piccoli                         |
| `--text-numero-s-line`              | `2.125rem`  | 34      | contatori piccoli                         |
| `--text-cella-size`                 | `1.125rem`  | 18      | numeri del mese e della striscia          |
| `--text-cella-line`                 | `1.625rem`  | 26      | numeri del mese e della striscia          |
| `--text-avatar-xs-size`             | `8px`       | 8       | resta in px (#313)                        |
| `--text-avatar-s-size`              | `10px`      | 10      | resta in px (#313)                        |
| `--text-avatar-m-size`              | `13px`      | 13      | resta in px (#313)                        |
| `--text-avatar-l-size`              | `18px`      | 18      | resta in px (#313)                        |
| `--text-avatar-xl-size`             | `30px`      | 30      | resta in px (#313)                        |
| `--tracking-codice`                 | `.12em`     | —       |                                           |
| `--tracking-maiuscolo`              | `.08em`     | —       |                                           |

### Punti di rottura (riferimento: le media query non leggono le variabili)

| Variabile                  | Valore   | Uso |
| -------------------------- | -------- | --- |
| `--breakpoint-mobile-max`  | `767px`  |     |
| `--breakpoint-desktop-min` | `1024px` |     |

### Spaziature

| Variabile      | Valore | Uso                                                                        |
| -------------- | ------ | -------------------------------------------------------------------------- |
| `--space-0`    | `0`    |                                                                            |
| `--space-half` | `2px`  |                                                                            |
| `--space-1`    | `4px`  |                                                                            |
| `--space-2`    | `8px`  |                                                                            |
| `--space-3`    | `12px` |                                                                            |
| `--space-4`    | `16px` |                                                                            |
| `--space-5`    | `20px` |                                                                            |
| `--space-6`    | `24px` |                                                                            |
| `--space-8`    | `32px` |                                                                            |
| `--space-10`   | `40px` |                                                                            |
| `--space-12`   | `48px` |                                                                            |
| `--space-16`   | `64px` |                                                                            |
| `--space-riga` | `13px` | spazio sopra e sotto il testo delle righe (fuori griglia, come nel design) |
| `--space-link` | `3px`  | distanza della sottolineatura dei collegamenti (`text-underline-offset`)   |

### Griglia

| Variabile                | Valore   | Uso                                           |
| ------------------------ | -------- | --------------------------------------------- |
| `--grid-margine-mobile`  | `24px`   | margine di pagina sul telefono (era 20)       |
| `--grid-margine-desktop` | `40px`   |                                               |
| `--grid-colonne-desktop` | `12`     | griglia di riferimento per le colonne desktop |
| `--grid-gutter`          | `24px`   |                                               |
| `--grid-contenuto-max`   | `1200px` |                                               |
| `--grid-colonna-stretta` | `720px`  | pagine di impostazioni e dettaglio su desktop |

### Raggi

| Variabile           | Valore  | Uso                                        |
| ------------------- | ------- | ------------------------------------------ |
| `--radius-xs`       | `6px`   | etichette piccole, kbd, etichetta fonte    |
| `--radius-s`        | `8px`   | etichette, chip, voce attiva dei selettori |
| `--radius-m`        | `12px`  | campi, tessere piccole, selettori          |
| `--radius-l`        | `16px`  | tessere, schede di scelta                  |
| `--radius-xl`       | `20px`  | fogli e modali (era 24)                    |
| `--radius-pulsante` | `14px`  | pulsanti                                   |
| `--radius-capsula`  | `28px`  | pastiglie, pillole                         |
| `--radius-tondo`    | `999px` | avatar, interruttori, pallini              |

### Bordi

| Variabile           | Valore  | Uso                                                           |
| ------------------- | ------- | ------------------------------------------------------------- |
| `--border-sottile`  | `1px`   |                                                               |
| `--border-medio`    | `1.5px` |                                                               |
| `--border-evidenza` | `3px`   | filo nero in cima alla scheda in evidenza                     |
| `--border-link`     | `1.5px` | sottolineatura dei collegamenti (`text-decoration-thickness`) |

### Ombre ed elevazione

Pagine ed elenchi senza ombre. L'ombra «card» del canvas di Fable (`0 1px 2px, 0 6px 14px -4px`) è dei giri precedenti e non si usa.

| Variabile            | Valore                                                                   | Uso                               |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `--shadow-nessuna`   | `none`                                                                   |                                   |
| `--shadow-scheda`    | `0 1px 2px var(--color-ombra)`                                           |                                   |
| `--shadow-barra`     | `0 8px 24px var(--color-ombra)`                                          |                                   |
| `--shadow-foglio`    | `0 -4px 16px -2px var(--color-ombra-forte)`                              | fogli (era `0 -8px 32px`)         |
| `--shadow-menu`      | `0 1px 2px var(--color-ombra), 0 8px 20px -6px var(--color-ombra-forte)` | menu                              |
| `--shadow-disco`     | `0 2px 6px -1px var(--color-ombra-forte)`                                | dischi bianchi sopra foto e scene |
| `--shadow-controllo` | `0 1px 3px var(--color-ombra)`                                           | controlli                         |
| `--shadow-modale`    | `0 30px 80px var(--color-ombra-forte)`                                   |                                   |
| `--shadow-adesivo`   | `0 10px 24px var(--color-ombra-adesivo)`                                 |                                   |

### Misure

| Variabile                      | Valore   | Uso                                                                             |
| ------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `--size-tocco`                 | `44px`   | area minima di tocco                                                            |
| `--size-controllo`             | `40px`   | bottoni icona, selettori, chip grandi                                           |
| `--size-azione`                | `52px`   | pulsanti principali; campi del vecchio mockup (quelli 2.0 usano `--size-campo`) |
| `--size-riga`                  | `56px`   | righe di lista                                                                  |
| `--size-riga-alta`             | `64px`   | righe evento, righe con due testi                                               |
| `--size-campo`                 | `56px`   | `min-height` dei campi                                                          |
| `--size-barra`                 | `64px`   | barra di navigazione mobile, bottone Aggiungi (resta fino a F5)                 |
| `--size-barra-alta`            | `56px`   | barra in basso del design 2.0, più 8 px sopra                                   |
| `--size-nav-desktop`           | `72px`   | barra di navigazione desktop                                                    |
| `--size-etichetta`             | `24px`   | etichette piccole e chip piccoli (era 28)                                       |
| `--size-chip`                  | `36px`   | chip filtro                                                                     |
| `--size-interruttore-l`        | `44px`   |                                                                                 |
| `--size-interruttore-a`        | `26px`   |                                                                                 |
| `--size-interruttore-pallino`  | `20px`   |                                                                                 |
| `--size-casella`               | `22px`   | checkbox e radio                                                                |
| `--size-icona-s`               | `16px`   |                                                                                 |
| `--size-icona-m`               | `20px`   |                                                                                 |
| `--size-icona-l`               | `24px`   |                                                                                 |
| `--size-avatar-xs`             | `18px`   |                                                                                 |
| `--size-avatar-s`              | `24px`   |                                                                                 |
| `--size-avatar-m`              | `32px`   |                                                                                 |
| `--size-avatar-l`              | `44px`   |                                                                                 |
| `--size-avatar-xl`             | `72px`   |                                                                                 |
| `--size-quadrato-nest`         | `40px`   |                                                                                 |
| `--size-colonna-ora`           | `48px`   | colonna dell'orario nelle righe                                                 |
| `--size-colonna-giorni`        | `72px`   | colonna dei giorni nelle scadenze                                               |
| `--size-cta-aggiungi`          | `128px`  | larghezza del bottone Aggiungi in basso                                         |
| `--size-pannello-desktop`      | `320px`  |                                                                                 |
| `--size-menu-desktop`          | `280px`  |                                                                                 |
| `--size-modale`                | `880px`  |                                                                                 |
| `--size-dialogo`               | `400px`  |                                                                                 |
| `--size-maniglia-l`            | `40px`   |                                                                                 |
| `--size-maniglia-a`            | `4px`    |                                                                                 |
| `--size-adesivo`               | `56px`   |                                                                                 |
| `--size-qr`                    | `168px`  |                                                                                 |
| `--size-foto`                  | `64px`   |                                                                                 |
| `--size-foto-scheda`           | `160px`  |                                                                                 |
| `--size-ora-calendario`        | `50px`   | altezza di un'ora nella vista Giorno mobile                                     |
| `--size-ora-desktop`           | `40px`   | altezza di un'ora nella griglia settimana desktop                               |
| `--size-cella-mese`            | `48px`   |                                                                                 |
| `--size-pallino`               | `6px`    |                                                                                 |
| `--size-pallino-urgente`       | `8px`    |                                                                                 |
| `--size-tacca`                 | `4px`    |                                                                                 |
| `--size-bottone-s`             | `32px`   | puntina, chiudi nei fogli                                                       |
| `--size-bottone-icona`         | `36px`   | quadratino con icona dentro bottoni e campi                                     |
| `--size-scelta`                | `72px`   | schede di scelta, righe scadenza                                                |
| `--size-radio-pieno`           | `7px`    |                                                                                 |
| `--size-contatore`             | `136px`  |                                                                                 |
| `--size-modulo`                | `152px`  |                                                                                 |
| `--size-porta`                 | `120px`  |                                                                                 |
| `--size-palette`               | `680px`  |                                                                                 |
| `--size-colonna-dati`          | `104px`  |                                                                                 |
| `--size-riga-occupato`         | `6px`    | larghezza delle righe diagonali di «Occupato»                                   |
| `--size-punto-membro`          | `9px`    | avatar senza iniziale sotto i giorni del mese                                   |
| `--size-frame-mobile`          | `390px`  |                                                                                 |
| `--size-frame-mobile-altezza`  | `844px`  |                                                                                 |
| `--size-frame-desktop`         | `1280px` |                                                                                 |
| `--size-frame-desktop-altezza` | `800px`  |                                                                                 |

Tutte le misure qui sopra restano in px anche dopo la #313: con il testo grande non crescono (barra, avatar, icone, interruttore, casella restano come nel mockup); a crescere sono il testo e le altezze minime dei controlli che lo contengono (`min-height`, vedi `componenti.md`, «Testo ingrandito»).

### Misure minime che seguono il testo (**aggiunte**, #313)

In rem: con il testo normale valgono i px a destra, con il testo grande crescono e fanno scattare le disposizioni a una colonna. Non sono nel vecchio mockup; dopo F2 il test dei token le trova in `docs/agenti/design/token.css` come tutte le altre.

| Variabile              | Valore   | px a 16 | Uso                                                                      |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `--size-modulo-min`    | `9.5rem` | 152     | colonna minima delle schede di Esplora e di `.griglia-contatori` (a due) |
| `--size-contatore-min` | `6rem`   | 96      | colonna minima di `.griglia-contatori--tre`                              |
| `--size-dati-min`      | `8rem`   | 128     | base di `.prossimo__dati` accanto all'ora (Prossimo, Dettaglio impegno)  |

### Larghezze delle query di contenitore (#313)

Come le media query, non leggono le variabili: si scrivono i numeri, in rem (nella query `rem` è la radice reale, quindi con 16 px non scattano mai alle misure del mockup). Sono le sole ammesse.

| Contenitore (`container-name`) | Su                                                                          | Query             | Cosa cambia                                    |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------- | ---------------------------------------------- |
| `barra`                        | `.nav-basso`                                                                | `(width < 13rem)` | «Aggiungi» diventa il quadrato con il solo «+» |
| `riga`                         | `.riga-lista`, `.riga-regalo`                                               | `(width < 16rem)` | valore, etichetta o azione scendono sotto      |
| `selettore`                    | `.contenitore-selettore` (classe nuova) (Casa, Aggiungi, Calendario mobile) | `(width < 17rem)` | le voci del selettore si impilano              |

### Movimento

| Variabile               | Valore                      | Uso                                                                          |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `--durata-rapida`       | `200ms`                     |                                                                              |
| `--durata-normale`      | `300ms`                     |                                                                              |
| `--durata-ampia`        | `600ms`                     |                                                                              |
| `--curva`               | `cubic-bezier(.32,.72,0,1)` | curva dei Componenti 2.0                                                     |
| `--curva-entrata`       | `cubic-bezier(.22,1,.36,1)` | aperture morbide della cima di Oggi                                          |
| `--curva-scatto`        | `cubic-bezier(.16,1,.3,1)`  | scatti brevi                                                                 |
| `--durata-apertura`     | `420ms`                     | aperture della cima di Oggi                                                  |
| `--durata-barra`        | `520ms`                     | movimento della barra                                                        |
| `--durata-splash-breve` | `1400ms`                    | splash alle riaperture                                                       |
| `--durata-splash-lungo` | `2900ms`                    | splash alla prima apertura del giorno (dopo le 4:00) o dopo un aggiornamento |

Con movimento ridotto valgono le regole di `../SKILL.md` («Movimento»): F2 non ne aggiunge.

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
