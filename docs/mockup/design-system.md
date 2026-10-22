# FamilyNest · Design system

Versione 1.0 · 22 ottobre 2026. Fonte unica dei valori: `tokens.css`. Componenti: `components.css`. Galleria: `design-system.html`. Schermate: `index.html`.

Questo documento è scritto per chi costruisce l’app (persone o agenti). Regola d’oro: **se un valore non è in `tokens.css`, non si usa**. Se serve, si aggiunge prima a `tokens.css` e a questo documento.

## 1. Principi

- **Una casa, un posto solo.** FamilyNest tiene insieme calendario, spesa, da fare e scadenze di chi vive insieme. Ogni schermata risponde a una domanda: cosa succede adesso, cosa c’è questa settimana, cosa manca in casa.
- **Prima io, poi il Nest.** Oggi e Calendario si aprono sulla lente «Io». Un tocco su «Nest» mostra tutta la casa.
- **Calmo, non vuoto.** Fondo carta, schede bianche, inchiostro quasi nero. Il colore arriva solo dalle persone (avatar) e da «Liberi insieme» (giallo).
- **Numeri e ore sono protagonisti.** Parkinsans sottile, grande, sempre nello stesso stile. Niente rosso per dire «tra poco».
- **Un solo modo per aggiungere.** Il bottone Aggiungi apre lo stesso modulo per impegni, spesa, da fare e scadenze; si scrive come si parla.
- **Privato per scelta.** Ogni impegno ha tre livelli: Solo io, Occupato, Tutto il Nest. Gli «Occupato» si vedono come righe grigie senza dettagli.
- **Niente che sembri generato.** Niente illustrazioni, gradienti, emoji o testi di riempimento. Testi brevi, veri, in italiano.

## 2. Colori

### Colori: base

| Token | Valore | Uso |
|---|---|---|
| `--color-carta` | #F1F2EE | sfondo delle pagine |
| `--color-carta-2` | #E7E8E2 | segnaposto foto, scheletri di caricamento |
| `--color-superficie` | #FFFFFF | schede, campi, barre |
| `--color-inchiostro` | #17181C | testo principale, azione principale |
| `--color-inchiostro-2` | #5A5D64 | testo secondario |
| `--color-inchiostro-3` | #8A8D93 | solo elementi non testuali (tacche, segni) |
| `--color-filo` | #DFE0DA | bordi e divisori |
| `--color-filo-2` | #CFD1CA | bordi dei campi, bordi tratteggiati |
| `--color-notte` | #1B1A17 | blocchi scuri: porte, piano, onboarding |
| `--color-notte-2` | #2A2925 | elementi sopra notte |
| `--color-latte` | #F4F2EC | testo e superfici chiare su inchiostro e notte |
| `--color-latte-2` | #B9B5AC | testo secondario su notte |

### Colori: Liberi insieme

| Token | Valore | Uso |
|---|---|---|
| `--color-insieme` | #FBF3D6 | fondo |
| `--color-insieme-bordo` | #C9A43A | bordo |
| `--color-insieme-testo` | #6B5413 | testo |

### Colori: impegni «Occupato» (righe grigie)

| Token | Valore | Uso |
|---|---|---|
| `--color-occupato-1` | #ECEDE7 |  |
| `--color-occupato-2` | #E4E5DE |  |

### Colori: stato

| Token | Valore | Uso |
|---|---|---|
| `--color-ok` | #237A4B |  |
| `--color-avviso` | #A15C07 |  |
| `--color-allerta` | #C8322F |  |
| `--color-info` | #3355CC |  |
| `--color-bianco` | #FFFFFF |  |

### Colori: membri (solo negli avatar)

| Token | Valore | Uso |
|---|---|---|
| `--color-membro-pomodoro` | #F06A4F |  |
| `--color-membro-glicine` | #B9A3E8 |  |
| `--color-membro-salvia` | #8DBF9B |  |
| `--color-membro-cobalto` | #5C7FE0 |  |
| `--color-membro-zafferano` | #F2B33D |  |

### Colori: marchi dei calendari esterni (solo nei loghi)

| Token | Valore | Uso |
|---|---|---|
| `--color-marchio-outlook` | #0F6CBD |  |
| `--color-marchio-google` | #188038 |  |
| `--color-marchio-icloud` | #1C1C1E |  |

### Colori: trasparenze

| Token | Valore | Uso |
|---|---|---|
| `--color-velo` | rgba(23,24,28,.30) | sotto fogli e modali |
| `--color-ombra` | rgba(23,24,28,.06) |  |
| `--color-ombra-forte` | rgba(23,24,28,.30) |  |
| `--color-ombra-adesivo` | rgba(0,0,0,.25) |  |
| `--color-avatar-su-colore` | rgba(255,255,255,.55) | cerchio dentro gli adesivi |

### Contrasti (WCAG 2.1)

Minimo 4,5:1 per ogni testo; 3:1 per segni non testuali. Calcolati dai valori di `tokens.css`.

| Testo | Fondo | Rapporto | Minimo | Esito | Dove |
|---|---|---|---|---|---|
| `--color-inchiostro` | `--color-carta` | 15.78:1 | 4.5:1 | OK | testo principale sulle pagine |
| `--color-inchiostro` | `--color-superficie` | 17.74:1 | 4.5:1 | OK | testo principale nelle schede |
| `--color-inchiostro-2` | `--color-carta` | 5.86:1 | 4.5:1 | OK | testo secondario sulle pagine |
| `--color-inchiostro-2` | `--color-superficie` | 6.59:1 | 4.5:1 | OK | testo secondario nelle schede |
| `--color-inchiostro-2` | `--color-carta-2` | 5.35:1 | 4.5:1 | OK | testo secondario sul fondo del mockup |
| `--color-inchiostro` | `--color-occupato-2` | 13.99:1 | 4.5:1 | OK | testo sulle righe «Occupato» |
| `--color-latte` | `--color-inchiostro` | 15.85:1 | 4.5:1 | OK | testo dei bottoni principali e chip scelti |
| `--color-latte` | `--color-notte` | 15.55:1 | 4.5:1 | OK | testo su schede scure e schermate notte |
| `--color-latte-2` | `--color-notte` | 8.51:1 | 4.5:1 | OK | testo secondario su notte |
| `--color-insieme-testo` | `--color-insieme` | 6.51:1 | 4.5:1 | OK | «Liberi insieme» |
| `--color-allerta` | `--color-superficie` | 5.31:1 | 4.5:1 | OK | urgente, errori |
| `--color-allerta` | `--color-carta` | 4.72:1 | 4.5:1 | OK | urgente sulle pagine |
| `--color-bianco` | `--color-allerta` | 5.31:1 | 4.5:1 | OK | bottone pericoloso pieno, etichetta allerta |
| `--color-ok` | `--color-superficie` | 5.31:1 | 4.5:1 | OK | avviso di conferma |
| `--color-avviso` | `--color-superficie` | 5.19:1 | 4.5:1 | OK | avviso arancio |
| `--color-info` | `--color-superficie` | 6.34:1 | 4.5:1 | OK | avviso informativo, anello di focus |
| `--color-inchiostro` | `--color-membro-pomodoro` | 5.81:1 | 4.5:1 | OK | iniziale nell’avatar |
| `--color-inchiostro` | `--color-membro-glicine` | 8.00:1 | 4.5:1 | OK | iniziale nell’avatar |
| `--color-inchiostro` | `--color-membro-salvia` | 8.50:1 | 4.5:1 | OK | iniziale nell’avatar |
| `--color-inchiostro` | `--color-membro-cobalto` | 4.70:1 | 4.5:1 | OK | iniziale nell’avatar |
| `--color-inchiostro` | `--color-membro-zafferano` | 9.54:1 | 4.5:1 | OK | iniziale nell’avatar |
| `--color-bianco` | `--color-marchio-outlook` | 5.38:1 | 4.5:1 | OK | iniziale nel logo Outlook |
| `--color-bianco` | `--color-marchio-google` | 5.02:1 | 4.5:1 | OK | iniziale nel logo Google |
| `--color-bianco` | `--color-marchio-icloud` | 17.01:1 | 4.5:1 | OK | iniziale nel logo iCloud |
| `--color-inchiostro-3` | `--color-superficie` | 3.33:1 | 3:1 | OK | solo segni non testuali (tacche, bordi attivi) |
| `--color-filo-2` | `--color-superficie` | 1.54:1 | 1:1 | OK | bordo dei campi (decorativo: il campo ha anche l’etichetta) |

`--color-inchiostro-3` non si usa mai per il testo (3,3:1 su bianco). `--color-filo` e `--color-filo-2` sono bordi decorativi: ogni campo ha anche un’etichetta e un fondo diverso dalla pagina.

## 3. Tipografia

- **Parkinsans** (`--font-titoli`), peso sottile (300): titoli di pagina, ore, numeri, frasi. Le ore e i numeri hanno tutti lo stesso stile.
- **Host Grotesk** (`--font-testo`): tutto il resto. Pesi 400–700.
- I font si caricano da Google Fonts con il `<link>` presente in ogni pagina.

### Font

| Token | Valore | Nota |
|---|---|---|
| `--font-titoli` | "Parkinsans",ui-sans-serif,system-ui,sans-serif |  |
| `--font-testo` | "Host Grotesk",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif |  |
| `--font-codice` | ui-monospace,"SF Mono",Menlo,monospace | solo nella documentazione |
| `--weight-sottile` | 300 |  |
| `--weight-normale` | 400 |  |
| `--weight-medio` | 500 |  |
| `--weight-semi` | 600 |  |
| `--weight-forte` | 650 |  |
| `--weight-pieno` | 700 |  |

### Scala tipografica (mobile; *-desktop dove cambia)

| Token | Valore | Nota |
|---|---|---|
| `--text-display-size` | 44px |  |
| `--text-display-line` | 48px |  |
| `--text-display-tracking` | -.04em |  |
| `--text-display-desktop-size` | 56px |  |
| `--text-display-desktop-line` | 60px |  |
| `--text-ora-xl-size` | 64px |  |
| `--text-ora-xl-line` | 56px |  |
| `--text-ora-xl-tracking` | -.04em |  |
| `--text-ora-l-size` | 52px |  |
| `--text-ora-l-line` | 48px |  |
| `--text-ora-l-tracking` | -.04em |  |
| `--text-numero-size` | 44px |  |
| `--text-numero-line` | 48px |  |
| `--text-numero-tracking` | -.04em |  |
| `--text-titolo-pagina-size` | 32px |  |
| `--text-titolo-pagina-line` | 36px |  |
| `--text-titolo-pagina-tracking` | -.03em |  |
| `--text-titolo-pagina-desktop-size` | 40px |  |
| `--text-titolo-pagina-desktop-line` | 44px |  |
| `--text-titolo-scheda-size` | 22px |  |
| `--text-titolo-scheda-line` | 26px |  |
| `--text-titolo-scheda-tracking` | -.02em |  |
| `--text-frase-size` | 22px |  |
| `--text-frase-line` | 30px |  |
| `--text-frase-tracking` | -.015em |  |
| `--text-sezione-size` | 15px |  |
| `--text-sezione-line` | 24px |  |
| `--text-corpo-forte-size` | 15px |  |
| `--text-corpo-forte-line` | 20px |  |
| `--text-corpo-size` | 15px |  |
| `--text-corpo-line` | 22px |  |
| `--text-ora-riga-size` | 15px |  |
| `--text-ora-riga-line` | 20px |  |
| `--text-ora-riga-tracking` | -.01em |  |
| `--text-nota-size` | 13px |  |
| `--text-nota-line` | 18px |  |
| `--text-etichetta-size` | 12px |  |
| `--text-etichetta-line` | 16px |  |
| `--text-etichetta-tracking` | .02em |  |
| `--text-micro-size` | 11px |  |
| `--text-micro-line` | 14px |  |
| `--text-controllo-size` | 14px | testo di bottoni, selettori, righe compatte |
| `--text-controllo-line` | 20px | testo di bottoni, selettori, righe compatte |
| `--text-numero-m-size` | 36px | giorni alle scadenze |
| `--text-numero-m-line` | 36px | giorni alle scadenze |
| `--text-numero-s-size` | 30px | contatori piccoli |
| `--text-numero-s-line` | 34px | contatori piccoli |
| `--text-cella-size` | 18px | numeri del mese e della striscia |
| `--text-cella-line` | 26px | numeri del mese e della striscia |
| `--text-avatar-xs-size` | 8px |  |
| `--text-avatar-s-size` | 10px |  |
| `--text-avatar-m-size` | 13px |  |
| `--text-avatar-l-size` | 18px |  |
| `--text-avatar-xl-size` | 30px |  |
| `--tracking-codice` | .12em |  |
| `--tracking-maiuscolo` | .08em |  |

### Classi di testo

| Classe | Font | Token | Esempio |
|---|---|---|---|
| `.t-display` | Parkinsans 300 | `--text-display-*` (desktop `--text-display-desktop-*`) | Buon pomeriggio |
| `.t-titolo-pagina` | Parkinsans 300 | `--text-titolo-pagina-*` (desktop `--text-titolo-pagina-desktop-*`) | Calendari collegati |
| `.t-titolo-scheda` | Parkinsans 400 | `--text-titolo-scheda-*` | Completa il profilo di Sofia |
| `.t-frase` | Parkinsans 300 | `--text-frase-*` | Stasera siete liberi insieme dalle 21:30. |
| `.t-numero` | Parkinsans 300, cifre tabellari | `--text-numero-*` | 14 |
| `.t-sezione` | Host Grotesk 650 | `--text-sezione-*` | Questa settimana |
| `.t-corpo-forte` | Host Grotesk 650 | `--text-corpo-forte-*` | Nuoto Sofia |
| `.t-corpo` | Host Grotesk 400 | `--text-corpo-*` | Piscina comunale, la porta Laura |
| `.t-controllo` | Host Grotesk 600 | `--text-controllo-*` | Aggiungi |
| `.t-nota` | Host Grotesk 500 | `--text-nota-*` | Entro giovedì |
| `.t-etichetta` | Host Grotesk 650 | `--text-etichetta-*` | OUTLOOK |
| `.t-micro` | Host Grotesk 600 | `--text-micro-*` | Lun |
| `.t-secondario` · `.t-forte` · `.t-allerta` | — | `--color-inchiostro-2` · `--weight-pieno` · `--color-allerta` | ritocchi |

## 4. Spaziature e griglia

Scala a passi di 4 px. Tra sezioni 24 px (`--space-6`), dentro le schede 16 px (`--space-4`), tra righe di testo 4 px (`--space-1`).

| Token | Valore | Nota |
|---|---|---|
| `--space-0` | 0 |  |
| `--space-half` | 2px |  |
| `--space-1` | 4px |  |
| `--space-2` | 8px |  |
| `--space-3` | 12px |  |
| `--space-4` | 16px |  |
| `--space-5` | 20px |  |
| `--space-6` | 24px |  |
| `--space-8` | 32px |  |
| `--space-10` | 40px |  |
| `--space-12` | 48px |  |
| `--space-16` | 64px |  |

| Token | Valore | Nota |
|---|---|---|
| `--grid-margine-mobile` | 20px |  |
| `--grid-margine-desktop` | 40px |  |
| `--grid-colonne-desktop` | 12 | griglia di riferimento per le colonne desktop |
| `--grid-gutter` | 24px |  |
| `--grid-contenuto-max` | 1200px |  |
| `--grid-colonna-stretta` | 720px | pagine di impostazioni e dettaglio su desktop |

## 5. Raggi, bordi, ombre

| Token | Valore | Uso |
|---|---|---|
| `--radius-xs` | 6px | kbd, etichetta fonte |
| `--radius-s` | 8px | etichette, chip, voce attiva dei selettori |
| `--radius-m` | 12px | controlli: bottoni, campi, selettori |
| `--radius-l` | 16px | schede |
| `--radius-xl` | 24px | fogli e modali |
| `--radius-tondo` | 999px | avatar, interruttori, pallini |

| Token | Valore | Uso |
|---|---|---|
| `--border-sottile` | 1px |  |
| `--border-medio` | 1.5px |  |
| `--border-evidenza` | 3px | filo nero in cima alla scheda in evidenza |

| Token | Valore | Uso |
|---|---|---|
| `--shadow-nessuna` | none |  |
| `--shadow-scheda` | 0 1px 2px var(--color-ombra) |  |
| `--shadow-barra` | 0 8px 24px var(--color-ombra) |  |
| `--shadow-foglio` | 0 -8px 32px var(--color-ombra) |  |
| `--shadow-modale` | 0 30px 80px var(--color-ombra-forte) |  |
| `--shadow-adesivo` | 0 10px 24px var(--color-ombra-adesivo) |  |

Le schede non hanno ombra (`--shadow-nessuna`): si staccano dal fondo carta con il bianco e un filo interno di 1 px. Le ombre servono solo a ciò che sta sopra la pagina: barre, fogli, modali, adesivi.

### Misure

| Token | Valore | Uso |
|---|---|---|
| `--size-tocco` | 44px | area minima di tocco |
| `--size-controllo` | 40px | bottoni icona, selettori, chip grandi |
| `--size-azione` | 52px | bottoni principali, campi |
| `--size-riga` | 56px | righe di lista |
| `--size-riga-alta` | 64px | righe evento, righe con due testi |
| `--size-barra` | 64px | barra di navigazione mobile, bottone Aggiungi |
| `--size-nav-desktop` | 72px | barra di navigazione desktop |
| `--size-etichetta` | 28px | etichette e chip piccoli |
| `--size-chip` | 36px | chip filtro |
| `--size-interruttore-l` | 44px |  |
| `--size-interruttore-a` | 26px |  |
| `--size-interruttore-pallino` | 20px |  |
| `--size-casella` | 22px | checkbox e radio |
| `--size-icona-s` | 16px |  |
| `--size-icona-m` | 20px |  |
| `--size-icona-l` | 24px |  |
| `--size-avatar-xs` | 18px |  |
| `--size-avatar-s` | 24px |  |
| `--size-avatar-m` | 32px |  |
| `--size-avatar-l` | 44px |  |
| `--size-avatar-xl` | 72px |  |
| `--size-quadrato-nest` | 40px |  |
| `--size-colonna-ora` | 48px | colonna dell'orario nelle righe |
| `--size-colonna-giorni` | 72px | colonna dei giorni nelle scadenze |
| `--size-cta-aggiungi` | 128px | larghezza del bottone Aggiungi in basso |
| `--size-pannello-desktop` | 320px |  |
| `--size-menu-desktop` | 280px |  |
| `--size-modale` | 880px |  |
| `--size-dialogo` | 400px |  |
| `--size-maniglia-l` | 40px |  |
| `--size-maniglia-a` | 4px |  |
| `--size-adesivo` | 56px |  |
| `--size-qr` | 168px |  |
| `--size-foto` | 64px |  |
| `--size-foto-scheda` | 160px |  |
| `--size-ora-calendario` | 50px | altezza di un'ora nella vista Giorno mobile |
| `--size-ora-desktop` | 40px | altezza di un'ora nella griglia settimana desktop |
| `--size-cella-mese` | 48px |  |
| `--size-pallino` | 6px |  |
| `--size-pallino-urgente` | 8px |  |
| `--size-tacca` | 4px |  |
| `--size-bottone-s` | 32px | puntina, chiudi nei fogli |
| `--size-bottone-icona` | 36px | quadratino con icona dentro bottoni e campi |
| `--size-scelta` | 72px | schede di scelta, righe scadenza |
| `--size-radio-pieno` | 7px |  |
| `--size-contatore` | 136px |  |
| `--size-modulo` | 152px |  |
| `--size-porta` | 120px |  |
| `--size-palette` | 680px |  |
| `--size-colonna-dati` | 104px |  |
| `--size-riga-occupato` | 6px | larghezza delle righe diagonali di «Occupato» |
| `--size-punto-membro` | 9px | avatar senza iniziale sotto i giorni del mese |
| `--size-frame-mobile` | 390px |  |
| `--size-frame-mobile-altezza` | 844px |  |
| `--size-frame-desktop` | 1280px |  |
| `--size-frame-desktop-altezza` | 800px |  |

### Opacità e livelli

| Token | Valore | Uso |
|---|---|---|
| `--opacity-passato` | .5 |  |
| `--opacity-disabilitato` | .4 |  |
| `--z-base` | 1 |  |
| `--z-nav` | 4 |  |
| `--z-velo` | 5 |  |
| `--z-foglio` | 6 |  |
| `--z-toast` | 7 |  |

## 6. Iconografia

- Libreria: **Lucide** (`lucide-static` 0.460.0), a tratto, mai piene. Tratto `--border-medio`, estremità arrotondate.
- Taglie: `.icona--s` 16 px (`--size-icona-s`), `.icona` 20 px (`--size-icona-m`), `.icona--l` 24 px (`--size-icona-l`).
- Colore: sempre quello del testo (`currentColor`).
- Ogni pagina contiene uno sprite `<svg class="sprite-icone">` con le sole icone usate; si richiamano con `<svg class="icona"><use href="#i-nome"></use></svg>`.
- Decorative: `aria-hidden="true"`. Un bottone con sola icona ha `aria-label`.
- I calendari esterni non usano i loghi originali ma `.logo-marchio` (iniziale sul colore del marchio).

Icone usate nelle schermate: `apple`, `arrow-left`, `arrow-right`, `arrow-up-left`, `arrow-up-right`, `baby`, `bell`, `bell-ring`, `bike`, `book-open`, `briefcase`, `calendar`, `calendar-arrow-down`, `calendar-check`, `calendar-range`, `car`, `check`, `chevron-down`, `chevron-left`, `chevron-right`, `circle-alert`, `clock`, `compass`, `copy`, `download`, `eye`, `eye-off`, `file-clock`, `gift`, `headphones`, `heart`, `heart-handshake`, `history`, `hourglass`, `house`, `info`, `key-round`, `leaf`, `link`, `lock`, `log-out`, `map-pin`, `mic`, `palette`, `paw-print`, `pencil`, `phone`, `pin`, `plus`, `puzzle`, `qr-code`, `refresh-cw`, `repeat`, `rotate-cw`, `route`, `scale`, `scissors`, `search`, `send`, `settings`, `settings-2`, `shield`, `shopping-basket`, `sliders-horizontal`, `sparkle`, `sparkles`, `sprout`, `square-check`, `stethoscope`, `sun`, `sun-moon`, `sunrise`, `ticket`, `triangle-alert`, `user-plus`, `user-round`, `users`, `utensils`, `wifi-off`, `x`.

## 7. Componenti

Ogni componente ha la stessa classe qui, in `components.css`, in `design-system.html` (sezione con `id` uguale alla classe) e nelle schermate. Le misure sono i token che il componente usa in `components.css`.

### Elementi di base

#### `.frame-mobile` — Cornice mobile

- **Cosa:** Il telefono: 390 × 844 px. Ogni schermata mobile vive qui dentro; imposta font, colore e sfondo di base.
- **Anatomia:** `.frame-mobile` (radice)
- **Misure (token):** `--font-testo`, `--text-corpo-size`, `--text-corpo-line`, `--color-inchiostro`, `--color-carta`, `--size-frame-mobile`, `--size-frame-mobile-altezza`, `--space-0`, `--border-medio`, `--color-info`, `--space-half`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Il contenuto scorre in verticale; la barra in basso resta ferma.
- **Accessibilità:** Nessun ruolo: dentro ci sono header, main e nav veri.

#### `.frame-desktop` — Cornice desktop

- **Cosa:** Il browser desktop: 1280 × 800 px. Stesse regole di base della cornice mobile.
- **Anatomia:** `.frame-desktop` (radice)
- **Misure (token):** `--font-testo`, `--text-corpo-size`, `--text-corpo-line`, `--color-inchiostro`, `--color-carta`, `--size-frame-desktop`, `--size-frame-desktop-altezza`, `--space-0`, `--border-medio`, `--color-info`, `--space-half`, `--text-display-desktop-size`, `--text-display-desktop-line`, `--text-titolo-pagina-desktop-size`, `--text-titolo-pagina-desktop-line`, `--text-ora-xl-size`, `--text-ora-xl-line`, `--text-ora-xl-tracking`, `--text-ora-l-size`, `--text-ora-l-line`, `--space-3`, `--size-dialogo`, `--grid-margine-desktop`, `--space-8`, `--space-5`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Il contenuto è centrato fino a --grid-contenuto-max.
- **Accessibilità:** Come la cornice mobile.

#### `.tema-notte` — Tema notte

- **Cosa:** Variante scura di una schermata intera (accesso, invito). Si aggiunge alla cornice.
- **Anatomia:** `.tema-notte` (radice)
- **Misure (token):** `--color-notte`, `--color-latte`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Inverte carta e inchiostro: sfondo --color-notte, testo --color-latte.
- **Accessibilità:** Contrasti verificati: latte su notte 15,7:1, latte-2 su notte 8,5:1.
- **Dove si usa:** solo nel design system per ora

#### `.icona` — Icona

- **Cosa:** Icona Lucide a tratto, presa dallo sprite della pagina con <use href="#i-nome">.
- **Anatomia:** `.icona` (radice)
- **Misure (token):** `--size-icona-m`, `--border-medio`, `--size-icona-s`, `--size-icona-l`, `--color-latte-2`, `--color-inchiostro-2`, `--color-latte`, `--space-4`, `--color-allerta`, `--color-info`, `--color-ok`, `--color-avviso`
- **Varianti:** `.icona--l` 24 px, nei riquadri grandi; `.icona--s` 16 px, dentro chip, bottoni piccoli e testi
- **Stati:** Prende sempre il colore del testo (currentColor).
- **Comportamento:** Mai piena, mai colorata a mano: tratto --border-medio.
- **Accessibilità:** Decorativa: aria-hidden="true". Se è l’unico contenuto di un bottone, il nome va sul bottone (aria-label).
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.sprite-icone` — Sprite delle icone

- **Cosa:** Il blocco <svg> nascosto in cima a ogni pagina con le sole icone usate in quella pagina.
- **Anatomia:** `.sprite-icone` (radice)
- **Misure (token):** `--space-0`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Generato: nessuno lo scrive a mano.
- **Accessibilità:** aria-hidden="true".

#### `.visivamente-nascosto` — Testo solo per lettori di schermo

- **Cosa:** Testo che non si vede ma viene letto, per esempio «Caricamento in corso».
- **Anatomia:** `.visivamente-nascosto` (radice)
- **Misure (token):** `--border-sottile`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Da usare al posto di display:none quando il testo serve agli screen reader.
- **Dove si usa:** `06-onboarding-pronto`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `19-esplora`, `21-profilo-figlio`, `24-notifiche`, `25-ricerca`, `27-profilo`

#### `.membro-pomodoro`, `.membro-glicine`, `.membro-salvia`, `.membro-cobalto`, `.membro-zafferano`, `.membro-insieme` — Colore del membro

- **Cosa:** Classi membro-pomodoro, -glicine, -salvia, -cobalto, -zafferano e -insieme: impostano la variabile --c che avatar, adesivi e punti usano come fondo.
- **Anatomia:** `.membro-pomodoro` (radice)
- **Misure (token):** `--color-membro-pomodoro`, `--color-membro-glicine`, `--color-membro-salvia`, `--color-membro-cobalto`, `--color-membro-zafferano`, `--color-insieme`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Il colore di una persona compare solo nel suo avatar e nei punti del mese, mai su testi o schede.
- **Accessibilità:** Il colore non è mai l’unica informazione: c’è sempre l’iniziale o il nome.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.t-display`, `.t-titolo-pagina`, `.t-titolo-scheda`, `.t-frase`, `.t-numero`, `.t-sezione`, `.t-corpo-forte`, `.t-corpo`, `.t-controllo`, `.t-nota`, `.t-etichetta`, `.t-micro`, `.t-secondario`, `.t-forte`, `.t-allerta` — Testi

- **Cosa:** Classi di testo: t-display, t-titolo-pagina, t-titolo-scheda, t-frase, t-numero, t-sezione, t-corpo-forte, t-corpo, t-controllo, t-nota, t-etichetta, t-micro e i ritocchi t-secondario, t-forte, t-allerta.
- **Anatomia:** `.t-display` (radice)
- **Misure (token):** `--font-titoli`, `--weight-sottile`, `--text-display-size`, `--text-display-line`, `--text-display-tracking`, `--text-display-desktop-size`, `--text-display-desktop-line`, `--text-titolo-pagina-size`, `--text-titolo-pagina-line`, `--text-titolo-pagina-tracking`, `--text-titolo-pagina-desktop-size`, `--text-titolo-pagina-desktop-line`, `--weight-normale`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-titolo-scheda-tracking`, `--text-frase-size`, `--text-frase-line`, `--text-frase-tracking`, `--text-numero-size`, `--text-numero-line`, `--text-numero-tracking`, `--text-sezione-size`, `--text-sezione-line`, `--weight-forte`, `--text-corpo-forte-size`, `--text-corpo-forte-line`, `--text-corpo-size`, `--text-corpo-line`, `--text-controllo-size`, `--text-controllo-line`, `--weight-semi`, `--text-nota-size`, `--text-nota-line`, `--weight-medio`, `--text-etichetta-size`, `--text-etichetta-line`, `--text-etichetta-tracking`, `--text-micro-size`, `--text-micro-line`, `--color-inchiostro-2`, `--weight-pieno`, `--color-allerta`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Titoli e numeri in Parkinsans sottile, tutto il resto in Host Grotesk.
- **Accessibilità:** Gerarchia vera con h1/h2: la classe cambia l’aspetto, non il livello.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

### Navigazione

#### `.barra` — Barra in alto (mobile)

- **Cosa:** La testata delle schermate mobili: un elemento a sinistra, uno al centro, uno a destra.
- **Anatomia:** `.barra` (radice); `.barra__centro` (lente Io/Nest o titolo); `.barra__titolo` (titolo breve della schermata); `.barra__vuoto` (segnaposto quando a destra non c’è niente)
- **Misure (token):** `--size-controllo`, `--space-2`, `--space-3`, `--grid-margine-mobile`, `--space-0`, `--text-sezione-size`, `--text-sezione-line`, `--weight-forte`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Resta in alto mentre la pagina scorre.
- **Accessibilità:** È un <header>; il titolo, se c’è, è l’h1.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `24-notifiche`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.quadrato-nest` — Quadrato del Nest

- **Cosa:** Il quadrato con i colori della famiglia: apre il Nest (persone, Esplora, impostazioni). Sostituisce l’hamburger.
- **Anatomia:** `.quadrato-nest` (radice); `.quadrato-nest__punto` (quattro punti colorati, uno per persona)
- **Misure (token):** `--size-quadrato-nest`, `--radius-m`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--space-half`, `--space-2`, `--radius-tondo`, `--c`, `--color-notte-2`, `--size-bottone-s`, `--space-1`, `--radius-s`
- **Varianti:** `.quadrato-nest--notte` su fondi scuri
- **Stati:** Normale, premuto.
- **Comportamento:** Mobile: in alto a sinistra. Desktop: in alto a destra, ultimo.
- **Accessibilità:** È un link con aria-label «Apri Casa D’Angelo».
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.btn-icona` — Bottone icona

- **Cosa:** Bottone quadrato con sola icona: indietro, chiudi, cerca, notifiche, modifica.
- **Anatomia:** `.btn-icona` (radice); `.btn-icona__punto` (pallino rosso «ci sono novità»)
- **Misure (token):** `--size-controllo`, `--radius-m`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--color-inchiostro`, `--space-2`, `--size-pallino-urgente`, `--radius-tondo`, `--color-allerta`, `--space-half`, `--color-carta`, `--size-azione`, `--size-bottone-s`, `--radius-s`
- **Varianti:** `.btn-icona--carta` fondo carta invece di bianco, sopra le schede; `.btn-icona--piccolo` 32 px, dentro fogli e righe
- **Stati:** Normale, con punto, focus.
- **Comportamento:** Area di tocco minima 44 px anche quando il disegno è più piccolo.
- **Accessibilità:** aria-label obbligatorio, scritto come azione: «Indietro», «Chiudi».
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.nav-basso` — Navigazione in basso

- **Cosa:** Le tre sezioni (Oggi, Calendario, Casa) più il bottone Aggiungi. Solo mobile.
- **Anatomia:** `.nav-basso` (radice); `.nav-basso__voce` (icona e nome; .is-attiva per la sezione corrente); `.nav-basso__voci` (le tre voci in una capsula bianca)
- **Misure (token):** `--space-0`, `--z-nav`, `--size-cta-aggiungi`, `--space-2`, `--space-4`, `--grid-margine-mobile`, `--space-6`, `--color-carta`, `--size-barra`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--shadow-barra`, `--space-1`, `--text-micro-size`, `--text-micro-line`, `--weight-semi`, `--color-inchiostro-2`, `--color-inchiostro`, `--space-half`, `--radius-tondo`
- **Varianti:** nessuna
- **Stati:** Voce attiva (is-attiva + aria-current="page").
- **Comportamento:** Fissa in basso. Non compare nelle schermate di dettaglio aperte a tutto schermo.
- **Accessibilità:** <nav aria-label="Navigazione principale">.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `24-notifiche`

#### `.btn-aggiungi` — Bottone Aggiungi

- **Cosa:** Il nero «+ Aggiungi»: apre l’unico modulo per impegni, spesa, da fare e scadenze.
- **Anatomia:** `.btn-aggiungi` (radice); `.btn-aggiungi__piu` (quadratino con il +)
- **Misure (token):** `--size-barra`, `--radius-l`, `--color-inchiostro`, `--color-latte`, `--space-2`, `--text-corpo-forte-size`, `--weight-pieno`, `--size-etichetta`, `--radius-s`, `--size-controllo`, `--radius-m`, `--space-0`, `--space-4`, `--text-controllo-size`
- **Varianti:** `.btn-aggiungi--desktop` versione in testata desktop, più bassa
- **Stati:** Normale, premuto.
- **Comportamento:** Sempre visibile nelle tre sezioni.
- **Accessibilità:** Link con testo visibile «Aggiungi».
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `24-notifiche`

#### `.nav-alto` — Navigazione desktop

- **Cosa:** La testata desktop: logo, le tre sezioni al centro, cerca, notifiche e quadrato del Nest a destra.
- **Anatomia:** `.nav-alto` (radice); `.nav-alto__azioni` (cerca, notifiche, Nest); `.nav-alto__logo` (FamilyNest, porta a Oggi); `.nav-alto__voce` (una sezione); `.nav-alto__voci` (selettore delle sezioni)
- **Misure (token):** `--size-nav-desktop`, `--size-menu-desktop`, `--space-0`, `--grid-margine-desktop`, `--border-sottile`, `--color-filo`, `--color-carta`, `--font-titoli`, `--weight-medio`, `--text-titolo-scheda-size`, `--text-titolo-scheda-tracking`, `--space-1`, `--size-controllo`, `--radius-m`, `--color-superficie`, `--space-2`, `--space-4`, `--radius-s`, `--text-controllo-size`, `--weight-semi`, `--color-inchiostro-2`, `--color-inchiostro`, `--color-latte`
- **Varianti:** nessuna
- **Stati:** Voce attiva.
- **Comportamento:** Fissa in alto. Sostituisce barra e nav-basso da 1024 px.
- **Accessibilità:** <header> con dentro <nav aria-label="Navigazione principale">.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.menu-laterale` — Menu laterale (impostazioni)

- **Cosa:** Elenco verticale a sinistra nelle pagine di impostazioni su desktop.
- **Anatomia:** `.menu-laterale` (radice); `.menu-laterale__separatore` (filo tra gruppi); `.menu-laterale__voce` (icona e nome; .is-attiva per la pagina corrente)
- **Misure (token):** `--space-1`, `--size-tocco`, `--space-3`, `--space-0`, `--radius-m`, `--text-controllo-size`, `--weight-semi`, `--color-inchiostro-2`, `--color-superficie`, `--color-inchiostro`, `--border-sottile`, `--color-filo`, `--space-2`
- **Varianti:** nessuna
- **Stati:** Voce attiva.
- **Comportamento:** Su mobile non esiste: ogni voce è una riga del Nest.
- **Accessibilità:** <nav aria-label="Impostazioni">, aria-current sulla voce attiva.
- **Dove si usa:** `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.selettore` — Selettore

- **Cosa:** Capsula con 2–5 voci in cui una sola è scelta: Giorno/Settimana/Mese, filtri di Casa, visibilità.
- **Anatomia:** `.selettore` (radice); `.selettore__conteggio` (numero accanto alla voce); `.selettore__voce` (una scelta; aria-pressed="true" per quella attiva)
- **Misure (token):** `--size-controllo`, `--space-1`, `--radius-m`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--radius-s`, `--space-0`, `--space-2`, `--text-controllo-size`, `--weight-semi`, `--color-inchiostro-2`, `--color-inchiostro`, `--color-latte`, `--text-etichetta-size`, `--weight-forte`, `--opacity-passato`, `--color-carta`, `--shadow-scheda`
- **Varianti:** `.selettore--carta` fondo carta, sopra superfici bianche
- **Stati:** Voce scelta, voce normale, focus.
- **Comportamento:** Cambia la vista sul posto, non apre una nuova pagina (salvo dove indicato).
- **Accessibilità:** Gruppo con aria-label; ogni voce è un <button aria-pressed>.
- **Dove si usa:** `03-onboarding-persone`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `26-calendari-collegati`, `28-impostazioni-nest`

#### `.lente` — Lente Io / Nest

- **Cosa:** Selettore speciale di Oggi e Calendario: «Io» mostra le mie cose, «Nest» quelle di tutta la casa.
- **Anatomia:** `.lente` (radice)
- **Misure (token):** `--size-cta-aggiungi`, `--size-controllo`, `--space-2`, `--color-superficie`, `--color-inchiostro`
- **Varianti:** nessuna
- **Stati:** Io (predefinita all’apertura), Nest.
- **Comportamento:** Ricorda l’ultima scelta solo nella sessione; si apre sempre su «Io».
- **Accessibilità:** Come il selettore; gli avatar dentro sono decorativi.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`

#### `.periodo` — Periodo del calendario

- **Cosa:** Il titolo del periodo («Ottobre 2026», «19 – 25 ottobre») con le frecce avanti e indietro.
- **Anatomia:** `.periodo` (radice); `.periodo__frecce` (due bottoni icona)
- **Misure (token):** `--space-3`, `--space-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Le frecce spostano di un giorno, una settimana o un mese secondo la vista.
- **Accessibilità:** Il periodo è l’h1; le frecce hanno aria-label «Settimana precedente» e «Settimana successiva».
- **Dove si usa:** `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`

#### `.tacche-passi` — Tacche dei passi

- **Cosa:** Avanzamento dell’onboarding: una tacca per passo.
- **Anatomia:** `.tacche-passi` (radice); `.tacche-passi__tacca` (un passo; .is-fatta quando è completato)
- **Misure (token):** `--space-1`, `--size-tacca`, `--space-half`, `--color-filo-2`, `--color-inchiostro`
- **Varianti:** nessuna
- **Stati:** Passo fatto, passo da fare.
- **Comportamento:** Non cliccabile.
- **Accessibilità:** role="progressbar" con aria-valuenow e aria-valuemax.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`

### Layout e intestazioni

#### `.pagina` — Pagina mobile

- **Cosa:** Il <main> delle schermate mobili: margini laterali, colonna unica, spazio per la nav in basso.
- **Anatomia:** `.pagina` (radice)
- **Misure (token):** `--space-6`, `--space-5`, `--grid-margine-mobile`, `--space-3`
- **Varianti:** `.pagina--stretta-alto` meno spazio in cima, sotto una barra con titolo
- **Stati:** —
- **Comportamento:** Colonna unica che non può mai uscire dai margini.
- **Accessibilità:** È il <main>.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.pagina-desktop` — Pagina desktop

- **Cosa:** Il <main> desktop: margini di 40 px e larghezza massima 1200 px.
- **Anatomia:** `.pagina-desktop` (radice)
- **Misure (token):** `--space-6`, `--space-8`, `--grid-margine-desktop`, `--grid-contenuto-max`, `--grid-colonna-stretta`, `--space-0`
- **Varianti:** `.pagina-desktop--centrata` colonna stretta di 720 px al centro, per dettagli e moduli
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** È il <main>.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.colonne` — Colonne desktop

- **Cosa:** Le griglie delle pagine desktop.
- **Anatomia:** `.colonne` (radice)
- **Misure (token):** `--grid-gutter`, `--size-menu-desktop`, `--size-pannello-desktop`
- **Varianti:** `.colonne--due` due colonne uguali; `.colonne--menu` menu laterale + contenuto; `.colonne--pannello` contenuto + pannello di 320 px a destra; `.colonne--tre` tre colonne uguali (Casa)
- **Stati:** —
- **Comportamento:** Sotto 1024 px diventano una colonna sola.
- **Accessibilità:** Ordine nel codice = ordine di lettura.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `21-profilo-figlio`, `23-lista-desideri-pubblica`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.colonna` — Colonna

- **Cosa:** Una colonna dentro .colonne: impila sezioni con 24 px di distanza.
- **Anatomia:** `.colonna` (radice)
- **Misure (token):** `--space-6`, `--space-0`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `21-profilo-figlio`, `23-lista-desideri-pubblica`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.intestazione-desktop` — Intestazione desktop

- **Cosa:** Riga in cima alla pagina desktop: titolo a sinistra, azioni a destra.
- **Anatomia:** `.intestazione-desktop` (radice)
- **Misure (token):** `--space-6`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Il titolo dentro è l’h1.
- **Dove si usa:** `09-oggi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `24-notifiche`

#### `.intestazione` — Intestazione

- **Cosa:** Titolo di pagina con una riga sopra (data, contesto) e una sotto (spiegazione).
- **Anatomia:** `.intestazione` (radice); `.intestazione__sopra` (riga piccola sopra il titolo); `.intestazione__sotto` (riga di spiegazione); `.intestazione__titolo` (il titolo (h1))
- **Misure (token):** `--space-2`, `--text-nota-size`, `--text-nota-line`, `--weight-medio`, `--color-inchiostro-2`, `--weight-semi`, `--text-controllo-size`, `--text-controllo-line`
- **Varianti:** `.intestazione--centro` centrata, per schermate vuote o di benvenuto
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Il titolo è sempre l’h1 della schermata.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `19-esplora`, `21-profilo-figlio`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `29-membro`

#### `.sezione` — Sezione

- **Cosa:** Un blocco della pagina con il suo titolo e un’informazione o un link a destra.
- **Anatomia:** `.sezione` (radice); `.sezione__info` (informazione o link a destra; __info--allerta in rosso); `.sezione__testa` (riga del titolo); `.sezione__titolo` (titolo (h2))
- **Misure (token):** `--space-2`, `--space-6`, `--space-3`, `--text-sezione-size`, `--text-sezione-line`, `--weight-forte`, `--text-nota-size`, `--text-nota-line`, `--weight-medio`, `--color-inchiostro-2`, `--color-allerta`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** <section> con h2.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.sottotitolo-gruppo` — Sottotitolo di gruppo

- **Cosa:** Piccolo titolo che divide una lista in gruppi («Questa settimana», «Più avanti»).
- **Anatomia:** `.sottotitolo-gruppo` (radice)
- **Misure (token):** `--text-nota-size`, `--weight-forte`, `--color-inchiostro-2`, `--space-0`, `--space-1`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** È un h3 o un <p> secondo il livello.
- **Dove si usa:** `10-aggiungi`

#### `.split-onboarding` — Schermo diviso (onboarding desktop)

- **Cosa:** Su desktop l’onboarding ha un lato scuro con gli adesivi e il claim, e il passo a destra.
- **Anatomia:** `.split-onboarding` (radice); `.split-onboarding__notte` (metà scura); `.split-onboarding__passo` (metà chiara con il modulo)
- **Misure (token):** `--color-notte`, `--color-latte`, `--space-12`, `--space-8`, `--space-16`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Su mobile resta solo il passo.
- **Accessibilità:** Il lato scuro è decorativo tranne il claim.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`

#### `.passo-onboarding` — Passo di onboarding

- **Cosa:** Il contenuto di un passo: tacche, titolo, domanda, scelte e bottone in fondo.
- **Anatomia:** `.passo-onboarding` (radice); `.passo-onboarding__testa` (indietro + tacche)
- **Misure (token):** `--space-5`, `--space-3`, `--grid-margine-mobile`, `--space-6`, `--size-controllo`, `--space-4`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Il bottone principale resta in fondo alla schermata.
- **Accessibilità:** Il titolo del passo è l’h1.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`

#### `.schermo-notte` — Schermo notte

- **Cosa:** Il contenuto centrato delle schermate scure (accesso, benvenuto).
- **Anatomia:** `.schermo-notte` (radice)
- **Misure (token):** `--space-6`, `--space-4`, `--grid-margine-mobile`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `01-accesso`, `06-onboarding-pronto`, `07-invito-benvenuto`

#### `.profilo-testa` — Testa del profilo

- **Cosa:** Avatar grande, nome e una riga di dettaglio in cima a un profilo.
- **Anatomia:** `.profilo-testa` (radice)
- **Misure (token):** `--space-3`, `--space-5`
- **Varianti:** `.profilo-testa--riga` su desktop avatar e testo affiancati
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Il nome è l’h1; l’avatar è decorativo.
- **Dove si usa:** `21-profilo-figlio`, `22-lista-desideri`, `27-profilo`, `29-membro`

### Schede

#### `.scheda` — Scheda

- **Cosa:** Il contenitore bianco di base, con raggio 16 px.
- **Anatomia:** `.scheda` (radice)
- **Misure (token):** `--color-superficie`, `--radius-l`, `--border-sottile`, `--color-filo`, `--space-4`, `--space-3`, `--border-evidenza`, `--color-inchiostro`, `--color-notte`, `--color-latte`, `--border-medio`, `--color-filo-2`, `--color-carta`
- **Varianti:** `.scheda--carta` fondo carta, dentro altre superfici bianche; `.scheda--evidenza` filo nero di 3 px in cima: «il prossimo»; `.scheda--imbottita` con spazio interno, per testi e moduli; `.scheda--scura` fondo notte, testo latte; `.scheda--tratteggiata` bordo tratteggiato per «aggiungi qualcosa»
- **Stati:** —
- **Comportamento:** Le schede non hanno ombra: si staccano dal fondo carta solo con il colore.
- **Accessibilità:** Nessun ruolo.
- **Dove si usa:** `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.prossimo` — Il prossimo

- **Cosa:** La scheda in cima a Oggi: l’impegno che arriva, con l’ora grande.
- **Anatomia:** `.prossimo` (radice); `.prossimo__alto` (etichetta e fonte); `.prossimo__azioni` (bottoni tenui (indicazioni, scrivi)); `.prossimo__dati` (titolo e informazioni); `.prossimo__info` (dove e con chi); `.prossimo__nota` («tra 1 h 8 min», stesso stile del testo); `.prossimo__ora` (ora grande in Parkinsans sottile); `.prossimo__titolo` (titolo dell’impegno)
- **Misure (token):** `--space-5`, `--space-4`, `--font-titoli`, `--weight-sottile`, `--text-ora-l-size`, `--text-ora-l-line`, `--text-ora-l-tracking`, `--text-ora-xl-size`, `--text-ora-xl-line`, `--text-ora-xl-tracking`, `--space-half`, `--space-0`, `--space-2`, `--weight-normale`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-titolo-scheda-tracking`, `--text-nota-size`, `--text-nota-line`, `--color-inchiostro-2`, `--space-3`, `--border-sottile`, `--color-filo`
- **Varianti:** nessuna
- **Stati:** Normale; vuoto quando non c’è niente oggi.
- **Comportamento:** Tocco sulla scheda → dettaglio impegno.
- **Accessibilità:** L’intera scheda è un link; le azioni interne sono bottoni separati.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `25-ricerca`

#### `.griglia-contatori` — Griglia dei contatori

- **Cosa:** Riga di contatori sotto il prossimo.
- **Anatomia:** `.griglia-contatori` (radice)
- **Misure (token):** `--space-2`
- **Varianti:** `.griglia-contatori--quattro` quattro contatori (desktop); `.griglia-contatori--tre` tre contatori
- **Stati:** —
- **Comportamento:** Su mobile scorre in orizzontale se non c’è spazio.
- **Accessibilità:** Lista <ul>.
- **Dove si usa:** `09-oggi`, `21-profilo-figlio`

#### `.contatore` — Contatore

- **Cosa:** Un numero grande con cosa conta: «3 da fare», «14 giorni al certificato».
- **Anatomia:** `.contatore` (radice); `.contatore__etichetta` (cosa conta); `.contatore__info` (riga sotto; pallino rosso se è urgente); `.contatore__numero` (il numero)
- **Misure (token):** `--space-4`, `--space-2`, `--size-contatore`, `--text-nota-size`, `--weight-forte`, `--font-titoli`, `--weight-sottile`, `--text-numero-size`, `--text-numero-line`, `--text-numero-tracking`, `--text-nota-line`, `--color-inchiostro-2`, `--space-3`, `--space-half`, `--text-numero-s-size`, `--text-numero-s-line`
- **Varianti:** `.contatore--piccolo` numero da 30 px
- **Stati:** Normale, urgente (pallino-urgente).
- **Comportamento:** Tocco → la lista corrispondente.
- **Accessibilità:** Link con testo completo («3 da fare in casa»).
- **Dove si usa:** `09-oggi`, `21-profilo-figlio`

#### `.griglia-moduli` — Griglia degli spazi (Esplora)

- **Cosa:** La griglia dei 10 spazi di Esplora.
- **Anatomia:** `.griglia-moduli` (radice)
- **Misure (token):** `--space-2`, `--space-3`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** 2 colonne su mobile, 4 su desktop; riempie i buchi (dense).
- **Accessibilità:** Lista <ul>.
- **Dove si usa:** `19-esplora`

#### `.scheda-modulo` — Scheda spazio (Esplora)

- **Cosa:** Uno spazio di Esplora: icona, nome ispirazionale e promessa in una riga.
- **Anatomia:** `.scheda-modulo` (radice); `.scheda-modulo__alto` (icona e puntina); `.scheda-modulo__icona` (riquadro con l’icona); `.scheda-modulo__promessa` (cosa ti dà, in una frase); `.scheda-modulo__titolo` (nome dello spazio)
- **Misure (token):** `--space-4`, `--size-modulo`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--color-inchiostro`, `--color-notte`, `--color-latte`, `--size-controllo`, `--radius-m`, `--color-carta`, `--color-notte-2`, `--font-titoli`, `--weight-normale`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-titolo-scheda-tracking`, `--weight-sottile`, `--text-titolo-pagina-size`, `--text-titolo-pagina-line`, `--text-nota-size`, `--text-nota-line`, `--color-inchiostro-2`, `--space-1`, `--color-latte-2`
- **Varianti:** `.scheda-modulo--largo` occupa due colonne; `.scheda-modulo--scura` fondo notte, per lo spazio in evidenza
- **Stati:** Normale, fissato (puntina piena).
- **Comportamento:** Tocco → pagina dello spazio.
- **Accessibilità:** Link; la puntina è un bottone separato con aria-pressed.
- **Dove si usa:** `19-esplora`

#### `.puntina` — Puntina

- **Cosa:** Fissa uno spazio in fondo a Oggi.
- **Anatomia:** `.puntina` (radice)
- **Misure (token):** `--size-bottone-s`, `--radius-s`, `--color-inchiostro-2`, `--color-inchiostro`, `--color-latte`, `--color-latte-2`
- **Varianti:** nessuna
- **Stati:** Fissato (aria-pressed="true"), non fissato.
- **Comportamento:** Tocco → fissa o toglie, con toast.
- **Accessibilità:** aria-label «Fissa A tavola in Oggi».
- **Dove si usa:** `19-esplora`

#### `.porta` — Porta

- **Cosa:** Grande scheda scura che porta in un’altra parte dell’app (Esplora dal Nest).
- **Anatomia:** `.porta` (radice); `.porta__freccia` (bottone freccia); `.porta__info` (riga sotto); `.porta__sopra` (parola piccola maiuscola); `.porta__titolo` (frase)
- **Misure (token):** `--space-3`, `--space-5`, `--space-4`, `--radius-l`, `--color-notte`, `--color-latte`, `--size-porta`, `--text-etichetta-size`, `--weight-forte`, `--tracking-maiuscolo`, `--color-latte-2`, `--space-2`, `--font-titoli`, `--weight-sottile`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-titolo-scheda-tracking`, `--text-nota-size`, `--space-1`, `--size-tocco`, `--radius-m`, `--color-inchiostro`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Tutta la scheda è cliccabile.
- **Accessibilità:** Link unico.
- **Dove si usa:** `18-nest`

#### `.spazi-fissati` — I tuoi spazi

- **Cosa:** In fondo a Oggi: gli spazi di Esplora che hai fissato.
- **Anatomia:** `.spazi-fissati` (radice)
- **Misure (token):** `--space-2`
- **Varianti:** nessuna
- **Stati:** Vuoto: la sezione non compare.
- **Comportamento:** —
- **Accessibilità:** Lista <ul>.
- **Dove si usa:** `09-oggi`

#### `.scheda-spazio` — Spazio fissato

- **Cosa:** Uno spazio fissato in Oggi: icona, nome, una riga.
- **Anatomia:** `.scheda-spazio` (radice); `.scheda-spazio__icona` (icona); `.scheda-spazio__info` (riga sotto); `.scheda-spazio__titolo` (nome)
- **Misure (token):** `--size-bottone-icona`, `--space-3`, `--size-riga-alta`, `--radius-m`, `--color-carta`, `--text-controllo-size`, `--weight-forte`, `--text-etichetta-size`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Tocco → pagina dello spazio.
- **Accessibilità:** Link.
- **Dove si usa:** `09-oggi`

#### `.sintesi` — Sintesi del mattino

- **Cosa:** La frase che riassume la giornata. Vive nelle Notifiche, non in Oggi.
- **Anatomia:** `.sintesi` (radice); `.sintesi__azioni` (azioni); `.sintesi__frase` (la frase, con le parole chiave); `.sintesi__sopra` (ora di invio)
- **Misure (token):** `--space-5`, `--space-4`, `--space-3`, `--text-etichetta-size`, `--weight-forte`, `--color-inchiostro-2`, `--font-titoli`, `--weight-sottile`, `--text-frase-size`, `--text-frase-line`, `--text-frase-tracking`, `--space-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Testo normale; le parole chiave non sono link.
- **Dove si usa:** `09-oggi`, `24-notifiche`

#### `.parola` — Parola chiave

- **Cosa:** Una parola evidenziata dentro una frase, con avatar se è una persona.
- **Anatomia:** `.parola` (radice)
- **Misure (token):** `--color-inchiostro`, `--color-carta`, `--radius-s`, `--space-0`, `--space-1`, `--color-insieme`, `--color-insieme-testo`, `--border-sottile`, `--color-insieme-bordo`
- **Varianti:** `.parola--insieme` giallo «Liberi insieme»
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Testo normale.
- **Dove si usa:** `09-oggi`, `24-notifiche`

#### `.tabella-dati` — Tabella dei dati

- **Cosa:** Coppie etichetta/valore nel dettaglio di un impegno (Dove, Ripete, La porta…).
- **Anatomia:** `.tabella-dati` (radice)
- **Misure (token):** `--size-colonna-dati`, `--space-3`, `--space-0`, `--border-sottile`, `--color-filo`, `--text-nota-size`, `--color-inchiostro-2`, `--space-half`, `--text-corpo-size`, `--weight-semi`, `--space-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Lista di definizioni <dl>.
- **Dove si usa:** `11-dettaglio-impegno`

#### `.riga-opzione` — Riga opzione

- **Cosa:** Una riga con nome a sinistra e valore a destra dentro un modale.
- **Anatomia:** `.riga-opzione` (radice); `.riga-opzione__nome` (nome); `.riga-opzione__valore` (valore)
- **Misure (token):** `--size-icona-m`, `--space-3`, `--size-azione`, `--space-0`, `--space-1`, `--border-sottile`, `--color-filo`, `--text-controllo-size`, `--color-inchiostro`, `--color-inchiostro-2`, `--weight-semi`, `--space-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `10-aggiungi`

### Righe e liste

#### `.riga-evento` — Riga evento

- **Cosa:** Un impegno in lista: ora a sinistra, titolo e dettagli, persone a destra.
- **Anatomia:** `.riga-evento` (radice); `.riga-evento__info` (dove, chi lo porta, fonte); `.riga-evento__ora` (ora d’inizio); `.riga-evento__testo` (titolo e info); `.riga-evento__titolo` (titolo)
- **Misure (token):** `--size-colonna-ora`, `--space-3`, `--size-riga-alta`, `--space-4`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--color-inchiostro`, `--font-titoli`, `--weight-normale`, `--text-ora-riga-size`, `--text-ora-riga-line`, `--text-ora-riga-tracking`, `--space-half`, `--space-0`, `--text-corpo-forte-size`, `--text-corpo-forte-line`, `--weight-forte`, `--space-2`, `--text-nota-size`, `--text-nota-line`, `--color-inchiostro-2`, `--color-insieme`, `--color-insieme-bordo`, `--color-insieme-testo`, `--color-occupato-1`, `--size-riga-occupato`, `--color-occupato-2`, `--weight-semi`, `--opacity-passato`, `--size-riga`, `--border-medio`
- **Varianti:** `.riga-evento--attiva` scelta nel pannello (filo a sinistra); `.riga-evento--compatta` più bassa, nel pannello desktop; `.riga-evento--insieme` giallo «Liberi insieme»; `.riga-evento--occupato` righe diagonali grigie: «Occupato», senza dettagli; `.riga-evento--passato` già finito, al 50%
- **Stati:** Normale, passato, attivo.
- **Comportamento:** Tocco → 11-dettaglio-impegno. Gli «Occupato» non si aprono.
- **Accessibilità:** Link; le persone sono lette dal testo, non dagli avatar.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `14-calendario-mese`, `25-ricerca`

#### `.riga-gia-fatti` — Già fatti (riassunto)

- **Cosa:** Riga che raccoglie gli impegni già passati di oggi («3 già fatti»).
- **Anatomia:** `.riga-gia-fatti` (radice)
- **Misure (token):** `--size-colonna-ora`, `--space-3`, `--space-12`, `--space-0`, `--space-4`, `--radius-m`, `--border-sottile`, `--color-filo`, `--text-nota-size`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** Chiusa, aperta.
- **Comportamento:** Tocco → mostra le righe passate.
- **Accessibilità:** <button aria-expanded>.
- **Dove si usa:** `09-oggi`

#### `.lista` — Lista

- **Cosa:** Il contenitore <ul> delle righe, dentro una scheda; un filo separa le righe.
- **Anatomia:** `.lista` (radice)
- **Misure (token):** `--border-sottile`, `--color-filo`, `--color-notte-2`
- **Varianti:** `.lista--notte` su fondo scuro
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** <ul>, una <li> per riga.
- **Dove si usa:** `03-onboarding-persone`, `04-onboarding-calendario`, `06-onboarding-pronto`, `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.riga-lista` — Riga di lista

- **Cosa:** La riga generica: un elemento a sinistra (icona, casella, avatar, ora), testi, un valore a destra.
- **Anatomia:** `.riga-lista` (radice); `.riga-lista__info` (riga sotto; __info--allerta in rosso); `.riga-lista__lucchetto` (icona «solo io»); `.riga-lista__ora` (giorno o ora a sinistra); `.riga-lista__quantita` (quantità nella spesa); `.riga-lista__testo` (titolo e info); `.riga-lista__titolo` (titolo); `.riga-lista__valore` (valore o freccia a destra)
- **Misure (token):** `--space-3`, `--size-riga`, `--space-2`, `--space-4`, `--color-inchiostro`, `--border-sottile`, `--color-filo`, `--space-half`, `--space-0`, `--text-corpo-forte-size`, `--text-corpo-forte-line`, `--weight-semi`, `--text-nota-size`, `--text-nota-line`, `--color-inchiostro-2`, `--color-allerta`, `--text-controllo-size`, `--font-titoli`, `--weight-normale`, `--text-ora-riga-size`, `--size-colonna-ora`, `--border-medio`, `--weight-medio`, `--color-latte`, `--color-notte-2`, `--color-latte-2`, `--radius-m`, `--color-superficie`
- **Varianti:** `.riga-lista--cliccabile` tutta la riga apre qualcosa; `.riga-lista--fatto` barrata, al 50% (spesa presa, da fare fatto); `.riga-lista--notte` su fondo scuro; `.riga-lista--preso` regalo già preso; `.riga-lista--senza-inizio` senza elemento a sinistra
- **Stati:** Normale, fatto, premuto, focus.
- **Comportamento:** Se è cliccabile è un <a> o un <button>; i controlli dentro (casella, interruttore) non stanno mai dentro un altro bottone.
- **Accessibilità:** Altezza minima 56 px; un solo elemento interattivo principale per riga.
- **Dove si usa:** `03-onboarding-persone`, `04-onboarding-calendario`, `06-onboarding-pronto`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.icona-riquadro` — Icona in riquadro

- **Cosa:** Icona dentro un quadrato carta all’inizio di una riga.
- **Anatomia:** `.icona-riquadro` (radice)
- **Misure (token):** `--size-bottone-icona`, `--radius-m`, `--color-carta`, `--color-inchiostro`, `--color-insieme`, `--border-sottile`, `--color-insieme-bordo`, `--color-insieme-testo`, `--color-notte-2`, `--color-latte`
- **Varianti:** `.icona-riquadro--insieme` giallo; `.icona-riquadro--scura` fondo notte
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Decorativa.
- **Dove si usa:** `04-onboarding-calendario`, `12-calendario-settimana`, `13-calendario-giorno`, `18-nest`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `24-notifiche`, `25-ricerca`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.riga-scadenza` — Riga scadenza

- **Cosa:** Una scadenza: quanti giorni mancano in grande a sinistra, cosa e quando.
- **Anatomia:** `.riga-scadenza` (radice); `.riga-scadenza__giorni` (colonna dei giorni); `.riga-scadenza__numero` (il numero); `.riga-scadenza__unita` (giorni o mesi)
- **Misure (token):** `--size-colonna-giorni`, `--space-3`, `--size-scelta`, `--space-4`, `--border-sottile`, `--color-filo`, `--space-1`, `--space-2`, `--font-titoli`, `--weight-sottile`, `--text-numero-m-size`, `--text-numero-m-line`, `--text-numero-tracking`, `--text-etichetta-size`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** Normale, urgente (numero rosso e pallino).
- **Comportamento:** Tocco → dettaglio della scadenza.
- **Accessibilità:** Il testo dice «tra 14 giorni», non solo «14».
- **Dove si usa:** `10-aggiungi`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `22-lista-desideri`

#### `.riga-notifica` — Riga notifica

- **Cosa:** Una notifica: avatar o icona, testo, ora, azioni rapide.
- **Anatomia:** `.riga-notifica` (radice); `.riga-notifica__azioni` (bottoni (Lo porto io, Rispondi)); `.riga-notifica__ora` (quando); `.riga-notifica__testo` (testo)
- **Misure (token):** `--size-bottone-icona`, `--space-3`, `--space-4`, `--border-sottile`, `--color-filo`, `--text-controllo-size`, `--text-controllo-line`, `--color-inchiostro-2`, `--weight-normale`, `--color-inchiostro`, `--weight-forte`, `--text-etichetta-size`, `--space-2`, `--space-1`, `--space-6`, `--size-pallino`, `--radius-tondo`, `--color-allerta`
- **Varianti:** nessuna
- **Stati:** Nuova (is-nuova, pallino), letta.
- **Comportamento:** Tocco → la cosa di cui parla.
- **Accessibilità:** Le nuove hanno «nuova» nel testo nascosto.
- **Dove si usa:** `24-notifiche`

#### `.riga-regalo` — Riga regalo

- **Cosa:** Un’idea della lista desideri in elenco.
- **Anatomia:** `.riga-regalo` (radice); `.riga-regalo__prezzo` (prezzo); `.riga-regalo__titolo` (nome)
- **Misure (token):** `--size-foto`, `--space-3`, `--space-5`, `--space-2`, `--border-sottile`, `--color-filo`, `--font-titoli`, `--weight-normale`, `--text-sezione-size`, `--color-inchiostro-2`, `--border-medio`, `--opacity-passato`, `--text-corpo-forte-size`, `--text-corpo-forte-line`, `--weight-forte`
- **Varianti:** `.riga-regalo--barrato` barrato (vista dei genitori); `.riga-regalo--preso` qualcuno l’ha preso
- **Stati:** Libero, preso.
- **Comportamento:** —
- **Accessibilità:** Lo stato «preso» è scritto, non solo barrato.
- **Dove si usa:** `22-lista-desideri`, `23-lista-desideri-pubblica`

#### `.foto` — Foto

- **Cosa:** Riquadro immagine del regalo (segnaposto carta-2 finché non c’è).
- **Anatomia:** `.foto` (radice)
- **Misure (token):** `--opacity-passato`, `--size-foto`, `--radius-m`, `--color-carta-2`, `--color-inchiostro-2`, `--size-foto-scheda`, `--space-0`
- **Varianti:** nessuna
- **Stati:** Con foto, segnaposto.
- **Comportamento:** —
- **Accessibilità:** alt descrittivo o vuoto se decorativa.
- **Dove si usa:** `22-lista-desideri`, `23-lista-desideri-pubblica`

#### `.scheda-regalo` — Scheda regalo

- **Cosa:** Il regalo nella lista pubblica: foto, nome, prezzo, bottone «Lo prendo io».
- **Anatomia:** `.scheda-regalo` (radice); `.scheda-regalo__info` (nome e prezzo); `.scheda-regalo__piede` (bottone o stato)
- **Misure (token):** `--size-foto-scheda`, `--space-0`, `--space-4`, `--space-2`, `--opacity-passato`, `--color-inchiostro-2`
- **Varianti:** `.scheda-regalo--preso` già preso da qualcuno
- **Stati:** Libero, preso.
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `23-lista-desideri-pubblica`

#### `.strappo` — Strappo

- **Cosa:** In Spesa: la linea «Strappa qui» che separa da comprare e presi.
- **Anatomia:** `.strappo` (radice); `.strappo__lama` (forbice); `.strappo__linea` (linea tratteggiata); `.strappo__testo` (testo al centro)
- **Misure (token):** `--size-riga`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--size-tocco`, `--space-5`, `--space-4`, `--border-medio`, `--color-filo-2`, `--text-controllo-line`, `--space-0`, `--space-2`, `--text-nota-size`, `--weight-forte`, `--color-inchiostro-2`, `--space-1`, `--radius-m`, `--color-inchiostro`, `--color-latte`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Tocco → svuota i presi (con Annulla).
- **Accessibilità:** <button> con testo «Togli i presi».
- **Dove si usa:** `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`

### Persone, etichette e chip

#### `.avatar` — Avatar

- **Cosa:** Cerchio con l’iniziale nel colore della persona: l’unico posto dove compare il colore.
- **Anatomia:** `.avatar` (radice)
- **Misure (token):** `--color-superficie`, `--color-inchiostro`, `--space-1`, `--color-insieme`, `--color-occupato-1`, `--size-avatar-s`, `--radius-tondo`, `--c`, `--font-titoli`, `--weight-semi`, `--text-avatar-s-size`, `--size-avatar-xs`, `--text-avatar-xs-size`, `--size-avatar-m`, `--text-avatar-m-size`, `--size-avatar-l`, `--text-avatar-l-size`, `--size-avatar-xl`, `--text-avatar-xl-size`, `--size-punto-membro`, `--space-0`, `--border-medio`, `--color-latte-2`, `--space-half`, `--anello`, `--space-3`, `--color-notte`, `--border-sottile`, `--color-carta`, `--color-avatar-su-colore`, `--size-controllo`
- **Varianti:** `.avatar--l` 44 px, righe del Nest; `.avatar--m` 32 px; `.avatar--punto` 9 px senza lettera, sotto i giorni del mese; `.avatar--vuoto` tratteggiato: persona non ancora entrata; `.avatar--xl` 72 px, profili; `.avatar--xs` 18 px, dentro chip e testi
- **Stati:** —
- **Comportamento:** La taglia predefinita è 24 px.
- **Accessibilità:** aria-hidden se il nome è già scritto accanto, altrimenti role="img" con il nome.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `25-ricerca`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.avatar-gruppo` — Gruppo di avatar

- **Cosa:** Più avatar sovrapposti: chi partecipa.
- **Anatomia:** `.avatar-gruppo` (radice)
- **Misure (token):** `--space-half`, `--anello`, `--space-1`, `--space-3`, `--color-notte`
- **Varianti:** `.avatar-gruppo--grande` sovrapposizione larga (onboarding); `.avatar-gruppo--notte` anello scuro su fondi notte
- **Stati:** —
- **Comportamento:** Oltre 4 persone si scrive «Tutto il Nest».
- **Accessibilità:** aria-label con i nomi.
- **Dove si usa:** `06-onboarding-pronto`, `07-invito-benvenuto`, `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `19-esplora`

#### `.etichetta` — Etichetta

- **Cosa:** Piccola capsula di testo: fonte, tipo, stato.
- **Anatomia:** `.etichetta` (radice)
- **Misure (token):** `--space-1`, `--space-6`, `--space-0`, `--space-2`, `--radius-s`, `--color-carta`, `--text-etichetta-size`, `--weight-forte`, `--color-inchiostro-2`, `--size-icona-m`, `--radius-xs`, `--text-micro-size`, `--color-inchiostro`, `--color-latte`, `--color-allerta`, `--color-bianco`, `--color-insieme`, `--color-insieme-testo`, `--border-sottile`, `--color-insieme-bordo`
- **Varianti:** `.etichetta--allerta` rossa, con testo bianco; `.etichetta--insieme` gialla; `.etichetta--piccola` più bassa, dentro le righe; `.etichetta--scura` nera
- **Stati:** —
- **Comportamento:** Non è cliccabile.
- **Accessibilità:** Testo leggibile, mai solo colore.
- **Dove si usa:** `04-onboarding-calendario`, `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `14-calendario-mese`, `20-esplora-spazio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `25-ricerca`, `28-impostazioni-nest`

#### `.pallino-urgente` — Pallino urgente

- **Cosa:** Punto rosso di 8 px accanto a un numero urgente.
- **Anatomia:** `.pallino-urgente` (radice)
- **Misure (token):** `--size-pallino-urgente`, `--radius-tondo`, `--color-allerta`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Accompagnato da testo («urgente» o la data).
- **Dove si usa:** `09-oggi`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `21-profilo-figlio`

#### `.kbd` — Tasto

- **Cosa:** Un tasto della tastiera nelle scorciatoie desktop (esc, ↵).
- **Anatomia:** `.kbd` (radice)
- **Misure (token):** `--space-6`, `--space-0`, `--space-1`, `--radius-xs`, `--border-sottile`, `--color-filo-2`, `--text-etichetta-size`, `--weight-semi`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Solo desktop.
- **Accessibilità:** <kbd>.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `25-ricerca`

#### `.gruppo-chip` — Gruppo di chip

- **Cosa:** Fila di chip che va a capo.
- **Anatomia:** `.gruppo-chip` (radice)
- **Misure (token):** `--space-2`
- **Varianti:** `.gruppo-chip--scorre` non va a capo: scorre in orizzontale
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** role="group" con aria-label.
- **Dove si usa:** `01-accesso`, `10-aggiungi`, `11-dettaglio-impegno`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `21-profilo-figlio`, `25-ricerca`

#### `.chip` — Chip

- **Cosa:** Capsula selezionabile: persone, filtri, suggerimenti.
- **Anatomia:** `.chip` (radice); `.chip__conteggio` (numero); `.chip__valore` (valore (taglie))
- **Misure (token):** `--space-2`, `--size-chip`, `--space-0`, `--space-3`, `--radius-m`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--text-nota-size`, `--weight-forte`, `--color-inchiostro`, `--color-latte`, `--space-1`, `--border-medio`, `--color-carta`, `--weight-semi`, `--opacity-passato`, `--font-titoli`, `--weight-normale`, `--text-sezione-size`, `--color-inchiostro-2`
- **Varianti:** `.chip--persona` con avatar; `.chip--statico` solo lettura, non cliccabile
- **Stati:** Scelto (aria-pressed="true", nero), non scelto, focus.
- **Comportamento:** Più chip possono essere scelti insieme, salvo dove è indicato.
- **Accessibilità:** <button aria-pressed>.
- **Dove si usa:** `10-aggiungi`, `11-dettaglio-impegno`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `21-profilo-figlio`, `25-ricerca`

#### `.logo-marchio` — Logo del calendario esterno

- **Cosa:** Quadrato con l’iniziale del calendario (Outlook, Google, iCloud) nel colore del marchio.
- **Anatomia:** `.logo-marchio` (radice)
- **Misure (token):** `--size-controllo`, `--radius-m`, `--font-titoli`, `--weight-pieno`, `--text-sezione-size`, `--color-bianco`, `--color-marchio-outlook`, `--color-marchio-google`, `--color-marchio-icloud`, `--size-bottone-s`, `--radius-s`, `--text-nota-size`
- **Varianti:** `.logo-marchio--google` verde Google; `.logo-marchio--icloud` nero iCloud; `.logo-marchio--outlook` blu Outlook; `.logo-marchio--piccolo` 32 px, nelle righe
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** aria-hidden: il nome è scritto accanto.
- **Dove si usa:** `04-onboarding-calendario`, `26-calendari-collegati`

#### `.anteprima-avatar` — Anteprima avatar

- **Cosa:** L’avatar grande con il nome, mentre scegli il colore.
- **Anatomia:** `.anteprima-avatar` (radice); `.anteprima-avatar__nome` (nome)
- **Misure (token):** `--space-4`, `--space-6`, `--font-titoli`, `--weight-sottile`, `--text-titolo-pagina-size`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Cambia colore al tocco su scelta-colore.
- **Accessibilità:** aria-live="polite".
- **Dove si usa:** `08-invito-colore`

#### `.cerchi-membri` — Cerchi dei membri

- **Cosa:** Fila di cerchi colorati sovrapposti che mostra chi c’è nel Nest.
- **Anatomia:** `.cerchi-membri` (radice); `.cerchi-membri__cerchio` (un membro; __cerchio--piccolo per le persone in più)
- **Misure (token):** `--size-azione`, `--size-etichetta`, `--radius-tondo`, `--c`, `--space-half`, `--color-superficie`, `--space-2`, `--size-icona-m`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Non cliccabile.
- **Accessibilità:** Decorativa: i nomi sono scritti accanto.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`

#### `.scelta-colore` — Scelta del colore

- **Cosa:** I cinque colori tra cui un membro sceglie il suo.
- **Anatomia:** `.scelta-colore` (radice); `.scelta-colore__colore` (un colore; aria-checked per quello scelto)
- **Misure (token):** `--space-3`, `--size-avatar-m`, `--radius-tondo`, `--c`, `--space-0`, `--space-half`, `--color-superficie`, `--space-1`, `--color-inchiostro`, `--opacity-disabilitato`
- **Varianti:** `.scelta-colore--sinistra` allineata a sinistra
- **Stati:** Scelto, libero, già preso da un altro (disabilitato).
- **Comportamento:** Un colore preso non si può scegliere.
- **Accessibilità:** role="radiogroup", ogni colore role="radio" con il nome del colore.
- **Dove si usa:** `03-onboarding-persone`, `08-invito-colore`, `27-profilo`

### Bottoni

#### `.btn-tenue` — Bottone tenue

- **Cosa:** Bottone piccolo con fondo carta, dentro le schede (Indicazioni, Chiama).
- **Anatomia:** `.btn-tenue` (radice)
- **Misure (token):** `--size-controllo`, `--radius-m`, `--color-carta`, `--space-2`, `--space-0`, `--space-3`, `--text-controllo-size`, `--weight-forte`, `--color-inchiostro`
- **Varianti:** nessuna
- **Stati:** Normale, premuto, focus.
- **Comportamento:** —
- **Accessibilità:** Testo visibile sempre.
- **Dove si usa:** `04-onboarding-calendario`

#### `.btn-primary` — Bottone principale

- **Cosa:** Nero, una sola volta per schermata: l’azione che chiude il compito.
- **Anatomia:** `.btn-primary` (radice); `.btn__testo` (testo); `.btn__icona-box` (quadratino con l’icona)
- **Misure (token):** `--size-azione`, `--radius-m`, `--space-2`, `--space-0`, `--space-5`, `--text-corpo-forte-size`, `--weight-pieno`, `--color-inchiostro`, `--color-latte`, `--opacity-disabilitato`, `--size-bottone-icona`, `--space-4`
- **Varianti:** `.btn-primary--freccia` testo a sinistra e freccia a destra (onboarding)
- **Stati:** Normale, premuto, focus, disabilitato (40%), caricamento (is-caricamento con spinner).
- **Comportamento:** Modificatori comuni a tutti i bottoni: btn--pieno (tutta la larghezza), btn--piccolo (40 px).
- **Accessibilità:** Testo visibile, verbo all’infinito o all’imperativo («Salva», «Continua»).
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `16-casa-da-fare`, `17-casa-scadenze`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `24-notifiche`, `26-calendari-collegati`

#### `.btn-secondary` — Bottone secondario

- **Cosa:** Bianco con bordo: l’alternativa al principale.
- **Anatomia:** `.btn-secondary` (radice)
- **Misure (token):** `--size-azione`, `--radius-m`, `--space-2`, `--space-0`, `--space-5`, `--text-corpo-forte-size`, `--weight-pieno`, `--color-superficie`, `--color-inchiostro`, `--border-sottile`, `--color-filo-2`, `--opacity-disabilitato`
- **Varianti:** nessuna
- **Stati:** Normale, premuto, focus, disabilitato.
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `01-accesso`, `05-onboarding-invito`, `07-invito-benvenuto`, `09-oggi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `20-esplora-spazio`, `21-profilo-figlio`, `23-lista-desideri-pubblica`, `24-notifiche`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.btn-chiaro` — Bottone chiaro

- **Cosa:** Il principale sui fondi scuri: fondo latte, testo inchiostro.
- **Anatomia:** `.btn-chiaro` (radice)
- **Misure (token):** `--size-azione`, `--radius-m`, `--space-2`, `--space-0`, `--space-5`, `--text-corpo-forte-size`, `--weight-pieno`, `--color-latte`, `--color-inchiostro`, `--opacity-disabilitato`
- **Varianti:** nessuna
- **Stati:** Normale, premuto, focus.
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `01-accesso`, `06-onboarding-pronto`, `07-invito-benvenuto`, `22-lista-desideri`, `28-impostazioni-nest`

#### `.btn-tratteggiato` — Bottone tratteggiato

- **Cosa:** «Aggiungi una persona», «Collega un altro account»: aggiunge un elemento alla lista sopra.
- **Anatomia:** `.btn-tratteggiato` (radice)
- **Misure (token):** `--size-azione`, `--border-medio`, `--color-filo-2`, `--radius-l`, `--space-2`, `--text-corpo-forte-size`, `--weight-forte`, `--color-inchiostro`
- **Varianti:** nessuna
- **Stati:** Normale, premuto.
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `03-onboarding-persone`, `18-nest`, `26-calendari-collegati`

#### `.btn-link` — Link-bottone

- **Cosa:** Azione in forma di testo sottolineato.
- **Anatomia:** `.btn-link` (radice)
- **Misure (token):** `--size-tocco`, `--space-0`, `--space-1`, `--text-controllo-size`, `--weight-forte`, `--border-medio`, `--space-2`, `--color-inchiostro-2`
- **Varianti:** `.btn-link--secondario` grigio
- **Stati:** Normale, focus.
- **Comportamento:** —
- **Accessibilità:** <a> se porta altrove, <button> se agisce sul posto.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `15-casa-spesa`, `20-esplora-spazio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `25-ricerca`, `26-calendari-collegati`

#### `.btn-pericolo` — Bottone pericoloso

- **Cosa:** Testo rosso: «Elimina impegno», «Esci dal Nest».
- **Anatomia:** `.btn-pericolo` (radice)
- **Misure (token):** `--size-tocco`, `--space-0`, `--space-1`, `--text-controllo-size`, `--weight-forte`, `--color-allerta`
- **Varianti:** nessuna
- **Stati:** Normale, focus.
- **Comportamento:** Apre sempre un dialogo di conferma.
- **Accessibilità:** —
- **Dove si usa:** `11-dettaglio-impegno`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.btn-pericolo-pieno` — Bottone pericoloso pieno

- **Cosa:** Rosso pieno: la conferma dentro il dialogo.
- **Anatomia:** `.btn-pericolo-pieno` (radice)
- **Misure (token):** `--size-azione`, `--radius-m`, `--color-allerta`, `--color-bianco`, `--text-corpo-forte-size`, `--weight-pieno`, `--space-0`, `--space-5`
- **Varianti:** nessuna
- **Stati:** Normale, focus.
- **Comportamento:** —
- **Accessibilità:** Bianco su rosso 5,3:1.
- **Dove si usa:** `11-dettaglio-impegno`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.spinner` — Spinner

- **Cosa:** Il cerchio che gira dentro un bottone in caricamento.
- **Anatomia:** `.spinner` (radice)
- **Misure (token):** `--size-icona-s`, `--radius-tondo`, `--space-half`, `--durata-ampia`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Gira in --durata-ampia; fermo con riduzione del movimento.
- **Accessibilità:** Il bottone ha aria-busy="true".
- **Dove si usa:** `01-accesso`, `04-onboarding-calendario`, `06-onboarding-pronto`, `07-invito-benvenuto`, `10-aggiungi`

### Campi e controlli

#### `.campo` — Campo

- **Cosa:** Etichetta sopra, campo, aiuto o errore sotto.
- **Anatomia:** `.campo` (radice); `.campo__aiuto` (testo di aiuto); `.campo__errore` (messaggio di errore); `.campo__etichetta` (etichetta (label)); `.campo__input` (input, select o textarea); `.campo__select-box` (select con freccia)
- **Misure (token):** `--space-2`, `--text-nota-size`, `--text-nota-line`, `--weight-forte`, `--color-inchiostro-2`, `--size-azione`, `--radius-m`, `--color-superficie`, `--border-sottile`, `--color-filo-2`, `--space-0`, `--space-4`, `--text-corpo-size`, `--color-inchiostro`, `--border-medio`, `--opacity-disabilitato`, `--space-1`, `--weight-semi`, `--color-allerta`, `--size-icona-s`
- **Varianti:** `.campo--errore` bordo e testo rossi
- **Stati:** Vuoto, compilato, focus, errore, disabilitato.
- **Comportamento:** L’errore compare dopo l’invio, non mentre scrivi.
- **Accessibilità:** label for/id; aria-invalid e aria-describedby verso l’errore.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `08-invito-colore`, `10-aggiungi`, `11-dettaglio-impegno`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `26-calendari-collegati`

#### `.campo-doppio` — Campi affiancati

- **Cosa:** Due campi sulla stessa riga (giorno e ora).
- **Anatomia:** `.campo-doppio` (radice)
- **Misure (token):** `--space-3`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `05-onboarding-invito`, `11-dettaglio-impegno`

#### `.campo-frase` — Campo frase

- **Cosa:** Il campo grande di Aggiungi: scrivi in italiano («Nuoto Sofia giovedì alle 17»).
- **Anatomia:** `.campo-frase` (radice)
- **Misure (token):** `--radius-m`, `--color-carta`, `--font-titoli`, `--weight-sottile`, `--text-frase-size`, `--text-frase-line`, `--text-frase-tracking`, `--space-4`, `--color-inchiostro`, `--size-riga-alta`, `--border-medio`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** Vuoto, compilato.
- **Comportamento:** Capisce data, ora e persone mentre scrivi.
- **Accessibilità:** label visibile o aria-label.
- **Dove si usa:** `10-aggiungi`

#### `.campo-rapido` — Campo rapido

- **Cosa:** Riga «+ Aggiungi alla spesa» in cima a una lista.
- **Anatomia:** `.campo-rapido` (radice); `.campo-rapido__input` (campo); `.campo-rapido__piu` (il +)
- **Misure (token):** `--size-bottone-icona`, `--space-3`, `--size-azione`, `--space-0`, `--space-2`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo-2`, `--radius-m`, `--color-carta`, `--color-inchiostro`, `--text-corpo-size`, `--color-inchiostro-2`, `--border-medio`, `--color-latte`
- **Varianti:** `.campo-rapido--attivo` mentre scrivi
- **Stati:** Normale, attivo.
- **Comportamento:** Invio aggiunge e svuota.
- **Accessibilità:** —
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`

#### `.campo-ricerca` — Campo di ricerca

- **Cosa:** Campo con lente, in Ricerca e nella palette desktop.
- **Anatomia:** `.campo-ricerca` (radice); `.campo-ricerca__input` (campo)
- **Misure (token):** `--size-icona-m`, `--space-3`, `--size-azione`, `--space-0`, `--space-4`, `--radius-l`, `--color-superficie`, `--border-medio`, `--color-inchiostro`, `--text-corpo-size`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** Vuoto, compilato.
- **Comportamento:** —
- **Accessibilità:** type="search", role="searchbox".
- **Dove si usa:** `25-ricerca`

#### `.evidenzia` — Parola trovata

- **Cosa:** La parola cercata, evidenziata in giallo nei risultati.
- **Anatomia:** `.evidenzia` (radice)
- **Misure (token):** `--color-insieme`, `--radius-xs`, `--space-0`, `--space-half`, `--border-sottile`, `--color-insieme-bordo`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** <mark>.
- **Dove si usa:** `25-ricerca`

#### `.casella` — Casella

- **Cosa:** Quadrato da spuntare: da fare, spesa.
- **Anatomia:** `.casella` (radice)
- **Misure (token):** `--size-casella`, `--radius-xs`, `--border-medio`, `--color-inchiostro`, `--color-latte`, `--space-0`
- **Varianti:** nessuna
- **Stati:** Spuntata (aria-checked="true"), vuota, focus.
- **Comportamento:** Spuntare sposta la riga in fondo dopo un attimo.
- **Accessibilità:** role="checkbox" con aria-label.
- **Dove si usa:** `09-oggi`, `10-aggiungi`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `25-ricerca`

#### `.tondo-spunta` — Tondo di spunta

- **Cosa:** Cerchio con spunta per le scelte singole e i passi fatti.
- **Anatomia:** `.tondo-spunta` (radice)
- **Misure (token):** `--size-casella`, `--radius-tondo`, `--border-medio`, `--color-inchiostro-2`, `--color-latte`, `--space-0`, `--color-inchiostro`
- **Varianti:** nessuna
- **Stati:** Pieno, vuoto.
- **Comportamento:** —
- **Accessibilità:** Decorativo: lo stato è sul contenitore.
- **Dove si usa:** `10-aggiungi`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`

#### `.toggle` — Interruttore

- **Cosa:** Acceso / spento per un’impostazione.
- **Anatomia:** `.toggle` (radice)
- **Misure (token):** `--size-interruttore-l`, `--size-interruttore-a`, `--radius-tondo`, `--color-filo-2`, `--space-0`, `--size-interruttore-pallino`, `--color-latte`, `--durata-rapida`, `--curva`, `--color-inchiostro`, `--opacity-disabilitato`
- **Varianti:** nessuna
- **Stati:** Acceso (aria-checked="true"), spento, focus.
- **Comportamento:** L’effetto è immediato, senza Salva.
- **Accessibilità:** role="switch" con aria-label.
- **Dove si usa:** `11-dettaglio-impegno`, `26-calendari-collegati`, `28-impostazioni-nest`, `29-membro`

#### `.scelta` — Scheda di scelta

- **Cosa:** Una risposta grande in onboarding: titolo, spiegazione, radio.
- **Anatomia:** `.scelta` (radice); `.scelta__info` (spiegazione); `.scelta__radio` (pallino); `.scelta__titolo` (titolo)
- **Misure (token):** `--size-casella`, `--space-4`, `--size-scelta`, `--space-3`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--color-inchiostro`, `--text-sezione-size`, `--weight-forte`, `--text-nota-size`, `--color-inchiostro-2`, `--radius-tondo`, `--border-medio`, `--color-filo-2`, `--size-radio-pieno`
- **Varianti:** nessuna
- **Stati:** Scelta (aria-checked="true"), non scelta, focus.
- **Comportamento:** —
- **Accessibilità:** role="radio" dentro un radiogroup.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `26-calendari-collegati`

#### `.gruppo-scelte` — Gruppo di scelte

- **Cosa:** Le schede di scelta in colonna.
- **Anatomia:** `.gruppo-scelte` (radice)
- **Misure (token):** `--space-2`, `--space-3`
- **Varianti:** `.gruppo-scelte--due` su desktop in due colonne
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** role="radiogroup" con aria-label.
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `26-calendari-collegati`

### Sovrapposizioni

#### `.velo` — Velo

- **Cosa:** Il fondo scuro trasparente sotto fogli, modali e dialoghi.
- **Anatomia:** `.velo` (radice)
- **Misure (token):** `--space-0`, `--color-velo`, `--z-velo`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Tocco sul velo = chiudi.
- **Accessibilità:** aria-hidden.
- **Dove si usa:** `03-onboarding-persone`, `10-aggiungi`, `11-dettaglio-impegno`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.foglio` — Foglio (mobile)

- **Cosa:** Pannello che sale dal basso su mobile: Aggiungi, modifica, filtri.
- **Anatomia:** `.foglio` (radice); `.foglio__info` (riga sotto); `.foglio__invio` (bottone in fondo); `.foglio__maniglia` (linguetta); `.foglio__testa` (titolo e chiudi); `.foglio__titolo` (titolo)
- **Misure (token):** `--durata-normale`, `--curva`, `--space-0`, `--z-foglio`, `--color-superficie`, `--radius-xl`, `--space-2`, `--grid-margine-mobile`, `--space-6`, `--space-4`, `--shadow-foglio`, `--size-barra`, `--size-maniglia-l`, `--size-maniglia-a`, `--radius-tondo`, `--color-filo-2`, `--size-bottone-s`, `--text-sezione-size`, `--weight-forte`, `--text-nota-size`, `--color-inchiostro-2`, `--size-azione`
- **Varianti:** `.foglio--alto` quasi a tutto schermo
- **Stati:** Aperto.
- **Comportamento:** Si chiude trascinando giù, con la X o sul velo.
- **Accessibilità:** role="dialog" aria-modal="true"; il focus va al primo campo e torna dove era.
- **Dove si usa:** `03-onboarding-persone`, `10-aggiungi`, `11-dettaglio-impegno`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `26-calendari-collegati`

#### `.modale` — Modale (desktop)

- **Cosa:** Il foglio su desktop: finestra centrata, con colonna laterale di aiuto se serve.
- **Anatomia:** `.modale` (radice); `.modale__corpo` (contenuto); `.modale__lato` (colonna di aiuto); `.modale__piede` (azioni)
- **Misure (token):** `--text-ora-l-size`, `--text-ora-l-line`, `--durata-normale`, `--curva`, `--space-12`, `--z-foglio`, `--size-modale`, `--radius-xl`, `--color-superficie`, `--shadow-modale`, `--size-pannello-desktop`, `--size-palette`, `--space-6`, `--space-0`, `--space-4`, `--color-carta`, `--space-3`, `--border-sottile`, `--color-filo`
- **Varianti:** `.modale--singola` una colonna sola
- **Stati:** Aperto.
- **Comportamento:** Esc chiude; scorre al suo interno se è più alta dello schermo.
- **Accessibilità:** role="dialog" aria-modal="true".
- **Dove si usa:** `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`, `10-aggiungi`, `11-dettaglio-impegno`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `25-ricerca`, `26-calendari-collegati`

#### `.palette` — Palette di ricerca (desktop)

- **Cosa:** La ricerca su desktop (⌘K): modale con campo e risultati raggruppati.
- **Anatomia:** `.palette` (radice); `.palette__gruppo` (un tipo di risultato); `.palette__gruppo-titolo` (nome del gruppo); `.palette__piede` (scorciatoie)
- **Misure (token):** `--space-3`, `--color-carta`, `--space-1`, `--text-etichetta-size`, `--weight-forte`, `--color-inchiostro-2`, `--space-0`, `--space-2`, `--radius-m`, `--color-superficie`, `--border-medio`, `--color-inchiostro`, `--space-4`, `--border-sottile`, `--color-filo`
- **Varianti:** nessuna
- **Stati:** Vuota, con risultati, nessun risultato.
- **Comportamento:** Frecce per scorrere, Invio per aprire, Esc per chiudere.
- **Accessibilità:** role="dialog"; risultati come listbox.
- **Dove si usa:** `25-ricerca`

#### `.dialogo` — Dialogo di conferma

- **Cosa:** Domanda prima di un’azione che non si può annullare.
- **Anatomia:** `.dialogo` (radice); `.dialogo__azioni` (conferma e annulla); `.dialogo__testo` (conseguenza); `.dialogo__titolo` (domanda)
- **Misure (token):** `--grid-margine-mobile`, `--z-foglio`, `--radius-xl`, `--color-superficie`, `--shadow-modale`, `--space-6`, `--space-4`, `--size-dialogo`, `--font-titoli`, `--weight-normale`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-titolo-scheda-tracking`, `--text-corpo-size`, `--text-corpo-line`, `--color-inchiostro-2`, `--space-2`
- **Varianti:** nessuna
- **Stati:** Aperto.
- **Comportamento:** Su mobile in basso, su desktop al centro.
- **Accessibilità:** role="alertdialog"; il focus parte da «Annulla».
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `11-dettaglio-impegno`, `27-profilo`, `28-impostazioni-nest`, `29-membro`

#### `.toast` — Toast

- **Cosa:** Messaggio breve dopo un’azione, spesso con Annulla.
- **Anatomia:** `.toast` (radice); `.toast__azione` (Annulla); `.toast__testo` (messaggio)
- **Misure (token):** `--grid-margine-mobile`, `--size-barra`, `--space-10`, `--z-toast`, `--radius-m`, `--color-notte`, `--color-latte`, `--space-3`, `--space-4`, `--text-controllo-size`, `--text-controllo-line`, `--shadow-barra`, `--grid-margine-desktop`, `--space-8`, `--size-dialogo`, `--weight-forte`, `--weight-pieno`, `--space-1`, `--size-tocco`, `--space-0`
- **Varianti:** nessuna
- **Stati:** Visibile.
- **Comportamento:** Sparisce dopo 5 secondi; mobile sopra la nav, desktop in basso a destra.
- **Accessibilità:** role="status".
- **Dove si usa:** `05-onboarding-invito`, `09-oggi`, `10-aggiungi`, `15-casa-spesa`, `16-casa-da-fare`, `19-esplora`, `20-esplora-spazio`, `22-lista-desideri`, `23-lista-desideri-pubblica`, `29-membro`

### Stati: vuoto, caricamento, errore

#### `.stato-vuoto` — Stato vuoto

- **Cosa:** Cosa si vede quando non c’è niente: una frase e l’azione per iniziare.
- **Anatomia:** `.stato-vuoto` (radice); `.stato-vuoto__azioni` (bottoni); `.stato-vuoto__icona` (icona); `.stato-vuoto__testo` (spiegazione); `.stato-vuoto__titolo` (titolo)
- **Misure (token):** `--space-4`, `--size-scelta`, `--space-3`, `--radius-l`, `--border-sottile`, `--color-filo`, `--size-controllo`, `--radius-m`, `--color-superficie`, `--text-corpo-forte-size`, `--text-corpo-forte-line`, `--weight-forte`, `--text-nota-size`, `--text-nota-line`, `--color-inchiostro-2`, `--color-inchiostro`, `--space-1`, `--space-0`, `--space-5`, `--font-titoli`, `--weight-sottile`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-titolo-scheda-tracking`, `--text-controllo-size`, `--text-controllo-line`, `--space-2`
- **Varianti:** `.stato-vuoto--grande` senza icona, con titolo grande e bottoni
- **Stati:** —
- **Comportamento:** Sempre con un’azione possibile.
- **Accessibilità:** —
- **Dove si usa:** `09-oggi`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `20-esplora-spazio`, `21-profilo-figlio`, `22-lista-desideri`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`

#### `.skeleton` — Scheletro di caricamento

- **Cosa:** Forme grigie al posto del contenuto mentre arriva.
- **Anatomia:** `.skeleton` (radice)
- **Misure (token):** `--color-carta-2`, `--radius-s`, `--durata-ampia`, `--curva`, `--space-3`, `--space-8`, `--radius-m`, `--size-riga-alta`, `--radius-l`, `--size-contatore`, `--size-avatar-xl`, `--radius-tondo`, `--color-notte-2`
- **Varianti:** `.skeleton--cerchio` avatar; `.skeleton--grande` blocco grande; `.skeleton--notte` su fondo scuro; `.skeleton--riga` riga di lista; `.skeleton--scheda` scheda; `.skeleton--testo` riga di testo; `.skeleton--testo-corto` riga corta; `.skeleton--titolo` titolo
- **Stati:** —
- **Comportamento:** Pulsa lentamente; fermo con riduzione del movimento.
- **Accessibilità:** aria-hidden; il contenitore ha aria-busy e un testo nascosto.
- **Dove si usa:** `06-onboarding-pronto`, `09-oggi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `19-esplora`, `21-profilo-figlio`, `24-notifiche`, `25-ricerca`, `27-profilo`

#### `.gruppo-skeleton` — Gruppo di scheletri

- **Cosa:** Impila gli scheletri con la spaziatura giusta.
- **Anatomia:** `.gruppo-skeleton` (radice)
- **Misure (token):** `--space-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** —
- **Dove si usa:** `06-onboarding-pronto`, `09-oggi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `21-profilo-figlio`, `24-notifiche`, `25-ricerca`, `27-profilo`

#### `.avviso` — Avviso

- **Cosa:** Riquadro con icona e frase: errori, informazioni, conferme.
- **Anatomia:** `.avviso` (radice); `.avviso__testo` (frase)
- **Misure (token):** `--size-icona-m`, `--space-3`, `--space-4`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--text-controllo-size`, `--text-controllo-line`, `--border-medio`, `--color-allerta`, `--color-info`, `--color-ok`, `--color-avviso`, `--weight-forte`
- **Varianti:** `.avviso--avviso` arancio; `.avviso--errore` rosso; `.avviso--info` blu; `.avviso--ok` verde; `.avviso--senza-azione` senza bottone a destra
- **Stati:** —
- **Comportamento:** Gli errori dicono cosa fare («Ricollega»).
- **Accessibilità:** role="alert" per gli errori, role="status" per gli altri.
- **Dove si usa:** `01-accesso`, `04-onboarding-calendario`, `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `26-calendari-collegati`

#### `.errore-pagina` — Errore di pagina

- **Cosa:** Quando una schermata intera non si carica.
- **Anatomia:** `.errore-pagina` (radice); `.errore-pagina__icona` (icona); `.errore-pagina__testo` (spiegazione); `.errore-pagina__titolo` (titolo)
- **Misure (token):** `--space-3`, `--space-10`, `--space-4`, `--size-azione`, `--radius-l`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--color-allerta`, `--font-titoli`, `--weight-sottile`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--text-controllo-size`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Bottone Riprova.
- **Accessibilità:** role="alert".
- **Dove si usa:** `11-dettaglio-impegno`, `23-lista-desideri-pubblica`

### Calendario

#### `.striscia-giorni` — Striscia dei giorni

- **Cosa:** I sette giorni in fila sopra la vista Giorno e Settimana mobile.
- **Anatomia:** `.striscia-giorni` (radice); `.striscia-giorni__densita` (punti sotto il numero); `.striscia-giorni__giorno` (un giorno; is-oggi, is-selezionato); `.striscia-giorni__nome` (Lun); `.striscia-giorni__numero` (19); `.striscia-giorni__punto` (un punto; __punto--insieme giallo)
- **Misure (token):** `--space-1`, `--space-2`, `--space-0`, `--radius-m`, `--color-inchiostro`, `--text-micro-size`, `--text-micro-line`, `--weight-forte`, `--color-inchiostro-2`, `--space-8`, `--radius-tondo`, `--font-titoli`, `--weight-sottile`, `--text-cella-size`, `--color-latte`, `--color-superficie`, `--border-sottile`, `--color-filo-2`, `--space-half`, `--size-pallino`, `--size-tacca`, `--space-3`, `--color-insieme-bordo`
- **Varianti:** nessuna
- **Stati:** Oggi, selezionato.
- **Comportamento:** Tocco → quel giorno.
- **Accessibilità:** role="tab" con aria-selected e il giorno intero nell’aria-label («Lunedì 19 ottobre, 4 impegni»).
- **Dove si usa:** `12-calendario-settimana`

#### `.griglia-mese` — Griglia del mese

- **Cosa:** Il mese: 7 colonne, punti colorati di chi ha qualcosa.
- **Anatomia:** `.griglia-mese` (radice); `.griglia-mese__cella` (un giorno; --fuori, --weekend, --festa, --oggi, --selezionata); `.griglia-mese__intestazione` (L M M G V S D); `.griglia-mese__numero` (numero); `.griglia-mese__punti` (avatar a punto)
- **Misure (token):** `--space-6`, `--space-2`, `--text-etichetta-size`, `--weight-forte`, `--color-inchiostro-2`, `--size-cella-mese`, `--border-sottile`, `--color-filo`, `--space-1`, `--color-inchiostro`, `--size-avatar-s`, `--radius-tondo`, `--font-titoli`, `--weight-sottile`, `--text-cella-size`, `--text-cella-line`, `--color-carta`, `--space-half`, `--color-inchiostro-3`, `--color-allerta`, `--color-latte`, `--color-superficie`, `--radius-m`, `--color-filo-2`
- **Varianti:** nessuna
- **Stati:** Oggi, selezionata, fuori mese, festa.
- **Comportamento:** Tocco → la giornata sotto (mobile) o a destra (desktop).
- **Accessibilità:** role="grid"; ogni cella con aria-label «martedì 20 ottobre, 4 impegni».
- **Dove si usa:** `14-calendario-mese`

#### `.giorno-persone` — Giorno per persone

- **Cosa:** La vista Giorno del Nest: una colonna per persona, orari a sinistra.
- **Anatomia:** `.giorno-persone` (radice); `.giorno-persone__corpo` (le colonne con i blocchi); `.giorno-persone__persona` (una persona); `.giorno-persone__testa` (avatar delle persone)
- **Misure (token):** `--size-ora-calendario`, `--space-2`, `--size-colonna-ora`, `--persone`, `--space-1`, `--space-0`, `--radius-m`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--text-micro-size`, `--weight-forte`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Un impegno di più persone si allarga su più colonne (largo-n).
- **Accessibilità:** Ogni blocco è un link con ora, titolo e persone.
- **Dove si usa:** `13-calendario-giorno`

#### `.colonna-ore` — Colonna delle ore

- **Cosa:** Le ore dalle 8 alle 23 a sinistra della griglia.
- **Anatomia:** `.colonna-ore` (radice); `.colonna-ore__ora` (un’ora)
- **Misure (token):** `--h`, `--font-titoli`, `--text-etichetta-size`, `--color-inchiostro-2`, `--space-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** aria-hidden.
- **Dove si usa:** `12-calendario-settimana`, `13-calendario-giorno`

#### `.area-orari` — Area degli orari

- **Cosa:** Lo spazio dove stanno i blocchi, con le linee delle ore.
- **Anatomia:** `.area-orari` (radice); `.area-orari__corsia` (colonna di una persona)
- **Misure (token):** `--h`, `--ore`, `--color-filo`, `--border-sottile`, `--space-0`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Altezza di un’ora: --h (50 px mobile, 40 px desktop).
- **Accessibilità:** —
- **Dove si usa:** `13-calendario-giorno`

#### `.blocco-orario` — Blocco orario

- **Cosa:** Un impegno nella griglia, alto quanto dura.
- **Anatomia:** `.blocco-orario` (radice); `.blocco-orario__ora` (orario); `.blocco-orario__titolo` (titolo)
- **Misure (token):** `--radius-s`, `--space-1`, `--space-2`, `--color-superficie`, `--border-sottile`, `--color-filo`, `--shadow-scheda`, `--space-half`, `--color-inchiostro`, `--text-etichetta-size`, `--text-etichetta-line`, `--weight-pieno`, `--text-micro-size`, `--text-micro-line`, `--color-inchiostro-2`, `--color-insieme`, `--color-insieme-bordo`, `--color-insieme-testo`, `--color-occupato-1`, `--size-riga-occupato`, `--color-occupato-2`, `--border-medio`, `--border-evidenza`
- **Varianti:** `.blocco-orario--attivo` scelto; `.blocco-orario--insieme` giallo «Liberi insieme»; `.blocco-orario--occupato` righe diagonali, «Occupato»
- **Stati:** Normale, attivo, passato.
- **Comportamento:** Posizione con classi generate: da-H-MM (inizio), per-N (durata), corsia-a/b o col-k + largo-n.
- **Accessibilità:** Link con aria-label completo.
- **Dove si usa:** `12-calendario-settimana`, `13-calendario-giorno`

#### `.linea-adesso` — Linea di adesso

- **Cosa:** La linea rossa sull’ora corrente.
- **Anatomia:** `.linea-adesso` (radice)
- **Misure (token):** `--space-1`, `--space-0`, `--space-half`, `--color-allerta`, `--z-base`, `--space-2`, `--radius-tondo`, `--h`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Si sposta ogni minuto.
- **Accessibilità:** aria-hidden.
- **Dove si usa:** `12-calendario-settimana`, `13-calendario-giorno`

#### `.griglia-settimana` — Griglia della settimana (desktop)

- **Cosa:** La settimana su desktop: sette colonne con i blocchi.
- **Anatomia:** `.griglia-settimana` (radice); `.griglia-settimana__angolo` (cella vuota in alto a sinistra); `.griglia-settimana__colonna` (colonna del giorno); `.griglia-settimana__giorno` (intestazione del giorno; is-oggi); `.griglia-settimana__nome` (nome); `.griglia-settimana__numero` (numero)
- **Misure (token):** `--size-ora-desktop`, `--size-colonna-ora`, `--border-sottile`, `--color-filo-2`, `--size-riga-alta`, `--space-half`, `--space-0`, `--space-2`, `--color-filo`, `--text-etichetta-size`, `--weight-forte`, `--color-inchiostro-2`, `--font-titoli`, `--weight-sottile`, `--text-titolo-scheda-size`, `--text-titolo-scheda-line`, `--space-1`, `--radius-l`, `--color-inchiostro`, `--color-latte`, `--h`, `--ore`, `--color-superficie`
- **Varianti:** nessuna
- **Stati:** Oggi evidenziato.
- **Comportamento:** —
- **Accessibilità:** Intestazioni come h2 nascosti per giorno.
- **Dove si usa:** `12-calendario-settimana`

### Onboarding e schermate scure

#### `.marchio` — Marchio

- **Cosa:** Logo FamilyNest: quadrato colorato e nome.
- **Anatomia:** `.marchio` (radice)
- **Misure (token):** `--space-3`, `--font-titoli`, `--weight-medio`, `--text-titolo-scheda-size`, `--text-titolo-scheda-tracking`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Testo «FamilyNest».
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`, `23-lista-desideri-pubblica`

#### `.adesivi` — Adesivi

- **Cosa:** La pila di adesivi sul lato scuro: esempi di cose che l’app fa.
- **Anatomia:** `.adesivi` (radice)
- **Misure (token):** `--space-3`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Statici.
- **Accessibilità:** aria-hidden: sono decorazione.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`

#### `.adesivo` — Adesivo

- **Cosa:** Un esempio a forma di etichetta colorata: «Nuoto gio 17:00».
- **Anatomia:** `.adesivo` (radice); `.adesivo__icona` (icona o avatar); `.adesivo__nota` (piccolo testo a destra)
- **Misure (token):** `--space-3`, `--size-adesivo`, `--space-0`, `--space-5`, `--space-2`, `--radius-l`, `--c`, `--color-inchiostro`, `--font-titoli`, `--weight-medio`, `--text-titolo-scheda-size`, `--text-titolo-scheda-tracking`, `--shadow-adesivo`, `--space-6`, `--border-medio`, `--color-insieme-bordo`, `--size-controllo`, `--radius-m`, `--color-avatar-su-colore`, `--font-testo`, `--text-controllo-size`, `--weight-semi`, `--text-avatar-m-size`
- **Varianti:** `.adesivo--destra` allineato a destra; `.adesivo--insieme` bordo giallo; `.adesivo--rientro` rientrato
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Decorativo.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `08-invito-colore`

#### `.claim` — Claim

- **Cosa:** «La casa, in un posto solo.»
- **Anatomia:** `.claim` (radice)
- **Misure (token):** `--weight-medio`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Testo vero, non immagine.
- **Dove si usa:** `01-accesso`, `02-onboarding-chi-vive-con-te`, `03-onboarding-persone`, `04-onboarding-calendario`, `05-onboarding-invito`, `06-onboarding-pronto`, `07-invito-benvenuto`, `08-invito-colore`

#### `.citazione` — Citazione

- **Cosa:** Frase di chi ti invita, nelle schermate di invito.
- **Anatomia:** `.citazione` (radice)
- **Misure (token):** `--border-medio`, `--color-notte-2`, `--space-4`, `--text-corpo-size`, `--text-corpo-line`, `--color-latte-2`, `--color-latte`, `--weight-semi`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Paragrafo normale tra virgolette basse.
- **Dove si usa:** `07-invito-benvenuto`

#### `.legale` — Testo legale

- **Cosa:** Riga piccola con termini e privacy.
- **Anatomia:** `.legale` (radice)
- **Misure (token):** `--text-etichetta-size`, `--color-latte-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** Link sottolineati.
- **Dove si usa:** `01-accesso`, `07-invito-benvenuto`

#### `.codice-invito` — Codice di invito

- **Cosa:** QR e codice NEST·4821 da inquadrare o scrivere.
- **Anatomia:** `.codice-invito` (radice); `.codice-invito__codice` (codice a lettere spaziate); `.codice-invito__qr` (riquadro del QR)
- **Misure (token):** `--space-4`, `--space-5`, `--size-qr`, `--font-titoli`, `--weight-normale`, `--text-titolo-scheda-size`, `--tracking-codice`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Vale 7 giorni.
- **Accessibilità:** Il codice è testo selezionabile.
- **Dove si usa:** `05-onboarding-invito`

#### `.qr` — QR

- **Cosa:** Il disegno del QR (SVG).
- **Anatomia:** `.qr` (radice); `.qr__centro` (quadrato centrale); `.qr__vuoto` (zona bianca centrale)
- **Misure (token):** `--color-inchiostro`, `--color-superficie`, `--color-notte`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** —
- **Accessibilità:** role="img" con aria-label «Codice QR per entrare in Casa D’Angelo».
- **Dove si usa:** `05-onboarding-invito`

#### `.lista-partenza` — Lista di partenza

- **Cosa:** La prima volta in Oggi: le tre cose da fare per cominciare.
- **Anatomia:** `.lista-partenza` (radice); `.lista-partenza__sopra` (riga sopra); `.lista-partenza__titolo` (titolo)
- **Misure (token):** `--space-5`, `--space-4`, `--space-2`, `--space-1`, `--text-etichetta-size`, `--weight-forte`, `--color-inchiostro-2`
- **Varianti:** nessuna
- **Stati:** —
- **Comportamento:** Sparisce quando i passi sono fatti.
- **Accessibilità:** <section> con titolo; i passi sono una lista.
- **Dove si usa:** `09-oggi`

#### `.passo-partenza` — Passo di partenza

- **Cosa:** Un passo della lista di partenza.
- **Anatomia:** `.passo-partenza` (radice); `.passo-partenza__cerchio` (numero o spunta); `.passo-partenza__testo` (testo)
- **Misure (token):** `--size-casella`, `--space-3`, `--size-azione`, `--border-sottile`, `--color-filo`, `--text-controllo-size`, `--weight-semi`, `--color-inchiostro`, `--space-0`, `--color-inchiostro-2`, `--weight-medio`, `--radius-tondo`, `--border-medio`, `--color-filo-2`, `--color-latte`
- **Varianti:** nessuna
- **Stati:** Fatto (is-fatto), da fare.
- **Comportamento:** Tocco → la schermata del passo.
- **Accessibilità:** Lo stato è scritto per i lettori di schermo.
- **Dove si usa:** `09-oggi`

## 8. Layout e navigazione

| Larghezza | Layout |
|---|---|
| ≤ 767 px (`--breakpoint-mobile-max`) | Mobile. Barra in alto (quadrato del Nest, lente, notifiche), una colonna, navigazione in basso con Oggi, Calendario, Casa e il bottone Aggiungi. Overlay: fogli dal basso. |
| 768–1023 px | Tablet: layout mobile, contenuto centrato al massimo su `--grid-colonna-stretta` (720 px). Navigazione in basso. Da disegnare in dettaglio (decisione aperta). |
| ≥ 1024 px (`--breakpoint-desktop-min`) | Desktop. Navigazione in alto (`.nav-alto`), contenuto fino a `--grid-contenuto-max`, colonne (`.colonne--tre`, `.colonne--pannello`, `.colonne--menu`). Overlay: modali centrati; ricerca come palette (⌘K). |

I mockup mostrano due larghezze fisse: 390 px (`--size-frame-mobile`) e 1280 px (`--size-frame-desktop`).

### Struttura

- **Tre sezioni:** Oggi (`09-oggi`), Calendario (`12`, `13`, `14`), Casa (`15` spesa, `16` da fare, `17` scadenze).
- **Aggiungi** (`10-aggiungi`): sempre raggiungibile dalla navigazione.
- **Il Nest** (`18-nest`): si apre dal quadrato colorato (in alto a sinistra su mobile, in alto a destra su desktop). Contiene persone, Esplora, calendari collegati, profili dei figli, notifiche, impostazioni. Non c’è hamburger.
- **Ricerca** (`25-ricerca`): lente in alto su desktop (anche ⌘K); su mobile dalla barra.
- **Notifiche** (`24-notifiche`): campanella; contiene anche la sintesi del mattino.
- **Dettagli** (`11`, `21`, `29`…): su mobile a tutto schermo con «indietro»; su desktop nella colonna centrale o in un pannello.

### Mappa delle schermate

| Schermata | Titolo | Porta a |
|---|---|---|
| `01-accesso.html` | Accesso | `02-onboarding-chi-vive-con-te`, `07-invito-benvenuto` |
| `02-onboarding-chi-vive-con-te.html` | Onboarding · Chi vive con te? | `01-accesso`, `03-onboarding-persone` |
| `03-onboarding-persone.html` | Onboarding · Chi c'è nel Nest? | `02-onboarding-chi-vive-con-te`, `04-onboarding-calendario` |
| `04-onboarding-calendario.html` | Onboarding · Calendario | `03-onboarding-persone`, `05-onboarding-invito` |
| `05-onboarding-invito.html` | Onboarding · Invito | `04-onboarding-calendario`, `06-onboarding-pronto` |
| `06-onboarding-pronto.html` | Onboarding · Pronto | `09-oggi` |
| `07-invito-benvenuto.html` | Invito · Benvenuto | `01-accesso`, `08-invito-colore` |
| `08-invito-colore.html` | Invito · Il tuo colore | `04-onboarding-calendario`, `07-invito-benvenuto` |
| `09-oggi.html` | Oggi | `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `15-casa-spesa`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `19-esplora`, `20-esplora-spazio`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati` |
| `10-aggiungi.html` | Aggiungi | `09-oggi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `11-dettaglio-impegno.html` | Dettaglio impegno | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `12-calendario-settimana.html` | Calendario · Settimana | `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `13-calendario-giorno`, `14-calendario-mese`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati` |
| `13-calendario-giorno.html` | Calendario · Giorno «chi è dove» | `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `14-calendario-mese`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `14-calendario-mese.html` | Calendario · Mese | `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `13-calendario-giorno`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `15-casa-spesa.html` | Casa · Spesa | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `16-casa-da-fare`, `17-casa-scadenze`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `16-casa-da-fare.html` | Casa · Da fare | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `17-casa-scadenze`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `17-casa-scadenze.html` | Casa · Scadenze | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `16-casa-da-fare`, `18-nest`, `24-notifiche`, `25-ricerca` |
| `18-nest.html` | Il tuo Nest | `09-oggi`, `12-calendario-settimana`, `15-casa-spesa`, `19-esplora`, `21-profilo-figlio`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest`, `29-membro` |
| `19-esplora.html` | Esplora | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `20-esplora-spazio`, `24-notifiche`, `25-ricerca` |
| `20-esplora-spazio.html` | Esplora · Uno spazio (in arrivo) | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `19-esplora`, `24-notifiche`, `25-ricerca` |
| `21-profilo-figlio.html` | Profilo di un figlio | `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `15-casa-spesa`, `17-casa-scadenze`, `18-nest`, `22-lista-desideri`, `24-notifiche`, `25-ricerca` |
| `22-lista-desideri.html` | Lista desideri | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `21-profilo-figlio`, `24-notifiche`, `25-ricerca` |
| `23-lista-desideri-pubblica.html` | Lista desideri · Pagina pubblica | — |
| `24-notifiche.html` | Notifiche | `09-oggi`, `10-aggiungi`, `12-calendario-settimana`, `15-casa-spesa`, `16-casa-da-fare`, `18-nest`, `25-ricerca`, `28-impostazioni-nest` |
| `25-ricerca.html` | Ricerca | `09-oggi`, `10-aggiungi`, `11-dettaglio-impegno`, `12-calendario-settimana`, `15-casa-spesa`, `17-casa-scadenze`, `18-nest`, `24-notifiche` |
| `26-calendari-collegati.html` | Calendari collegati | `09-oggi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca`, `27-profilo`, `28-impostazioni-nest`, `29-membro` |
| `27-profilo.html` | Il tuo profilo | `09-oggi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `28-impostazioni-nest`, `29-membro` |
| `28-impostazioni-nest.html` | Impostazioni della casa | `09-oggi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `21-profilo-figlio`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `29-membro` |
| `29-membro.html` | Un membro del Nest | `05-onboarding-invito`, `09-oggi`, `12-calendario-settimana`, `15-casa-spesa`, `18-nest`, `24-notifiche`, `25-ricerca`, `26-calendari-collegati`, `27-profilo`, `28-impostazioni-nest` |

L’elenco completo azione per azione (`data-azione` → destinazione) è in `index.html`.

## 9. Pattern

- **Aggiungere qualcosa.** Un solo modulo (`.foglio` su mobile, `.modale` su desktop) con il campo frase in alto e un selettore per il tipo (Impegno, Spesa, Da fare, Scadenza). Il testo viene capito mentre si scrive e mostrato come chip. «Tutti i dettagli» apre il modulo completo.
- **Confermare e annullare.** Dopo ogni azione reversibile compare un `.toast` con «Annulla». Niente dialoghi per cose che si possono annullare.
- **Eliminare.** Sempre con `.dialogo` di conferma: titolo a domanda («Eliminare «Nuoto Sofia»?»), conseguenza nel testo, bottone rosso pieno + Annulla.
- **Stato vuoto.** `.stato-vuoto`: cosa manca e come cominciare, con un’azione. Mai solo «Nessun dato».
- **Caricamento.** `.skeleton` con la forma del contenuto; contenitore con `aria-busy="true"` e testo nascosto. Bottoni in caricamento con `.is-caricamento` e `.spinner`.
- **Errore.** Errore di una parte: `.avviso--errore` con azione («Riprova», «Ricollega»). Errore di tutta la pagina: `.errore-pagina`. Errore di un campo: `.campo--errore` con messaggio sotto.
- **Lente Io / Nest.** In Oggi e Calendario. «Io»: i miei impegni e quelli dove sono coinvolto. «Nest»: tutti, con gli «Occupato» come righe grigie.
- **Visibilità.** Tre livelli per impegno e per calendario collegato: Solo io, Occupato, Tutto il Nest. Si sceglie con un `.selettore`.
- **Liberi insieme.** Quando due adulti sono liberi nello stesso momento la riga è gialla (`.riga-evento--insieme`, `.blocco-orario--insieme`). Un tocco propone di usarlo.
- **Calendari collegati.** Più account (Outlook, Google, iCloud); per ogni calendario un interruttore, la direzione (entrata, uscita, entrambe) e la visibilità.
- **Liste di casa.** Riga con casella; spuntata va in fondo, barrata. In Spesa lo `.strappo` toglie i presi in un gesto.
- **Esplora e spazi.** Esplora è un catalogo di 10 spazi (`.scheda-modulo`); con la puntina uno spazio si fissa in fondo a Oggi («I tuoi spazi»). Per ora ogni spazio ha solo ingresso e pagina «In arrivo».
- **Foglio o modale.** Stesso contenuto: su mobile sale dal basso a tutta larghezza, su desktop è centrato con velo. Chiusura con X, Esc, tocco sul velo.
- **Primo accesso.** Onboarding in 4 passi (`02`–`06`) con tacche; chi è invitato fa `07`–`08`. In Oggi la `.lista-partenza` guida i primi passi.

## 10. Movimento

| Token | Valore | Uso |
|---|---|---|
| `--durata-rapida` | 200ms |  |
| `--durata-normale` | 300ms |  |
| `--durata-ampia` | 600ms |  |
| `--curva` | cubic-bezier(.32,.72,0,1) |  |

- Fogli e modali entrano in `--durata-normale` con `--curva` (decelerazione morbida). Escono più veloci (`--durata-rapida`).
- Interruttori, chip, caselle: cambio di stato in `--durata-rapida`.
- Spinner: un giro ogni `--durata-ampia`. Scheletri: pulsazione tra opacità 1 e `--opacity-passato` in `--durata-ampia`.
- Una riga spuntata resta al suo posto per `--durata-ampia` prima di scendere, così si vede cosa è successo.
- Con «riduci movimento» del sistema (`prefers-reduced-motion`) animazioni e transizioni sono spente.
- Niente rimbalzi, niente parallasse, niente animazioni decorative.

## 11. Accessibilità

- Obiettivo: WCAG 2.1 AA.
- Contrasto del testo ≥ 4,5:1 (tabella al punto 2). Nessun testo in `--color-inchiostro-3`.
- Area di tocco minima 44 × 44 px (`--size-tocco`), anche per bottoni disegnati più piccoli.
- Focus sempre visibile: anello `--border-medio` in `--color-info`.
- HTML semantico: `header`, `nav`, `main`, `section`; un solo `h1` per schermata, poi `h2` in ordine.
- Ogni campo ha `label` (o `aria-label`) e `name`. Errori collegati con `aria-describedby` e `aria-invalid`.
- Controlli con il ruolo giusto: selettori `aria-pressed`, interruttori `role="switch"`, caselle `role="checkbox"`, scelte `role="radio"` dentro `role="radiogroup"`.
- Mai un elemento interattivo dentro un altro (niente bottone in un link o in un bottone).
- Il colore non è mai l’unica informazione: avatar con iniziale, urgente con testo, «Occupato» scritto.
- Fogli, modali e dialoghi: `role="dialog"` / `role="alertdialog"`, `aria-modal="true"`, focus intrappolato e restituito alla chiusura.
- Toast e avvisi: `role="status"`; errori: `role="alert"`.
- Caricamento: `aria-busy="true"` e testo per lettori di schermo.

## 12. Tono di voce

- Si parla come una persona di casa: diretto, caldo, mai di marketing.
- Del tu. Frasi brevi. Prima l’informazione, poi il resto.
- Nomi delle persone al posto dei ruoli («la porta Laura», non «accompagnatore»).
- Verbi semplici sui bottoni: Salva, Aggiungi, Continua, Elimina.
- Errori: cosa è successo e cosa fare. Mai codici, mai colpa all’utente.
- Niente punti esclamativi, niente emoji, niente parole inglesi quando c’è quella italiana.

| Situazione | Sì | No |
|---|---|---|
| Saluto in Oggi | «Buon pomeriggio, Marco» | «Benvenuto nella tua dashboard!» |
| Tempo che manca | «tra 1 h 8 min» | «In arrivo: 68 minuti rimanenti» |
| Stato vuoto di Oggi | «Niente in programma. Una giornata tutta tua.» | «Nessun evento trovato.» |
| Errore di sincronizzazione | «Non riusciamo a sincronizzare Outlook dalle 13:10: la password potrebbe essere cambiata.» | «Errore 401: autenticazione fallita.» |
| Conferma dopo un’azione | «Aggiunto. Nuoto Sofia, giovedì alle 17.» | «Operazione completata con successo!» |
| Dialogo di eliminazione | «Eliminare «Nuoto Sofia»? Sparisce per tutto il Nest.» | «Sei sicuro di voler procedere?» |
| Chi accompagna | «La porta Laura» | «Accompagnatore assegnato: Laura» |
| Visibilità | «Gli altri vedono solo che sei occupato.» | «Privacy impostata su: Busy» |
| Invito | «Laura inquadra il codice o inserisce il numero dopo l’accesso. Vale 7 giorni.» | «Condividi il codice di invito univoco.» |
| Spesa | «Strappa qui: togli i presi» | «Elimina elementi completati» |

## 13. Cosa non fare

- Niente Tailwind, niente framework CSS: solo tokens.css e components.css.
- Niente valori scritti a mano: ogni colore, misura, durata viene da un token. Se manca, si aggiunge a tokens.css e al documento, poi si usa.
- Niente illustrazioni, emoji, gradienti, mascotte o immagini generate: l’app non deve sembrare fatta da un’IA.
- Niente colore delle persone su testi, schede o sfondi: il colore vive solo negli avatar, nei punti del mese e negli adesivi.
- Niente ombre sulle schede: si staccano dal fondo carta con il bianco e un filo interno di 1 px. Ombre solo per barre, fogli, modali e adesivi.
- Niente rosso per dire «tra poco»: il rosso è solo per allerta e urgente. «tra 1 h 8 min» ha lo stile del testo normale.
- Niente righello del tempo in cima a Oggi.
- Niente hamburger: il Nest si apre dal quadrato colorato.
- Niente selettore Oggi/Domani/Weekend in Oggi: per altri giorni c’è il Calendario.
- Niente bottoni dentro altri bottoni o link: una riga cliccabile non contiene controlli; in quel caso il link è sul titolo.
- Niente testi segnaposto («Lorem ipsum», «Titolo qui»): sempre testi finali in italiano.
- Niente inchiostro-3 per il testo: non arriva a 4,5:1. Solo segni e tacche.
- Niente stile in linea (style="…") nelle schermate.
- Niente parole tecniche nell’interfaccia: «sincronizza» va bene, «API», «token», «sync failed» no.

## 14. Decisioni aperte

| Tema | Domanda |
|---|---|
| Accesso con email | Oggi l’accesso è con Apple e Google. Serve anche email + codice? Cambia 01-accesso. |
| Pagina Premium | Cosa è gratis e cosa no; dove si mostra il limite (spazi di Esplora, calendari collegati). |
| Tema scuro dell’app | I token notte esistono, ma un tema scuro completo non è disegnato. |
| Contenuto degli spazi di Esplora | Per ora ogni spazio ha solo ingresso e pagina «In arrivo». Le funzioni si decidono una alla volta. |
| «Proponi qualcosa» | Proporre un impegno a un altro membro (che accetta o rifiuta). Non disegnato. |
| Tendina notifiche su desktop | Oggi la campanella apre la pagina 24-notifiche; valutare una tendina sotto la campanella. |
| Citofona | Messaggio rapido a tutta la casa («Scendete, si mangia»). In valutazione. |
| Sintesi della settimana | Oltre a quella del mattino, una sintesi la domenica sera. In valutazione. |
| Taglie e lista desideri | Condividere le taglie del figlio insieme alla lista desideri pubblica. |
| Apertura del profilo figlio dal calendario | Toccare l’avatar di un figlio nel calendario apre il suo profilo? |
| Tablet (768–1023 px) | Oggi si usa il layout mobile allargato con colonna centrale di 720 px; da disegnare se serve. |

## Appendice · Tutti i token

### Colori: base

| Token | Valore | Nota |
|---|---|---|
| `--color-carta` | #F1F2EE | sfondo delle pagine |
| `--color-carta-2` | #E7E8E2 | segnaposto foto, scheletri di caricamento |
| `--color-superficie` | #FFFFFF | schede, campi, barre |
| `--color-inchiostro` | #17181C | testo principale, azione principale |
| `--color-inchiostro-2` | #5A5D64 | testo secondario |
| `--color-inchiostro-3` | #8A8D93 | solo elementi non testuali (tacche, segni) |
| `--color-filo` | #DFE0DA | bordi e divisori |
| `--color-filo-2` | #CFD1CA | bordi dei campi, bordi tratteggiati |
| `--color-notte` | #1B1A17 | blocchi scuri: porte, piano, onboarding |
| `--color-notte-2` | #2A2925 | elementi sopra notte |
| `--color-latte` | #F4F2EC | testo e superfici chiare su inchiostro e notte |
| `--color-latte-2` | #B9B5AC | testo secondario su notte |

### Colori: Liberi insieme

| Token | Valore | Nota |
|---|---|---|
| `--color-insieme` | #FBF3D6 | fondo |
| `--color-insieme-bordo` | #C9A43A | bordo |
| `--color-insieme-testo` | #6B5413 | testo |

### Colori: impegni «Occupato» (righe grigie)

| Token | Valore | Nota |
|---|---|---|
| `--color-occupato-1` | #ECEDE7 |  |
| `--color-occupato-2` | #E4E5DE |  |

### Colori: stato

| Token | Valore | Nota |
|---|---|---|
| `--color-ok` | #237A4B |  |
| `--color-avviso` | #A15C07 |  |
| `--color-allerta` | #C8322F |  |
| `--color-info` | #3355CC |  |
| `--color-bianco` | #FFFFFF |  |

### Colori: membri (solo negli avatar)

| Token | Valore | Nota |
|---|---|---|
| `--color-membro-pomodoro` | #F06A4F |  |
| `--color-membro-glicine` | #B9A3E8 |  |
| `--color-membro-salvia` | #8DBF9B |  |
| `--color-membro-cobalto` | #5C7FE0 |  |
| `--color-membro-zafferano` | #F2B33D |  |

### Colori: marchi dei calendari esterni (solo nei loghi)

| Token | Valore | Nota |
|---|---|---|
| `--color-marchio-outlook` | #0F6CBD |  |
| `--color-marchio-google` | #188038 |  |
| `--color-marchio-icloud` | #1C1C1E |  |

### Colori: trasparenze

| Token | Valore | Nota |
|---|---|---|
| `--color-velo` | rgba(23,24,28,.30) | sotto fogli e modali |
| `--color-ombra` | rgba(23,24,28,.06) |  |
| `--color-ombra-forte` | rgba(23,24,28,.30) |  |
| `--color-ombra-adesivo` | rgba(0,0,0,.25) |  |
| `--color-avatar-su-colore` | rgba(255,255,255,.55) | cerchio dentro gli adesivi |

### Font

| Token | Valore | Nota |
|---|---|---|
| `--font-titoli` | "Parkinsans",ui-sans-serif,system-ui,sans-serif |  |
| `--font-testo` | "Host Grotesk",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif |  |
| `--font-codice` | ui-monospace,"SF Mono",Menlo,monospace | solo nella documentazione |
| `--weight-sottile` | 300 |  |
| `--weight-normale` | 400 |  |
| `--weight-medio` | 500 |  |
| `--weight-semi` | 600 |  |
| `--weight-forte` | 650 |  |
| `--weight-pieno` | 700 |  |

### Scala tipografica (mobile; *-desktop dove cambia)

| Token | Valore | Nota |
|---|---|---|
| `--text-display-size` | 44px |  |
| `--text-display-line` | 48px |  |
| `--text-display-tracking` | -.04em |  |
| `--text-display-desktop-size` | 56px |  |
| `--text-display-desktop-line` | 60px |  |
| `--text-ora-xl-size` | 64px |  |
| `--text-ora-xl-line` | 56px |  |
| `--text-ora-xl-tracking` | -.04em |  |
| `--text-ora-l-size` | 52px |  |
| `--text-ora-l-line` | 48px |  |
| `--text-ora-l-tracking` | -.04em |  |
| `--text-numero-size` | 44px |  |
| `--text-numero-line` | 48px |  |
| `--text-numero-tracking` | -.04em |  |
| `--text-titolo-pagina-size` | 32px |  |
| `--text-titolo-pagina-line` | 36px |  |
| `--text-titolo-pagina-tracking` | -.03em |  |
| `--text-titolo-pagina-desktop-size` | 40px |  |
| `--text-titolo-pagina-desktop-line` | 44px |  |
| `--text-titolo-scheda-size` | 22px |  |
| `--text-titolo-scheda-line` | 26px |  |
| `--text-titolo-scheda-tracking` | -.02em |  |
| `--text-frase-size` | 22px |  |
| `--text-frase-line` | 30px |  |
| `--text-frase-tracking` | -.015em |  |
| `--text-sezione-size` | 15px |  |
| `--text-sezione-line` | 24px |  |
| `--text-corpo-forte-size` | 15px |  |
| `--text-corpo-forte-line` | 20px |  |
| `--text-corpo-size` | 15px |  |
| `--text-corpo-line` | 22px |  |
| `--text-ora-riga-size` | 15px |  |
| `--text-ora-riga-line` | 20px |  |
| `--text-ora-riga-tracking` | -.01em |  |
| `--text-nota-size` | 13px |  |
| `--text-nota-line` | 18px |  |
| `--text-etichetta-size` | 12px |  |
| `--text-etichetta-line` | 16px |  |
| `--text-etichetta-tracking` | .02em |  |
| `--text-micro-size` | 11px |  |
| `--text-micro-line` | 14px |  |
| `--text-controllo-size` | 14px | testo di bottoni, selettori, righe compatte |
| `--text-controllo-line` | 20px | testo di bottoni, selettori, righe compatte |
| `--text-numero-m-size` | 36px | giorni alle scadenze |
| `--text-numero-m-line` | 36px | giorni alle scadenze |
| `--text-numero-s-size` | 30px | contatori piccoli |
| `--text-numero-s-line` | 34px | contatori piccoli |
| `--text-cella-size` | 18px | numeri del mese e della striscia |
| `--text-cella-line` | 26px | numeri del mese e della striscia |
| `--text-avatar-xs-size` | 8px |  |
| `--text-avatar-s-size` | 10px |  |
| `--text-avatar-m-size` | 13px |  |
| `--text-avatar-l-size` | 18px |  |
| `--text-avatar-xl-size` | 30px |  |
| `--tracking-codice` | .12em |  |
| `--tracking-maiuscolo` | .08em |  |

### Punti di rottura (riferimento: le media query non leggono le variabili)

| Token | Valore | Nota |
|---|---|---|
| `--breakpoint-mobile-max` | 767px |  |
| `--breakpoint-desktop-min` | 1024px |  |

### Spaziature

| Token | Valore | Nota |
|---|---|---|
| `--space-0` | 0 |  |
| `--space-half` | 2px |  |
| `--space-1` | 4px |  |
| `--space-2` | 8px |  |
| `--space-3` | 12px |  |
| `--space-4` | 16px |  |
| `--space-5` | 20px |  |
| `--space-6` | 24px |  |
| `--space-8` | 32px |  |
| `--space-10` | 40px |  |
| `--space-12` | 48px |  |
| `--space-16` | 64px |  |

### Griglia

| Token | Valore | Nota |
|---|---|---|
| `--grid-margine-mobile` | 20px |  |
| `--grid-margine-desktop` | 40px |  |
| `--grid-colonne-desktop` | 12 | griglia di riferimento per le colonne desktop |
| `--grid-gutter` | 24px |  |
| `--grid-contenuto-max` | 1200px |  |
| `--grid-colonna-stretta` | 720px | pagine di impostazioni e dettaglio su desktop |

### Raggi

| Token | Valore | Nota |
|---|---|---|
| `--radius-xs` | 6px | kbd, etichetta fonte |
| `--radius-s` | 8px | etichette, chip, voce attiva dei selettori |
| `--radius-m` | 12px | controlli: bottoni, campi, selettori |
| `--radius-l` | 16px | schede |
| `--radius-xl` | 24px | fogli e modali |
| `--radius-tondo` | 999px | avatar, interruttori, pallini |

### Bordi

| Token | Valore | Nota |
|---|---|---|
| `--border-sottile` | 1px |  |
| `--border-medio` | 1.5px |  |
| `--border-evidenza` | 3px | filo nero in cima alla scheda in evidenza |

### Ombre ed elevazione

| Token | Valore | Nota |
|---|---|---|
| `--shadow-nessuna` | none |  |
| `--shadow-scheda` | 0 1px 2px var(--color-ombra) |  |
| `--shadow-barra` | 0 8px 24px var(--color-ombra) |  |
| `--shadow-foglio` | 0 -8px 32px var(--color-ombra) |  |
| `--shadow-modale` | 0 30px 80px var(--color-ombra-forte) |  |
| `--shadow-adesivo` | 0 10px 24px var(--color-ombra-adesivo) |  |

### Misure

| Token | Valore | Nota |
|---|---|---|
| `--size-tocco` | 44px | area minima di tocco |
| `--size-controllo` | 40px | bottoni icona, selettori, chip grandi |
| `--size-azione` | 52px | bottoni principali, campi |
| `--size-riga` | 56px | righe di lista |
| `--size-riga-alta` | 64px | righe evento, righe con due testi |
| `--size-barra` | 64px | barra di navigazione mobile, bottone Aggiungi |
| `--size-nav-desktop` | 72px | barra di navigazione desktop |
| `--size-etichetta` | 28px | etichette e chip piccoli |
| `--size-chip` | 36px | chip filtro |
| `--size-interruttore-l` | 44px |  |
| `--size-interruttore-a` | 26px |  |
| `--size-interruttore-pallino` | 20px |  |
| `--size-casella` | 22px | checkbox e radio |
| `--size-icona-s` | 16px |  |
| `--size-icona-m` | 20px |  |
| `--size-icona-l` | 24px |  |
| `--size-avatar-xs` | 18px |  |
| `--size-avatar-s` | 24px |  |
| `--size-avatar-m` | 32px |  |
| `--size-avatar-l` | 44px |  |
| `--size-avatar-xl` | 72px |  |
| `--size-quadrato-nest` | 40px |  |
| `--size-colonna-ora` | 48px | colonna dell'orario nelle righe |
| `--size-colonna-giorni` | 72px | colonna dei giorni nelle scadenze |
| `--size-cta-aggiungi` | 128px | larghezza del bottone Aggiungi in basso |
| `--size-pannello-desktop` | 320px |  |
| `--size-menu-desktop` | 280px |  |
| `--size-modale` | 880px |  |
| `--size-dialogo` | 400px |  |
| `--size-maniglia-l` | 40px |  |
| `--size-maniglia-a` | 4px |  |
| `--size-adesivo` | 56px |  |
| `--size-qr` | 168px |  |
| `--size-foto` | 64px |  |
| `--size-foto-scheda` | 160px |  |
| `--size-ora-calendario` | 50px | altezza di un'ora nella vista Giorno mobile |
| `--size-ora-desktop` | 40px | altezza di un'ora nella griglia settimana desktop |
| `--size-cella-mese` | 48px |  |
| `--size-pallino` | 6px |  |
| `--size-pallino-urgente` | 8px |  |
| `--size-tacca` | 4px |  |
| `--size-bottone-s` | 32px | puntina, chiudi nei fogli |
| `--size-bottone-icona` | 36px | quadratino con icona dentro bottoni e campi |
| `--size-scelta` | 72px | schede di scelta, righe scadenza |
| `--size-radio-pieno` | 7px |  |
| `--size-contatore` | 136px |  |
| `--size-modulo` | 152px |  |
| `--size-porta` | 120px |  |
| `--size-palette` | 680px |  |
| `--size-colonna-dati` | 104px |  |
| `--size-riga-occupato` | 6px | larghezza delle righe diagonali di «Occupato» |
| `--size-punto-membro` | 9px | avatar senza iniziale sotto i giorni del mese |
| `--size-frame-mobile` | 390px |  |
| `--size-frame-mobile-altezza` | 844px |  |
| `--size-frame-desktop` | 1280px |  |
| `--size-frame-desktop-altezza` | 800px |  |

### Movimento

| Token | Valore | Nota |
|---|---|---|
| `--durata-rapida` | 200ms |  |
| `--durata-normale` | 300ms |  |
| `--durata-ampia` | 600ms |  |
| `--curva` | cubic-bezier(.32,.72,0,1) |  |

### Opacità

| Token | Valore | Nota |
|---|---|---|
| `--opacity-passato` | .5 |  |
| `--opacity-disabilitato` | .4 |  |

### Livelli

| Token | Valore | Nota |
|---|---|---|
| `--z-base` | 1 |  |
| `--z-nav` | 4 |  |
| `--z-velo` | 5 |  |
| `--z-foglio` | 6 |  |
| `--z-toast` | 7 |  |
