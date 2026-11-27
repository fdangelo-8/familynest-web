# Design system · token

> Parte di consultazione della skill `design-system` (`../SKILL.md`): tutti i valori. Le regole sempre valide sono nella skill.

> **Dal 25/11/2026 (F2, #196):** sono i valori del design per telefono di Fable (`telefono.md`, colonna «Nuovo valore»), nel codice con la PR #585. I valori del vecchio mockup restano in `docs/mockup/tokens.css` (archivio) e, riga per riga, nella colonna «Attuale nel codice» di `telefono.md`.

> **Dal 26/11/2026 (D7):** la tavolozza comune dei Passi 12–16, con il valore chiaro e quello scuro di 73 ruoli, la regola del pallino, le tinte delle barrette, la scena della notte e le regole del tema scuro, è in fondo a questo file («Tavolozza comune dei Passi 12–16»). Il tema scuro c'è al lancio. Non è ancora nel codice: dove dice altro rispetto alle tabelle qui sotto, per il lavoro nuovo vale la tavolozza, e i token li cambia una `richiesta-condivisa`.

Tutti i valori del `:root` di `src/app/globals.css`, uguale a `docs/agenti/design/token.css` (lo confronta il test dei token: si cambiano insieme). Nome variabile → valore → uso. Gli esadecimali qui sono in maiuscolo; nel CSS Prettier li scrive in minuscolo e mette lo zero prima dei decimali: il valore è lo stesso. Dalla #313 dimensioni e interlinee del testo sono in rem (stesso valore a 16 px), vedi «Scala tipografica».

### Colori: base

| Variabile                    | Valore                  | Uso                                                                            |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `--color-carta`              | `#FFFFFF`               | sfondo delle pagine: le pagine sono bianche                                    |
| `--color-carta-2`            | `#F4F6F4`               | fondi quieti: avvisi, pulsante quieto, scheletri, segnaposto delle foto        |
| `--color-superficie`         | `#FFFFFF`               | fogli, campi, dischi sopra le foto                                             |
| `--color-fondo-app`          | `#F5F6F4`               | superato (#634): nessun uso                                                    |
| `--color-premuto`            | `#ECEFEC`               | riga premuta, da bordo a bordo                                                 |
| `--color-scelta-tenue`       | `#E2E9E5`               | voce scelta del selettore a segmenti, scheda di scelta premuta                 |
| `--color-anello-scelta`      | `#B5CBCB`               | superato (#634): nessun uso                                                    |
| `--color-inchiostro`         | `#10262A`               | testo principale (i fondi pieni sono `--color-pieno`)                          |
| `--color-inchiostro-2`       | `#55686C`               | testo secondario sulle pagine bianche                                          |
| `--color-inchiostro-2-fondo` | `#4A5F63`               | superato (#634): nessun uso                                                    |
| `--color-inchiostro-3`       | `#8A989A`               | solo segni non testuali (freccia sottile, segnaposto): 2,98:1, mai testo       |
| `--color-pieno`              | `#10262A`               | fondo dei controlli pieni; sopra va `--color-latte` (scuro: `#1F7D8A`)         |
| `--color-azione`             | `#0F3D44`               | passaggio del mouse e premuto dei pieni, voce scelta della barra               |
| `--color-azione-premuto`     | `#0A2D33`               | superato (#634): nessun uso                                                    |
| `--color-fuoco`              | `#0F3D44`               | anello del fuoco da tastiera (scuro: `#F2F7F5`)                                |
| `--color-filo`               | `#E4E8E5`               | divisori delle righe a filo                                                    |
| `--color-filo-2`             | `#C3CCC9`               | bordo di tessere e schede di scelta a riposo, cerchio tratteggiato «Aggiungi». |
| `--color-filo-tenue`         | `#AEB9B7`               | superato (#634): nessun uso                                                    |
| `--color-filo-barra`         | `rgba(16, 38, 42, 0.1)` | filo sopra la barra in basso e sopra il piede dei fogli                        |
| `--color-filo-campo`         | `#869390`               | bordo del campo a riposo: 3,19:1 sul bianco (#634)                             |
| `--color-corsia-vuota`       | `#EEF1EF`               | superato (#634): nessun uso                                                    |
| `--color-notte`              | `#0B2A31`               | fondo di marca: porte, piano, onboarding, accesso                              |
| `--color-notte-2`            | `#2A2925`               | elementi sopra notte (bruno, domanda aperta)                                   |
| `--color-latte`              | `#FFFFFF`               | testo e segni sopra i fondi pieni e sopra notte, in entrambi i temi            |
| `--color-latte-2`            | `#D5DEDC`               | testo secondario sopra fumetto e notte, mai sopra `--color-pieno`              |

### Colori: Liberi insieme

| Variabile               | Valore    | Uso   |
| ----------------------- | --------- | ----- |
| `--color-insieme`       | `#FCEFC0` | fondo |
| `--color-insieme-bordo` | `#A38009` | bordo |
| `--color-insieme-testo` | `#4A4630` | testo |

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
| `--color-scaduto`       | `#A8321F` | superato (#634): nessun uso                                      |
| `--color-allerta-scuro` | `#A82A27` | passaggio e premuto di `.btn-pericolo-pieno` (**aggiunto**, #52) |
| `--color-info`          | `#3355CC` | informazione (non più l'anello del fuoco: è `--color-fuoco`)     |
| `--color-bianco`        | `#FFFFFF` | testo sul blu e sull'ardesia; sui pieni va `--color-latte`       |

### Colori: persone e animali

Dove vivono: pallino con l'iniziale, punti del mese, adesivi, filo attorno alla foto, barre delle corsie, e la tinta nel fondo del pallino non scelto. Mai su testi, schede o fondi di pagina.

**Codici e tinte.** I dieci codici dell'enum `member_color` del database (`pomodoro`, `glicine`, `salvia`, `cobalto`, `zafferano`, `lampone`, `ceruleo`, `peonia`, `basilico`, `cannella`, in quest'ordine) non cambiano e non si migra nulla. Quale tinta mostra ogni codice lo dice solo `src/lib/member-colors.ts` (`MEMBER_COLOR_CODES`, `MEMBER_COLOR_SHADES`, `memberColorClass()`, `memberColorLabel()`); nessun altro file riscrive la corrispondenza, e le pagine non scrivono mai i nomi delle tinte. `Avatar` e `ColorChoice` leggono da lì; `MEMBER_COLORS`, `MemberColor` e `memberColorLabel` restano esportati con lo stesso nome. I nomi accessibili (le tinte, con l'iniziale maiuscola) sono in `src/lib/i18n/messages/it.ts` (`memberColors`).

Ogni tinta ha tre token: `--color-membro-<tinta>` (pieno), `-tinta` (fondo tenue), `-corsia` (barra delle corsie).

| Codice (database)    | Tinta    | Pieno     | `-tinta`  | `-corsia`            | Iniziale (`--c-iniziale`) | Contrasto iniziale | Nome accessibile |
| -------------------- | -------- | --------- | --------- | -------------------- | ------------------------- | ------------------ | ---------------- |
| `pomodoro`           | corallo  | `#F2765C` | `#FDEAE5` | `#D75E45`            | inchiostro                | 5,64:1             | Corallo          |
| `glicine`            | glicine  | `#B9A2EC` | `#F2ECFC` | `#8F78BF`            | inchiostro                | 7,08:1             | Glicine          |
| `salvia`             | menta    | `#8FD0A8` | `#E7F5EC` | `#54936E`            | inchiostro                | 8,82:1             | Menta            |
| `cobalto`            | blu      | `#3F6FE0` | `#E5ECFC` | `#3F6FE0` (il pieno) | **bianco**                | 4,60:1             | Blu              |
| `zafferano`          | ambra    | `#E8A15C` | `#FCEEDD` | `#B9762E`            | inchiostro                | 7,27:1             | Ambra            |
| `lampone`            | sabbia   | `#D9B88F` | `#FAF5EF` | `#A3845D`            | inchiostro                | 8,41:1             | Sabbia           |
| `ceruleo`            | azzurro  | `#7CC7E0` | `#EDF7FB` | `#4792AA`            | inchiostro                | 8,33:1             | Azzurro          |
| `peonia`             | rosa     | `#F0A3C0` | `#FDF2F6` | `#BC7390`            | inchiostro                | 8,03:1             | Rosa             |
| `basilico`           | ardesia  | `#68778D` | `#EAECEF` | `#68778D` (il pieno) | **bianco**                | 4,55:1             | Ardesia          |
| `cannella`           | cannella | `#AF8273` | `#F5ECE8` | `#A67A6B`            | inchiostro                | 4,70:1             | Cannella         |
| — (solo interfaccia) | neutro   | `#B4BFBC` | `#EEF1EF` | `#55686C`            | inchiostro                | 8,34:1             | —                |

- **Ardesia `#68778D`:** decisione di Francesco del 25/11/2026, al posto di `#6B7A90` di Fable (con il bianco solo 4,36:1). Con `#68778D` l'iniziale bianca arriva a 4,55:1 a ogni misura del pallino.
- **Tinte dei colori liberi** (sabbia, azzurro, rosa, ardesia): dal #634 hanno i valori della tavolozza chiara (nella tabella sopra) e i loro token `-tinta`. Al buio valgono tutte `#1E2B2E` (il fondo «di casa», domanda aperta).
- **Neutro:** per chi non ha un colore (per esempio un ex componente). Esiste solo nell'interfaccia, non è un codice del database.
- **Corsie** (dal #634 i valori sono quelli della tavolozza di Fable, in chiaro e al buio; sostituiscono quelli calcolati il 25/11): la barretta di ogni persona sta almeno a 3:1 sul fondo dell'impegno e sul bianco. Se il pieno arriva già a 3:1 (blu, ardesia), la corsia è il pieno. Al buio la barretta torna al colore pieno della persona. Chi cambia una corsia la tiene sopra 3:1 (CA-22 della #196).
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

## Tavolozza comune dei Passi 12–16: chiaro e scuro (26/11/2026, D7)

> **Dal 27/11/2026 è nel codice (#634, `shared/tema-scuro`).** `globals.css` e `docs/agenti/design/token.css` hanno tre blocchi con gli stessi nomi: `:root` (chiaro), `:root[data-aspetto="scuro"]` e, dentro `@media (prefers-color-scheme: dark)`, `:root:not([data-aspetto="chiaro"])` (lo stesso scuro, un test controlla che i due blocchi siano identici). Solo CSS, senza script e senza `light-dark()`. **Un `--color-*` per ruolo**, non i `--c-*` di Fable (la tabella A sotto), e i valori chiari seguono la tavolozza. Riempimenti: ogni fondo pieno è `--color-pieno` con sopra `--color-latte`; toast e fumetto `--color-fumetto`; rosso pieno `--color-allerta-pieno`; anello del fuoco `--color-fuoco`; passaggio del mouse dei pieni `--color-azione`; testo scuro sopra un fondo chiaro fisso `--color-adesso-testo`. **`--color-latte-2` mai sopra `--color-pieno`** (3,5 : 1 al buio): lì il testo secondario è `--color-latte`. Pallino non scelto: `--c-spento` (30% del pieno sopra `--color-carta`) con l'iniziale `--color-inchiostro`. `.solo-chiaro` e `.solo-scuro` scambiano un'immagine tra i due temi. Superati e senza usi (restano in `:root`, si tolgono in una PR successiva): `--color-fondo-app`, `--color-anello-scelta`, `--color-filo-tenue`, `--color-inchiostro-2-fondo`, `--color-corsia-vuota`, `--color-scaduto`, `--color-azione-premuto`. Le tabelle di colori in alto sono allineate ai valori chiari nuovi; i token superati sono segnati come tali. Questa sezione è la tavolozza approvata con i Passi 12–16 (fonte: `docs/design/tavolozza.md` e `.json`, dal foglio di stile del canvas di Fable, righe `.v2` e `.v2.th-d`), comune a telefono, web da telefono e computer. **Il tema scuro c'è al lancio** (decisione di Francesco del 26/11).

**Come funziona.** Ogni colore dell'interfaccia passa da un ruolo. Il tema scuro cambia solo i valori: un blocco di variabili per il chiaro e uno per lo scuro, con gli stessi nomi; nessuna pagina è ridisegnata e nessun componente ha un colore scritto a mano. Il tema segue `prefers-color-scheme`; in Impostazioni › Aspetto la scelta «Chiaro / Scuro / Come il sistema» vince sul sistema. `prefers-color-scheme` è una caratteristica di media nuova rispetto alle tre media query ammesse in «Breakpoint»: la ammette la stessa `richiesta-condivisa`. «uguale» vuol dire stesso valore nei due temi.

### Ruoli (73)

#### Fondo e superfici

| Ruolo                  | Uso                                                                    | Chiaro                  | Scuro               |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------- | ------------------- |
| `--c-fondo`            | Fondo della pagina                                                     | `#FFFFFF`               | `#0F1819`           |
| `--c-sup`              | Superficie alzata: pannello, finestra, foglio, menu                    | `#FFFFFF`               | `#1A2729`           |
| `--c-basso`            | Superficie bassa: barra laterale, riquadri, campi pieni                | `#F4F6F4`               | `#172224`           |
| `--c-premuto`          | Premuto, scelto, passaggio del mouse                                   | `#ECEFEC`               | `#263639`           |
| `--c-scheletro`        | Scheletro del caricamento, binari spenti                               | `#DCE2DF`               | `#2B3A3C`           |
| `--c-velo`             | Velo dietro finestre e fogli                                           | `rgba(16,38,42,.36)`    | `rgba(0,0,0,.62)`   |
| `--c-ombra`            | Ombra leggera                                                          | `rgba(16,38,42,.08)`    | `rgba(0,0,0,.4)`    |
| `--c-ombra2`           | Ombra di finestre, fumetti, avvisi                                     | `rgba(16,38,42,.2)`     | `rgba(0,0,0,.6)`    |
| `--c-barra`            | Barra in basso del telefono                                            | `rgba(255,255,255,.52)` | `rgba(30,45,48,.9)` |
| `--c-cielo`            | Splash: il fondo prende il colore del cielo della scena                | `#BBE1F4`               | `#12294A`           |
| `--c-cielo-mezzo`      | Splash: a metà dissolvenza                                             | `#2A7F8E`               | `#0D2238`           |
| `--c-segnaposto`       | Segnaposto unico di una foto che manca, sabbia, con l'icona del piatto | `#F1E9DD`               | `#2E2A22`           |
| `--c-segnaposto-testo` | Icona e testo sul segnaposto                                           | `#5B5145`               | `#D9CDB8`           |
| `--c-idea-1`           | Miniatura di un'idea: all'aperto                                       | `#E4EEDD`               | `#24332A`           |
| `--c-idea-2`           | Miniatura di un'idea: al chiuso                                        | `#EFE6F2`               | `#322A38`           |
| `--c-idea-3`           | Miniatura di un'idea: in casa                                          | `#F6E4CF`               | `#3A2F22`           |
| `--c-scena`            | Fondo della scena e anteprima dello sfondo «Semplice»                  | `#DDE9E4`               | `#1D3536`           |

#### Fili e bordi

| Ruolo       | Uso                                            | Chiaro    | Scuro     |
| ----------- | ---------------------------------------------- | --------- | --------- |
| `--c-filo`  | Filo leggero tra le righe                      | `#E4E8E5` | `#2B3A3C` |
| `--c-filo2` | Filo medio, bordo dei pulsanti quieti          | `#C3CCC9` | `#3A4F52` |
| `--c-campo` | Bordo dei campi e dei tratteggi (almeno 3 a 1) | `#869390` | `#7E9496` |
| `--c-fuoco` | Anello del fuoco da tastiera                   | `#0F3D44` | `#F2F7F5` |

#### Testo

| Ruolo         | Uso                                          | Chiaro    | Scuro     |
| ------------- | -------------------------------------------- | --------- | --------- |
| `--c-testo`   | Testo e icone                                | `#10262A` | `#EAF2EE` |
| `--c-testo-m` | Testo medio                                  | `#33474B` | `#C9D5D2` |
| `--c-testo2`  | Testo secondario                             | `#55686C` | `#A9C0BF` |
| `--c-testo3`  | Testo spento, mai da solo                    | `#8A989A` | `#84999A` |
| `--c-su`      | Testo e icone sopra l'accento                | `#FFFFFF` | uguale    |
| `--c-su2`     | Testo secondario sopra l'accento e i fumetti | `#D5DEDC` | uguale    |
| `--c-link`    | Collegamento                                 | `#0E5A66` | `#7FD3DE` |

#### Accento

| Ruolo              | Uso                                                                    | Chiaro    | Scuro     |
| ------------------ | ---------------------------------------------------------------------- | --------- | --------- |
| `--c-pieno`        | Fondo pieno: pulsante principale, spunta, interruttore acceso          | `#10262A` | `#1F7D8A` |
| `--c-accento`      | Accento: voce scelta, energia, barre                                   | `#0F3D44` | `#1F7D8A` |
| `--c-notte`        | Fondo scuro di marca: benvenuto, metà dell'accesso, splash. Non cambia | `#0B2A31` | uguale    |
| `--c-logo-a`       | Logo: il tetto                                                         | `#0F3D44` | `#F2F6F3` |
| `--c-logo-b`       | Logo: il secondo tratto                                                | `#2F8F99` | `#8FD0CB` |
| `--c-logo-a-notte` | Logo sul fondo scuro di marca                                          | `#F2F6F3` | uguale    |
| `--c-logo-b-notte` | Logo sul fondo scuro di marca, secondo tratto                          | `#8FD0CB` | uguale    |
| `--c-fumetto`      | Fumetto e avviso in basso                                              | `#10262A` | `#2F4448` |
| `--c-assistente`   | Fondo del pulsante dell'assistente                                     | `#FCE7E0` | `#3B2621` |

#### Stati

| Ruolo              | Uso                                                     | Chiaro    | Scuro     |
| ------------------ | ------------------------------------------------------- | --------- | --------- |
| `--c-errore`       | Errore: testo, icona, filo                              | `#B3261E` | `#FF9D90` |
| `--c-errore-pieno` | Errore: punto e pulsante pieno                          | `#B3261E` | `#C4483A` |
| `--c-errore-fondo` | Errore: fondo dell'avviso                               | `#FCEEEA` | `#3A1E1B` |
| `--c-errore-bordo` | Errore: bordo dell'avviso                               | `#E7B9AB` | `#7A3A32` |
| `--c-adesso`       | Giallo di «adesso»                                      | `#F6C945` | uguale    |
| `--c-adesso-testo` | Testo sul giallo di «adesso» e sui colori delle persone | `#10262A` | uguale    |
| `--c-liberi`       | «Liberi insieme»: fondo                                 | `#FCEFC0` | `#3A3112` |
| `--c-liberi-barra` | «Liberi insieme»: barretta                              | `#A38009` | `#E2B93B` |
| `--c-liberi-testo` | «Liberi insieme»: testo secondario                      | `#4A4630` | `#F1E3A8` |

#### Persone e corsie

| Ruolo                | Uso                                                 | Chiaro    | Scuro                                      |
| -------------------- | --------------------------------------------------- | --------- | ------------------------------------------ |
| `--c-marco`          | Marco, corallo: pallino scelto                      | `#F2765C` | uguale                                     |
| `--c-marco-barra`    | Marco, corallo: barretta della corsia               | `#D75E45` | `#F2765C`                                  |
| `--c-marco-fondo`    | Marco, corallo: fondo dell'impegno                  | `#FDEAE5` | `#452F29`                                  |
| `--c-laura`          | Laura, glicine: pallino scelto                      | `#B9A2EC` | uguale                                     |
| `--c-laura-barra`    | Laura, glicine: barretta della corsia               | `#8F78BF` | `#B9A2EC`                                  |
| `--c-laura-fondo`    | Laura, glicine: fondo dell'impegno                  | `#F2ECFC` | `#38394C`                                  |
| `--c-sofia`          | Sofia, menta: pallino scelto                        | `#8FD0A8` | uguale                                     |
| `--c-sofia-barra`    | Sofia, menta: barretta della corsia                 | `#54936E` | `#8FD0A8`                                  |
| `--c-sofia-fondo`    | Sofia, menta: fondo dell'impegno                    | `#E7F5EC` | `#2E443B`                                  |
| `--c-tommaso`        | Tommaso, blu: pallino scelto                        | `#3F6FE0` | uguale                                     |
| `--c-tommaso-barra`  | Tommaso, blu: barretta della corsia                 | `#3F6FE0` | `#4E7BE2` **proposto**, vedi «Da chiarire» |
| `--c-tommaso-fondo`  | Tommaso, blu: fondo dell'impegno                    | `#E5ECFC` | `#1B2D49`                                  |
| `--c-biscotto`       | Biscotto, ambra: pallino scelto                     | `#E8A15C` | uguale                                     |
| `--c-biscotto-barra` | Biscotto, ambra: barretta della corsia              | `#B9762E` | `#E8A15C`                                  |
| `--c-biscotto-fondo` | Biscotto, ambra: fondo dell'impegno                 | `#FCEEDD` | `#433929`                                  |
| `--c-miele`          | Miele, cannella: pallino scelto                     | `#AF8273` | uguale                                     |
| `--c-miele-barra`    | Miele, cannella: barretta della corsia              | `#A67A6B` | `#AF8273`                                  |
| `--c-miele-fondo`    | Miele, cannella: fondo dell'impegno                 | `#F5ECE8` | `#35312F`                                  |
| `--c-casa-barra`     | Di casa, grigio: barretta                           | `#55686C` | `#A9C0BF`                                  |
| `--c-casa-fondo`     | Di casa, grigio: fondo dell'impegno                 | `#EEF1EF` | `#1E2B2E`                                  |
| `--c-iniziale`       | Iniziale nel pallino scelto: scura nei due temi     | `#10262A` | uguale                                     |
| `--c-iniziale-blu`   | Iniziale sul blu di Tommaso: bianca nei due temi    | `#FFFFFF` | uguale                                     |
| `--c-rosa`           | Rosa della tavolozza delle persone (chi è invitato) | `#F0A3C0` | uguale                                     |
| `--c-nessuno`        | Pallino e barretta di quello che non è di nessuno   | `#B4BFBC` | `#5E6F72`                                  |
| `--c-conferma`       | Segno di conferma, piano scelto                     | `#2F8F99` | `#8FD0CB`                                  |
| `--c-conferma-fondo` | Tratto fatto della linea del tempo                  | `#CFE5E1` | `#1F3F42`                                  |
| `--c-aiutante`       | Aiutanti: un solo colore neutro, con l'iniziale     | `#D5DBD8` | uguale                                     |

Nella tavolozza i colori sono legati alle persone di prova (Marco, Laura…). Nell'app il colore lo dà il codice della persona, con `memberColorClass()` di `src/lib/member-colors.ts`: corallo = `pomodoro`, glicine = `glicine`, menta = `salvia`, blu = `cobalto`, ambra = `zafferano`, cannella = `cannella`; aiutanti, «di casa» e «di nessuno» non sono codici. La `richiesta-condivisa` porta pieno, barretta e fondo nei token `--color-membro-<tinta>`, `-corsia` e `-tinta` con un valore per tema.

**Restano scritti a mano, per scelta:** i veli e i testi bianchi sopra le foto, i colori dentro la scena di Oggi e dello splash, i campioni degli sfondi (sono immagini).

### La regola del pallino (Passo 16)

Una regola sola, uguale in chiaro e al buio, in ogni fila di volti e in ogni selettore di persone («Per chi» di «Nuovo impegno», la fila dei volti del giorno, i filtri del calendario, «Chi vedo»):

- **Scelto:** colore pieno della persona, che non cambia al buio; iniziale `--c-iniziale` (#10262A), bianca `--c-iniziale-blu` (#FFFFFF) solo sul blu. Chi è scelto ha anche la spunta o l'anello: scelto e non scelto non si distinguono solo dal colore.
- **Non scelto:** lo stesso colore al 30% sopra il fondo della pagina, `color-mix(in srgb, <colore> 30%, var(--c-fondo))`, iniziale nel colore del testo `--c-testo` (scura in chiaro, chiara al buio). Niente ombra.
- L'iniziale arriva sempre almeno a 4,5 : 1. Fable ha controllato «Per chi», il giorno e le corsie, non ogni selettore: lo verificano i test di accessibilità.

| Persona  | Scelto, chiaro e buio | Non scelto, chiaro | Non scelto, buio |
| -------- | --------------------: | -----------------: | ---------------: |
| Marco    |                   5,6 |               11,7 |              9,7 |
| Laura    |                   7,1 |               12,6 |              8,7 |
| Sofia    |                   8,8 |               13,3 |              7,8 |
| Tommaso  |                   4,6 |               10,6 |             11,2 |
| Biscotto |                   7,3 |               12,7 |              8,6 |
| Miele    |                   4,7 |               11,5 |             10,1 |

Rispetto al codice di oggi cambia il pallino non scelto: oggi ha il fondo `-tinta` e l'iniziale del pieno (`--c-iniziale`); con la regola nuova il fondo si calcola dal pieno e dal fondo della pagina, e l'iniziale segue il testo.

### Le tinte delle barrette

La barretta a sinistra di ogni impegno stacca dal fondo dell'impegno almeno 3 : 1 (decisione di Francesco del 25/11). **In chiaro** (Passo 12): lo stesso colore con meno luce, fermato al primo valore sopra 3,2 : 1 sul fondo dell'impegno e sul bianco; pallino e fondo non cambiano (risposta 184: menta e giallo vanno bene così). **Al buio** la barretta torna al colore pieno della persona e il fondo dell'impegno diventa una tinta scura dello stesso colore.

| Colore                   | Pallino   | Fondo chiaro | Barretta chiaro    | Contrasto chiaro | Fondo scuro | Barretta scuro       | Contrasto scuro |
| ------------------------ | --------- | ------------ | ------------------ | ---------------: | ----------- | -------------------- | --------------: |
| corallo (Marco)          | `#F2765C` | `#FDEAE5`    | `#D75E45`          |              3,2 | `#452F29`   | `#F2765C`            |             4,4 |
| glicine (Laura)          | `#B9A2EC` | `#F2ECFC`    | `#8F78BF`          |              3,2 | `#38394C`   | `#B9A2EC`            |             5,1 |
| menta (Sofia)            | `#8FD0A8` | `#E7F5EC`    | `#54936E`          |              3,2 | `#2E443B`   | `#8FD0A8`            |             5,9 |
| blu (Tommaso)            | `#3F6FE0` | `#E5ECFC`    | `#3F6FE0`          |              3,9 | `#1B2D49`   | `#4E7BE2` (proposto) |             3,5 |
| ambra (Biscotto)         | `#E8A15C` | `#FCEEDD`    | `#B9762E`          |              3,2 | `#433929`   | `#E8A15C`            |             5,2 |
| cannella (Miele)         | `#AF8273` | `#F5ECE8`    | `#A67A6B`          |              3,2 | `#35312F`   | `#AF8273`            |             3,8 |
| rosa (libero)            | `#F0A3C0` | `#FDF2F6`    | `#BC7390`          |              3,2 | —           | —                    |               — |
| azzurro (libero)         | `#7CC7E0` | `#EDF7FB`    | `#4792AA`          |              3,2 | —           | —                    |               — |
| sabbia (libero)          | `#D9B88F` | `#FAF5EF`    | `#A3845D`          |              3,2 | —           | —                    |               — |
| ardesia (libero)         | `#68778D` | `#EAECEF`    | il pieno           |       almeno 3,7 | —           | —                    |               — |
| «Liberi insieme», giallo | `#F6C945` | `#FCEFC0`    | `#A38009`          |              3,2 | `#3A3112`   | `#E2B93B`            |             6,9 |
| di casa, di nessuno      | —         | `#EEF1EF`    | `#55686C` (testo2) |                — | `#1E2B2E`   | `#A9C0BF`            |             7,6 |

- Rosa, azzurro, sabbia e ardesia sono i colori liberi per chi arriva dopo: le tinte chiare sono nella tavola «I valori» (`docs/design/computer/regole-e-valori-p12-16/01-i-valori.png`), **non hanno valori scuri** e non si inventano.
- **Ardesia:** vale `#68778D`, decisione di Francesco del 25/11 (la tavola di Fable dice ancora `#6B7A90`); la barretta è il pieno.
- Sostituiscono le corsie `-corsia` di F2 (per esempio corallo `#EF5839`, menta `#419A63`), calcolate sul bianco e su `--color-corsia-vuota`: la `richiesta-condivisa` porta i valori di questa tabella, uguali su telefono e computer.

### La scena della notte

Al buio la scena di Oggi è **sempre la notte**, anche di giorno, e lo splash scuro usa la stessa scena (risposte 198 e 204): mai un rettangolo luminoso nella pagina scura, niente scena della sera al buio. È un'immagine: i colori sono scritti nella scena, non passano dai ruoli e non si invertono; si scambia l'immagine (giorno o notte), non si filtra. SVG `viewBox="0 0 390 300"`, `preserveAspectRatio="xMidYMax slice"`, stessa forma della scena del giorno.

| Parte           | Notte                                                    | Giorno (pomeriggio, per confronto) |
| --------------- | -------------------------------------------------------- | ---------------------------------- |
| Cielo, in alto  | `#081A33`                                                | `#86C8EE`                          |
| Cielo, in basso | `#1E3A5C`                                                | `#DDF0F8`                          |
| Stelle          | `#E8EEF6`, opacità da 0,42 a 0,89, raggio da 0,8 a 1,3   | —                                  |
| Luna            | `#EEF2F7` (r 20) con l'ombra `#0C2140` (r 18): una falce | sole `#FFF4C8`, alone al 35%       |
| Collina dietro  | `#1F3F50`                                                | `#7FC3B5`                          |
| Collina davanti | `#16303E`                                                | `#4FA394`                          |
| Casa            | `#C9D3DA`                                                | `#FFFFFF`                          |
| Tetto           | `#0F3D44`                                                | `#0F3D44`                          |
| Finestra        | `#FFDFA8` (accesa)                                       | `#CFE3EE`                          |

Attorno alla scena: lo splash scuro parte dal fondo di marca `--c-notte` #0B2A31, passa per `--c-cielo-mezzo` #0D2238 e arriva a `--c-cielo` #12294A (niente azzurro chiaro a metà dissolvenza), con gli stessi tempi dello splash chiaro (breve 1,4 s; lungo 2,9 s con il respiro di 100 ms). Il fondo dietro la scena e l'anteprima dello sfondo «Semplice» sono `--c-scena` (#1D3536 al buio). Il logo sul fondo di marca usa `--c-logo-a-notte` e `--c-logo-b-notte`.

### Regole del tema scuro

Testo completo: `docs/design/passi-12-16/regole-tema-scuro.md`.

- **Verde petrolio #1F7D8A con il bianco sopra** (risposta 196): al buio pulsante principale, scelte fatte, interruttore acceso e accento sono `--c-pieno`/`--c-accento` con il testo `--c-su` bianco (4,8 : 1). Niente pulsanti chiari con il testo scuro. Il verde fa 3,7 sul fondo, 3,2 su finestre e pannelli, 3,4 sulla barra laterale; sul fondo «premuto» di una riga scelta scende a 2,6, e lì **non è mai l'unico segnale**: c'è sempre anche la spunta o il testo (risposta 202). In chiaro il pieno resta #10262A e l'accento #0F3D44.
- **Bordo dei campi:** `--c-campo` #869390 in chiaro (3,2 : 1 sul bianco, anche sul telefono e nel campo di ricerca in alto, risposta 197) e #7E9496 al buio (5,6 sul fondo, 4,8 sulla superficie alzata). Sostituisce `--color-filo-campo` #7F9092 di F2. Il campo con il fuoco ha il filo scuro da 2 px.
- **Fuoco:** un solo anello, sempre visibile; al buio `--c-fuoco` #F2F7F5 (16,7 : 1 sul fondo).
- **Errore al buio:** testo `--c-errore` #FF9D90 (9,0 sul fondo, 7,6 sul suo fondo), fondo dell'avviso #3A1E1B, punto e pulsante pieno #C4483A. «1 viaggio scoperto» usa il ruolo dell'errore.
- **«Adesso»:** testo #10262A sul giallo #F6C945 nei due temi (10 : 1).
- **Foto:** non si invertono né si filtrano (ricette, animali, persone, campioni degli sfondi). Ricette e Pasti senza foto hanno un solo segnaposto sabbia `--c-segnaposto` con l'icona del piatto in `--c-segnaposto-testo` (risposte 205 e 210).
- **Email:** restano chiare, senza `prefers-color-scheme` (`docs/mockup/mail/`).
- **Soglie:** testo almeno 4,5 : 1; elementi, bordi e barrette almeno 3 : 1, nei due temi.

Contrasti al buio dalla tavola di Fable: testo sul fondo 15,8; testo secondario sul fondo 9,4 e sulla superficie alzata 8,0; testo spento sul fondo 6,0 (mai da solo); collegamento sul fondo 10,5; «Liberi insieme», barretta sul suo fondo 6,9.

### Ruolo → token dell'app (tabella A, #634)

Un nome `--color-*` per ogni ruolo; `*` = token nuovo. Valori in `docs/design/tavolozza.json` (75 ruoli: 73 più `piano-icona-1` e `-2` del Passo 17).

| Gruppo            | Ruolo → token                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fondo e superfici | fondo → `carta` · sup → `superficie` · basso → `carta-2` · premuto → `premuto` · scheletro → `scheletro`\* · velo → `velo` · ombra → `ombra` · ombra2 → `ombra-forte` · barra → `barra`\* · cielo → `cielo`\* · cielo-mezzo → `cielo-mezzo`\* · segnaposto(-testo) → `segnaposto`\*(`-testo`) · idea-1/2/3 → `idea-1/2/3`\* · scena → `scena-fondo`\*                                               |
| Fili              | filo → `filo` · filo2 → `filo-2` · campo → `filo-campo` · fuoco → `fuoco`\*                                                                                                                                                                                                                                                                                                                         |
| Testo             | testo → `inchiostro` · testo-m → `inchiostro-medio`\* · testo2 → `inchiostro-2` · testo3 → `inchiostro-3` · su → `latte` · su2 → `latte-2` · link → `link`\*                                                                                                                                                                                                                                        |
| Accento           | pieno → `pieno`\* · accento → `azione` · notte → `notte` · logo-a/b → `logo-a`\*/`logo-b`\* · logo-a/b-notte → `logo-a-notte`\*/`logo-b-notte`\* · fumetto → `fumetto`\* · assistente → `assistente`\*                                                                                                                                                                                              |
| Stati             | errore → `allerta` · errore-pieno → `allerta-pieno`\* · errore-fondo → `allerta-fondo` · errore-bordo → `allerta-bordo`\* · adesso → `adesso` · adesso-testo → `adesso-testo`\* · liberi → `insieme` · liberi-barra → `insieme-bordo` · liberi-testo → `insieme-testo`                                                                                                                              |
| Persone           | marco/laura/sofia/tommaso/biscotto/miele (+ `-barra`, `-fondo`) → `membro-corallo/glicine/menta/blu/ambra/cannella` (+ `-corsia`, `-tinta`) · casa-barra/fondo → `membro-neutro-corsia/-tinta` · rosa → `membro-rosa` · nessuno → `nessuno`\* · iniziale(-blu) → `iniziale`\*(`-blu`) · conferma(-fondo) → `conferma`\*(`-fondo`) · aiutante → `aiutante`\* · piano-icona-1/2 → `piano-icona-1/2`\* |

### Token senza ruolo (tabella B, #634)

| Token                                                                       | Chiaro                                           | Scuro                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `scelta-tenue`                                                              | #E2E9E5                                          | #263639                                         |
| `azione-premuto` · `allerta-scuro`                                          | invariati                                        | #1F7D8A · #C4483A (al buio il mouse non cambia) |
| `filo-barra` · `adesso-tinta` · `occupato-1` · `occupato-2`                 | rgba(16,38,42,.1) · #FCEFC0 · invariati          | #2B3A3C · #3A3112 · #172224 · #263639           |
| `ok` · `info` · `avviso`                                                    | #1B6B45 · invariati                              | #8FD0CB · #EAF2EE · #EAF2EE                     |
| `membro-neutro`, `notte-2`, `bianco`, `avatar-su-colore`, `marchio-*`       | invariati                                        | uguale                                          |
| `membro-sabbia/azzurro/rosa/ardesia-corsia`                                 | #A3845D · #4792AA · #BC7390 · #68778D (Passo 12) | il pieno: #D9B88F · #7CC7E0 · #F0A3C0 · #68778D |
| `membro-sabbia/azzurro/rosa/ardesia-tinta` (nuovi, prima usavano il neutro) | #FAF5EF · #EDF7FB · #FDF2F6 · #EAECEF            | #1E2B2E (quello «di casa»)                      |

### Da chiarire

- **`--color-notte-2`** (#2A2925, bruno) sopra il nuovo fondo di marca verde scuro fa 1,04 : 1: resta com'è nei due temi, decorativo; il valore giusto lo deve dare Fable.
- **Fondo scuro dei quattro colori liberi** (#1E2B2E) e passaggio del mouse dei pieni al buio (nessun cambio): default dell'analista, da far confermare a Francesco.
- **Bordo dei campi in chiaro su `--color-carta-2`:** 2,93 : 1. Nessun campo con `--color-filo-campo` sta sopra quel fondo.
