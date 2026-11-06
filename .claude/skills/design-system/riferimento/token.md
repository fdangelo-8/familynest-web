# Design system · token

> Parte di consultazione della skill `design-system` (`../SKILL.md`): tutti i valori. Le regole sempre valide sono nella skill.

Tutti i valori di `docs/mockup/tokens.css`, senza arrotondamenti. Nome variabile → valore → uso. Unica conversione: dalla #313 dimensioni e interlinee del testo sono in rem (stesso valore a 16 px), vedi «Scala tipografica».

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

| Variabile                  | Valore    | Uso           |
| -------------------------- | --------- | ------------- |
| `--color-membro-pomodoro`  | `#F06A4F` |               |
| `--color-membro-glicine`   | `#B9A3E8` |               |
| `--color-membro-salvia`    | `#8DBF9B` |               |
| `--color-membro-cobalto`   | `#5C7FE0` |               |
| `--color-membro-zafferano` | `#F2B33D` |               |
| `--color-membro-lampone`   | `#D75596` | aggiunto, #74 |
| `--color-membro-ceruleo`   | `#4B96AA` | aggiunto, #74 |
| `--color-membro-peonia`    | `#F2A8C6` | aggiunto, #74 |
| `--color-membro-basilico`  | `#649100` | aggiunto, #74 |
| `--color-membro-cannella`  | `#AF8273` | aggiunto, #74 |

Dieci colori, uno per ogni membro del Nest (massimo 10 tra persone e animali, #74). I nomi sono anche i valori del database e il suffisso della classe `.membro-<nome>`: minuscoli, senza accenti. Ordine: i 5 di sempre, poi lampone, ceruleo, peonia, basilico, cannella (`MEMBER_COLORS` in `Avatar.tsx`, seguiti da `insieme`). Ogni colore ha un valore solo: l'iniziale è sempre `--color-inchiostro`.

Distanza (CIEDE2000, vista tipica) del colore nuovo più vicino a ciascuno dei 5 nuovi: lampone/peonia 19,5; ceruleo/cobalto 19,1; peonia/glicine 17,8; basilico/salvia 23,0; cannella/pomodoro 15,1. Minimo tra tutti i 10: 15,1. Con deuteranopia e protanopia il minimo è 9,7, con tritanopia 6,7 (cobalto/ceruleo 7,1): il colore non è mai l'unica informazione, c'è sempre l'iniziale o il nome.

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

Dalla #313 (testo ingrandito, WCAG 1.4.4) dimensioni e interlinee sono in **rem**: px di `tokens.css` diviso 16. Con la radice a 16 px (impostazione normale) il valore in px è identico al mockup; con il carattere di sistema o del browser più grande, il testo cresce. Le interlinee sono in rem e non senza unità: senza unità i figli erediterebbero il rapporto e al 100% la geometria cambierebbe (una riga da 22 px diventerebbe 17,6 px). Il tracking resta in `em`. Le iniziali degli avatar (`--text-avatar-*`) restano in px: il cerchio ha una misura fissa e il nome c'è sempre come testo o nome accessibile. Nei test i valori si confrontano con `tokens.css` × 16 (CA-1 della #313).

| Variabile                           | Valore      | px a 16 | Uso                                         |
| ----------------------------------- | ----------- | ------- | ------------------------------------------- |
| `--text-display-size`               | `2.75rem`   | 44      |                                             |
| `--text-display-line`               | `3rem`      | 48      |                                             |
| `--text-display-tracking`           | `-.04em`    | —       |                                             |
| `--text-display-desktop-size`       | `3.5rem`    | 56      |                                             |
| `--text-display-desktop-line`       | `3.75rem`   | 60      |                                             |
| `--text-ora-xl-size`                | `4rem`      | 64      |                                             |
| `--text-ora-xl-line`                | `3.5rem`    | 56      |                                             |
| `--text-ora-xl-tracking`            | `-.04em`    | —       |                                             |
| `--text-ora-l-size`                 | `3.25rem`   | 52      |                                             |
| `--text-ora-l-line`                 | `3rem`      | 48      |                                             |
| `--text-ora-l-tracking`             | `-.04em`    | —       |                                             |
| `--text-numero-size`                | `2.75rem`   | 44      |                                             |
| `--text-numero-line`                | `3rem`      | 48      |                                             |
| `--text-numero-tracking`            | `-.04em`    | —       |                                             |
| `--text-titolo-pagina-size`         | `2rem`      | 32      |                                             |
| `--text-titolo-pagina-line`         | `2.25rem`   | 36      |                                             |
| `--text-titolo-pagina-tracking`     | `-.03em`    | —       |                                             |
| `--text-titolo-pagina-desktop-size` | `2.5rem`    | 40      |                                             |
| `--text-titolo-pagina-desktop-line` | `2.75rem`   | 44      |                                             |
| `--text-titolo-scheda-size`         | `1.375rem`  | 22      |                                             |
| `--text-titolo-scheda-line`         | `1.625rem`  | 26      |                                             |
| `--text-titolo-scheda-tracking`     | `-.02em`    | —       |                                             |
| `--text-frase-size`                 | `1.375rem`  | 22      |                                             |
| `--text-frase-line`                 | `1.875rem`  | 30      |                                             |
| `--text-frase-tracking`             | `-.015em`   | —       |                                             |
| `--text-sezione-size`               | `0.9375rem` | 15      |                                             |
| `--text-sezione-line`               | `1.5rem`    | 24      |                                             |
| `--text-corpo-forte-size`           | `0.9375rem` | 15      |                                             |
| `--text-corpo-forte-line`           | `1.25rem`   | 20      |                                             |
| `--text-corpo-size`                 | `0.9375rem` | 15      |                                             |
| `--text-corpo-line`                 | `1.375rem`  | 22      |                                             |
| `--text-ora-riga-size`              | `0.9375rem` | 15      |                                             |
| `--text-ora-riga-line`              | `1.25rem`   | 20      |                                             |
| `--text-ora-riga-tracking`          | `-.01em`    | —       |                                             |
| `--text-nota-size`                  | `0.8125rem` | 13      |                                             |
| `--text-nota-line`                  | `1.125rem`  | 18      |                                             |
| `--text-etichetta-size`             | `0.75rem`   | 12      |                                             |
| `--text-etichetta-line`             | `1rem`      | 16      |                                             |
| `--text-etichetta-tracking`         | `.02em`     | —       |                                             |
| `--text-micro-size`                 | `0.6875rem` | 11      |                                             |
| `--text-micro-line`                 | `0.875rem`  | 14      |                                             |
| `--text-controllo-size`             | `0.875rem`  | 14      | testo di bottoni, selettori, righe compatte |
| `--text-controllo-line`             | `1.25rem`   | 20      | testo di bottoni, selettori, righe compatte |
| `--text-numero-m-size`              | `2.25rem`   | 36      | giorni alle scadenze                        |
| `--text-numero-m-line`              | `2.25rem`   | 36      | giorni alle scadenze                        |
| `--text-numero-s-size`              | `1.875rem`  | 30      | contatori piccoli                           |
| `--text-numero-s-line`              | `2.125rem`  | 34      | contatori piccoli                           |
| `--text-cella-size`                 | `1.125rem`  | 18      | numeri del mese e della striscia            |
| `--text-cella-line`                 | `1.625rem`  | 26      | numeri del mese e della striscia            |
| `--text-avatar-xs-size`             | `8px`       | 8       | resta in px (#313)                          |
| `--text-avatar-s-size`              | `10px`      | 10      | resta in px (#313)                          |
| `--text-avatar-m-size`              | `13px`      | 13      | resta in px (#313)                          |
| `--text-avatar-l-size`              | `18px`      | 18      | resta in px (#313)                          |
| `--text-avatar-xl-size`             | `30px`      | 30      | resta in px (#313)                          |
| `--tracking-codice`                 | `.12em`     | —       |                                             |
| `--tracking-maiuscolo`              | `.08em`     | —       |                                             |

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

Tutte le misure qui sopra restano in px anche dopo la #313: con il testo grande non crescono (barra, avatar, icone, interruttore, casella restano come nel mockup); a crescere sono il testo e le altezze minime dei controlli che lo contengono (`min-height`, vedi `componenti.md`, «Testo ingrandito»).

### Misure minime che seguono il testo (**aggiunte**, #313)

In rem: con il testo normale valgono i px a destra, con il testo grande crescono e fanno scattare le disposizioni a una colonna. Non sono nel mockup: il test CA-1 le elenca tra le differenze approvate (#313).

| Variabile              | Valore   | px a 16 | Uso                                                                      |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `--size-modulo-min`    | `9.5rem` | 152     | colonna minima delle schede di Esplora e di `.griglia-contatori` (a due) |
| `--size-contatore-min` | `6rem`   | 96      | colonna minima di `.griglia-contatori--tre`                              |
| `--size-dati-min`      | `8rem`   | 128     | base di `.prossimo__dati` accanto all'ora (Prossimo, Dettaglio impegno)  |

### Larghezze delle query di contenitore (#313)

Come le media query, non leggono le variabili: si scrivono i numeri, in rem (nella query `rem` è la radice reale, quindi con 16 px non scattano mai alle misure del mockup). Sono le sole ammesse.

| Contenitore (`container-name`) | Su                                      | Query             | Cosa cambia                                    |
| ------------------------------ | --------------------------------------- | ----------------- | ---------------------------------------------- |
| `barra`                        | `.nav-basso`                            | `(width < 13rem)` | «Aggiungi» diventa il quadrato con il solo «+» |
| `riga`                         | `.riga-lista`, `.riga-regalo`           | `(width < 16rem)` | valore, etichetta o azione scendono sotto      |
| `selettore`                    | `.contenitore-selettore` (classe nuova) | `(width < 17rem)` | le voci del selettore si impilano              |

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
