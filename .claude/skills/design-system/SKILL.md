---
name: design-system
description: Design system di FamilyNest Web - token di colore, tipografia, spaziature, componenti e tono di voce. Usala prima di scrivere o rivedere qualsiasi interfaccia, CSS o testo visibile all'utente.
---

# Design system di FamilyNest

> **Stato: v1.0, compilata il 22/10/2026 dal mockup approvato** (`docs/mockup/tokens.css`, `components.css`, `design-system.md`, `design-system.html`) e dalle decisioni di Francesco (`docs/mockup/DECISIONI.md` e decisioni D-1 … D-10 nella issue #8). **v2.0 del 24/11/2026:** aggiunto il design per telefono di Fable come fonte di verità (`riferimento/telefono.md`). **v2.1 del 25/11/2026:** token e font di F2 (#196): un solo font, Figtree; pesi 400/600/700; colori, misure, raggi, ombre e movimenti di Fable; colori delle persone con il modulo `src/lib/member-colors.ts`.

> **Dal 24/11/2026 la fonte di verità per il telefono è il design di Fable in `docs/design/telefono/`** (decisione D4 in `docs/mockup/DECISIONI.md`). **Con F2 (#196, PR #585) i token di Fable sono nel codice:** `:root` di `src/app/globals.css` e `docs/agenti/design/token.css` (copia identica) hanno i valori di `riferimento/telefono.md`, e `riferimento/token.md` li elenca tutti. I componenti invece sono ancora quelli del vecchio mockup finché i lavori F4 e F5 (Componenti 2.0) non li ridisegnano: le regole sui componenti qui sotto descrivono il codice di oggi, e dove `riferimento/telefono.md` dice altro, per il lavoro nuovo vale quello. Le differenze principali dei componenti: pagine bianche, azione primaria `--color-azione`, raggi dei pulsanti 14 e dei fogli 20, freccia indietro D, righe con la freccia sottile B, «Collega» forma 1, giallo solo per «adesso».

## Fonti e precedenza

1. Decisioni di Francesco in `docs/mockup/DECISIONI.md` (vincono sul design e sul mockup).
2. **Design per telefono di Fable** in `docs/design/telefono/` (dal 24/11/2026): schermate, note di Fable, `tokens.md` e `tokens.json`, risposte in `decisioni-fable.md`; tra due schermate vale il passo più recente. Tradotto in token e regole in `riferimento/telefono.md`. **Computer e web da telefono di Fable** in `docs/design/computer/` (approvati il 25/11/2026, D5; correzioni del Passo 12 in arrivo): regole di adattamento in `regole.md`, token diversi in `tokens-computer.md`, tradotti in `riferimento/computer.md`. Per le pagine non ancora disegnate su computer si adatta il telefono con quelle regole.
3. Vecchio mockup `docs/mockup/*.html` (archivio): vale solo dove il design di Fable non dice niente. `docs/mockup/tokens.css` resta come archivio e nessun test lo confronta più (F2). **Valori:** `docs/agenti/design/token.css`, copia esatta del `:root` di `src/app/globals.css` e riferimento del test dei token; si cambiano sempre insieme, nella PR `shared/*` che tocca i token.
4. Aspetto dei componenti: `docs/mockup/components.css`, portato nell'app **con gli stessi nomi di classe** (decisione D-2).
5. Comportamento e accessibilità di ogni componente: `docs/mockup/design-system.md` §7–§11.
6. Questa skill: regole d'uso, stati che il mockup non disegna, componenti React, tono di voce. Dove il mockup e questa skill sembrano in contrasto, vale il mockup e si apre una domanda nella issue.

Mail di servizio: `docs/mockup/mail/` (nove modelli HTML e solo testo con le anteprime, approvati da Francesco il 19/11/2026, #472; istruzioni in `LEGGIMI.md`). Hanno stili scritti dentro gli elementi e caratteri propri, come richiedono i programmi di posta: si usano così come sono, senza token né classi dell'app e senza riformattarli.

## Regole sempre valide

- Solo CSS proprio. I valori vivono come variabili in `:root` dentro `src/app/globals.css`; i componenti usano **solo variabili**, mai colori, font o misure scritti a mano. Eccezioni ammesse: `0`, `1`, `100%`, `50%`, `auto`, `env(safe-area-inset-*)`, le larghezze delle media query e delle query di contenitore (le variabili non funzionano lì).
- **Testo ingrandito (#313, WCAG 1.4.4): fino al 200% il testo va a capo, niente si sovrappone, la pagina non scorre in orizzontale; al 100% nessun pixel cambia.** Per questo:
  - Dimensioni e interlinee del testo sono token in **rem** (px del mockup / 16), le interlinee in rem e mai senza unità. Restano in px spaziature, raggi, bordi, ombre, `--size-*` (tranne i tre `--size-*-min`) e le iniziali degli avatar (`--text-avatar-*`). Mai `font-size` in px su `html` o `body`; `-webkit-text-size-adjust: 100%` resta.
  - Un elemento che contiene testo non ha `height`: `min-height` con lo stesso token. `height` resta solo su icone, avatar, interruttore, casella, puntina, `.btn-icona`, pallini.
  - Colonne di griglia `minmax(0, 1fr)`, mai `1fr`; una colonna fissa con testo `minmax(<token>, max-content)`. `body { overflow-wrap: break-word }`, niente `hyphens: auto`, niente `white-space: nowrap` su bottoni, chip, etichette, adesivi.
  - Puntini di sospensione solo dentro `.blocco-orario`.
  - Le disposizioni per il testo grande si fanno con query di contenitore in rem, solo sui cinque contenitori `barra` (`.nav-basso`), `riga` (`.riga-lista`, `.riga-regalo`), `selettore` (`.contenitore-selettore`), `blocco` (`.blocco-orario`) e `avviso` (`.avviso`); mai media query per questo. Una parola più larga della colonna si spezza senza trattino, anche nei titoli: è accettato (#327). Dettagli e regole per componente: `riferimento/componenti.md`, «Testo ingrandito».
- Se un valore manca, non si inventa: lo definisce il designer qui (in `riferimento/token.md`), con una issue `proposta-design` se cambia il design di Fable; lo sviluppatore lo porta in `src/app/globals.css` e in `docs/agenti/design/token.css` nella stessa PR `shared/*`.
- Niente Tailwind, niente librerie di componenti, niente CSS-in-JS.
- Mobile first: si scrive prima il layout a 390 px, poi si adatta a 1280 px con media query.
- **Classi del design system globali, con i nomi del mockup (D-2).** Tutte le classi di `docs/mockup/components.css` (tranne il blocco «IMPALCATURA DEL MOCKUP», classi `mock-*`) stanno in `src/app/globals.css` o in un file importato da lì, con lo stesso nome: `.btn-primary`, `.campo--errore`, `.foglio`… Così pagine, tester e revisore confrontano 1:1 con il mockup.
- I componenti React condivisi vivono in `src/components/ui/<Nome>/` e applicano quelle classi globali: niente CSS module per i componenti del design system. Una pagina può avere un suo CSS module solo per la disposizione propria (griglie, spaziature tra blocchi), sempre con i token.
- Se una pagina ha bisogno di una variante nuova, la definisce il designer qui (nome di classe nello stile del mockup: `blocco__parte--variante`, in italiano), non lo sviluppatore.
- Niente estetica "generata dall'AI": niente gradienti, card inclinate, ombre sulle schede, illustrazioni, emoji, CTA generiche ("Clicca qui", "Invia"), icone `+` senza testo dove il mockup ha un'etichetta.
- **Tema scuro al lancio** (D7, decisione di Francesco del 26/11/2026): telefono, web da telefono e computer hanno chiaro e scuro, con la tavolozza comune dei Passi 12–16 (73 ruoli, un valore per tema) in `riferimento/token.md`, «Tavolozza comune dei Passi 12–16». Un blocco di variabili per tema, stessi nomi, nessun colore scritto a mano. **Non è ancora nel codice:** i token li porta una `richiesta-condivisa`; finché non c'è, `.tema-notte` e i token `--color-notte*`, `--color-latte*` servono solo alle schermate scure già disegnate (accesso, chiusura dell'onboarding, schede e blocchi «porta»). Le tavole in `scuro-derivato/` non sono approvate una per una: vale la tavolozza.
- Il colore delle persone (`--color-membro-*`) vive solo negli avatar, nei punti del mese, negli adesivi, nel filo attorno alla foto, nelle barre delle corsie (`-corsia`) e, come tinta (`-tinta`), nel fondo del pallino non scelto. Mai su testi, schede o fondi di pagina. Le pagine non scrivono mai i nomi delle tinte: usano le classi `.membro-<codice>` (variabili `--c`, `--c-tinta`, `--c-corsia`, `--c-iniziale`) date da `memberColorClass()` di `src/lib/member-colors.ts`, unica fonte della corrispondenza codice → tinta.
- `--color-inchiostro-3` non si usa mai per il testo (2,98:1). Il rosso (`--color-allerta`) solo per errori e urgente, mai per «tra poco».
- Niente stile in linea (`style=`). Le posizioni calcolate dei blocchi del calendario si decidono nella specifica di quelle pagine.
- Niente icone o campi legati alla salute dei figli (D1): l'icona `stethoscope` non entra nello sprite dell'app.

## Parti di consultazione (leggile quando servono)

Questa skill contiene le regole da avere sempre presenti. I dettagli stanno in quattro file accanto, da aprire con Read **quando il lavoro li tocca**:

| File                                                     | Cosa contiene                                                                                                                                                                                                | Quando leggerlo                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/design-system/riferimento/token.md`      | colori, font, scala tipografica, spaziature, griglia, raggi, bordi, ombre, misure, movimento, livelli, breakpoint                                                                                            | quando scrivi o rivedi CSS, o confronti valori con il mockup                                                         |
| `.claude/skills/design-system/riferimento/componenti.md` | componenti React di base, classi del mockup, varianti, stati, accessibilità, correzioni approvate (#11, #43, #52, #63, #67, #74), testo ingrandito (#313), classi senza componente                           | quando usi, scrivi o rivedi un componente o una classe condivisa (leggi solo le righe dei componenti che ti servono) |
| `.claude/skills/design-system/riferimento/telefono.md`   | design per telefono di Fable (24/11/2026): token di Fable con i valori del vecchio mockup a fianco, colori delle persone, Figtree, movimento e splash, Componenti 2.0 con i rimandi alle PNG, domande aperte | sempre, per qualsiasi lavoro sul telefono e per il lavoro `shared/*` dei Componenti 2.0                              |
| `.claude/skills/design-system/riferimento/computer.md`   | computer e web da telefono di Fable (25/11/2026): larghezze, barra laterale, pannello, finestra, fumetto, ricerca, fuoco e mouse, token del guscio e colori diversi dal telefono, contrasti da correggere    | per qualsiasi disposizione da 760 px in su, per il web da telefono e per le pagine senza account                     |
| `.claude/skills/design-system/riferimento/registro.md`   | storia delle modifiche alla skill                                                                                                                                                                            | solo il designer, quando aggiorna la skill                                                                           |

Il designer aggiorna la parte giusta e aggiunge una riga al registro.

## Tipografia

- **Un solo font: Figtree**, per titoli e testo. `--font-titoli` e `--font-testo` hanno lo stesso valore: si tengono i due nomi perché le classi esistenti li usano.
- **Pesi: solo 400, 600, 700.** I nomi dei token restano, cambia il valore: `--weight-sottile`, `--weight-normale` e `--weight-medio` valgono 400; `--weight-semi` e `--weight-forte` 600; `--weight-pieno` 700. Mai altri pesi, nemmeno scritti a mano.
- Ore e numeri hanno tutti lo stesso stile, con cifre tabellari (`font-variant-numeric: tabular-nums`).
- Testo di base del `body`: `--font-testo`, `--text-corpo-size` / `--text-corpo-line`, colore `--color-inchiostro`, fondo `--color-carta`, `-webkit-font-smoothing: antialiased`, `overflow-wrap: break-word` (#313). I token del testo sono in rem (#313): seguono il carattere scelto nel sistema o nel browser.

### Caricamento dei font

Nell'app Figtree arriva da **`next/font/google`**: il file è scaricato alla build e servito dal nostro dominio, quindi il browser non chiede niente a Google e nessun indirizzo IP delle famiglie va a terzi (D-1). Nessun `<link>` a Google Fonts.

- `Figtree` in `src/app/layout.tsx`: font variabile (nessun `weight`), `subsets: ["latin", "latin-ext"]`, `display: "swap"`, `variable: "--font-figtree"`. `adjustFontFallback` e `preload` restano al valore predefinito (attivi): Next genera da solo il font di riserva calibrato («Figtree Fallback», con `size-adjust`), così il testo non cambia misura dopo il primo disegno.
- La classe `.variable` va sull'elemento `<html>` (non su `<body>`), perché `--font-titoli` e `--font-testo` sono dichiarati in `:root`.
- In `:root`: `--font-titoli: var(--font-figtree), ui-sans-serif, system-ui, sans-serif;` e `--font-testo` uguale.
- Nessun altro font nell'app. `--font-codice` (caratteri di sistema a spaziatura fissa) serve solo alla documentazione.

### Classi di testo

Classi globali in `globals.css` (servono a tutte le pagine). La classe cambia l'aspetto, non il livello: `h1`/`h2` restano in ordine.

Tutte in Figtree. Il peso è il token della classe in `src/app/components.css`, con il valore di F2.

| Classe             | Peso                                      | Token (mobile → desktop)                                    | Esempio                                   |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `.t-display`       | 400 (`--weight-sottile`)                  | `--text-display-*` → `--text-display-desktop-*`             | Buon pomeriggio                           |
| `.t-titolo-pagina` | 700 (`--weight-pieno`)                    | `--text-titolo-pagina-*` → `--text-titolo-pagina-desktop-*` | Calendari collegati                       |
| `.t-titolo-scheda` | 400 (`--weight-normale`)                  | `--text-titolo-scheda-*`                                    | Completa il profilo di Sofia              |
| `.t-frase`         | 400 (`--weight-sottile`)                  | `--text-frase-*`                                            | Stasera siete liberi insieme dalle 21:30. |
| `.t-numero`        | 400 (`--weight-sottile`), cifre tabellari | `--text-numero-*`                                           | 14                                        |
| `.t-sezione`       | 600 (`--weight-forte`)                    | `--text-sezione-*`                                          | Questa settimana                          |
| `.t-corpo-forte`   | 600 (`--weight-forte`)                    | `--text-corpo-forte-*`                                      | Nuoto Sofia                               |
| `.t-corpo`         | 400 (`--weight-normale`)                  | `--text-corpo-*`                                            | Piscina comunale, la porta Laura          |
| `.t-controllo`     | 600 (`--weight-semi`)                     | `--text-controllo-*`                                        | Aggiungi                                  |
| `.t-nota`          | 400 (`--weight-medio`)                    | `--text-nota-*`                                             | Entro giovedì                             |
| `.t-etichetta`     | 400 (`--weight-normale`)                  | `--text-etichetta-*`                                        | OUTLOOK                                   |
| `.t-micro`         | 600 (`--weight-semi`)                     | `--text-micro-*`                                            | Lun                                       |
| `.t-secondario`    | —                                         | colore `--color-inchiostro-2`                               | ritocco                                   |
| `.t-forte`         | —                                         | peso `--weight-pieno`                                       | ritocco                                   |
| `.t-allerta`       | —                                         | colore `--color-allerta`                                    | ritocco                                   |

Il maiuscolo di `.t-etichetta`, dove c'è ancora, lo toglie F4a. Token del testo nati con F2 e ancora senza classe (le classi le definisce il designer quando un componente 2.0 li usa): `--text-titolo-sezione-*` (21/27, 700), `--text-sottotitolo-*` (17/25, 400), `--text-titolo-barra-*` (16/22, 700, barra e fogli), `--text-tag-*` (12/16, 600, etichetta piccola). Misure e tracking in `riferimento/token.md`.

## Contrasti (WCAG 2.1 AA)

Valori di F2 (#196), formula WCAG 2.1 sui valori dei token. Le coppie del §7 di `docs/specifiche/196-token-e-font.md` le verifica un test. Coppie da ricordare:

| Testo o segno                    | Fondo                                             | Rapporto          | Uso                                                                             |
| -------------------------------- | ------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `--color-inchiostro`             | `--color-carta` (bianco)                          | 15,76:1           | testo principale                                                                |
| `--color-inchiostro`             | `--color-carta-2` / `--color-fondo-app`           | 14,51:1 / 14,54:1 | testo sui fondi quieti                                                          |
| `--color-inchiostro-2`           | `--color-carta` / `--color-carta-2`               | 5,86:1 / 5,40:1   | testo secondario sulle pagine e negli avvisi quieti                             |
| `--color-inchiostro-2-fondo`     | `--color-fondo-app`                               | 6,23:1            | testo secondario sul fondo dell'app                                             |
| `--color-bianco`                 | `--color-azione` / `--color-azione-premuto`       | 11,86:1 / 14,62:1 | pulsante primario                                                               |
| `--color-latte`                  | `--color-inchiostro`                              | 14,08:1           | bottoni e voci scelte del vecchio mockup, finché F4 non li ridisegna            |
| `--color-latte`                  | `--color-notte`                                   | 15,55:1           | toast, schede scure, schermate notte                                            |
| `--color-allerta`                | `--color-superficie` / `--color-allerta-fondo`    | 6,54:1 / 5,78:1   | errori; testo dell'avviso d'errore                                              |
| `--color-bianco`                 | `--color-allerta` / `--color-allerta-scuro`       | 6,54:1 / 6,94:1   | rosso pieno del dialogo di conferma, normale e premuto                          |
| `--color-ok` / `--color-scaduto` | `--color-superficie`                              | 6,49:1 / 6,69:1   | fatto e collegato; scadenza passata                                             |
| `--color-insieme-testo`          | `--color-insieme`                                 | 9,29:1            | Liberi insieme                                                                  |
| `--color-inchiostro`             | `--color-adesso` / `--color-adesso-tinta`         | 10,02:1 / 13,69:1 | «adesso»                                                                        |
| `--color-filo-campo`             | `--color-superficie` / `--color-carta-2`          | 3,33:1 / 3,07:1   | bordo del campo (minimo non testuale 3:1)                                       |
| `--c-iniziale`                   | `--c` di ogni colore delle persone                | da 4,55:1         | iniziale dell'avatar (tabella in `riferimento/token.md`)                        |
| `--c-corsia`                     | bianco, `--color-carta-2`, `--color-corsia-vuota` | da 3,00:1         | barra delle corsie (decisione di Francesco del 25/11)                           |
| `--color-info`                   | `--color-carta` / `--color-carta-2`               | 6,34:1 / 5,84:1   | anello di focus su fondo chiaro                                                 |
| `--color-info`                   | `--color-notte`                                   | 2,74:1            | **insufficiente**: su fondo scuro l'anello di focus è `--color-latte` (15,55:1) |

Solo decorativi, mai testo né unico bordo di un controllo: `--color-inchiostro-3` (2,98:1), `--color-filo-tenue` (2,01:1), `--color-filo`, `--color-filo-2`. L'interruttore spento (pallino bianco su `--color-filo-2`, 1,64:1) resta sotto 3:1 come prima: lo risolve F4a (#503).

## Iconografia

- Lucide `lucide-static` 0.460.0, a tratto: `stroke: currentColor`, `fill: none`, `stroke-width: var(--border-medio)`, estremità e giunzioni arrotondate.
- Taglie: 16 px `--size-icona-s` (`.icona--s`), 20 px `--size-icona-m` (`.icona`, predefinita), 24 px `--size-icona-l` (`.icona--l`).
- Nell'app: un unico sprite `<svg class="sprite-icone" aria-hidden="true">` nel layout radice, con i `<symbol id="i-nome" viewBox="0 0 24 24">` copiati **identici** dagli sprite dei mockup: 80 icone (elenco in `design-system.md` §6, senza `stethoscope`). Nessun pacchetto nuovo. Il componente `Icon` scrive `<svg class="icona" aria-hidden="true"><use href="#i-nome"/></svg>`.
- Icona decorativa: sempre `aria-hidden="true"`. Bottone con sola icona: `aria-label` scritto come azione.
- I calendari esterni non usano loghi originali: `.logo-marchio` (iniziale sul colore del marchio).

## Movimento

- Fogli e modali entrano in `--durata-normale` con `--curva`, escono in `--durata-rapida`.
- Interruttori, chip, caselle, cambi di fondo al passaggio del mouse: `--durata-rapida`.
- Spinner: un giro ogni `--durata-ampia`, lineare. Scheletri: pulsazione tra opacità 1 e `--opacity-passato` in `--durata-ampia`, alternata.
- Riga spuntata: resta al suo posto per `--durata-ampia` prima di scendere.
- Con `prefers-reduced-motion: reduce` niente spostamenti, zoom né rimbalzi; restano dissolvenze brevi (opacità, al massimo 150-200 ms). Lo spinner resta fermo, il bottone resta `aria-busy`. **Decisione di Francesco del 13/11** («animazioni gentili, con brevi dissolvenze, non azzerate»): vince sulla frase di `docs/mockup/design-system.md` («animazioni e transizioni spente»). Il CSS attuale dell'app spegne ancora tutto: lo adegua lo sviluppatore con il nuovo design.
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

Aree di tocco: ogni controllo ha almeno 44 × 44 px (`--size-tocco`). Dove il disegno è più piccolo (`.btn-icona--piccolo` 32 px, `.casella` e `.tondo-spunta` 22 px, `.toggle` 26 px di altezza, `.chip` 36 px, `.selettore__voce` 32 px di altezza; dalla #67 anche `.btn-icona` 40 px, `a.quadrato-nest` 40 px, `.btn--piccolo` e `.btn-tenue` alti 40 px, `.btn-aggiungi--desktop`, `.btn-link` e `.btn-pericolo` per la larghezza, i link di `.stato-vuoto__testo`, `.puntina` e `.scelta-colore__colore`; dalla #204 il titolo-bottone `button.riga-lista__titolo` di Casa · Da fare (e il link `a.riga-lista__titolo` della Ricerca, #243), con l'area sulla colonna del testo; dalla #312 `.campo-ricerca__input`, che copre tutto il riquadro del campo di ricerca) l'area si allarga con un `::before` trasparente centrato o con il padding della riga, senza cambiare il disegno. **Attenzione:** un elemento con `overflow: hidden` taglia il proprio `::before`, e le parti tagliate non ricevono i tocchi. È il caso di `.selettore__voce`: lì il taglio passa a una `clip-path` (vedi «Componenti condivisi di Casa» in `riferimento/componenti.md`). Restano fuori solo i link dentro una frase (`.legale__link`, eccezione «in linea»), il quadrato decorativo `.quadrato-nest--notte` e `.nav-alto__voce` (esiste solo da 1024 px). Le aree di due controlli vicini non si sovrappongono. Il «Torna a Oggi» degli stati «In arrivo» non è «in linea»: ha l'area di 44 px, che copre in parte la riga sopra.

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
| Errore di pagina, uscita                     | Sotto «Riprova», `a.btn-link` «Torna a Oggi» verso `/oggi` (`PageError` con `exit`). Non c'è su `/oggi` né nell'onboarding.                  |
| Pagina inesistente                           | Titolo «Questa pagina non c'è». Testo «Il link potrebbe essere vecchio o scritto male.» Bottone «Torna a Oggi».                              |
| Salvataggio non riuscito                     | «Non siamo riusciti a salvare. Controlla la connessione e riprova.» + «Riprova»                                                              |

## Cosa non fare

- Valori scritti a mano, Tailwind, librerie di componenti, stile in linea, classi rinominate rispetto al mockup.
- Testo in px, `height` su un elemento con testo, `1fr` senza `minmax(0, …)`, puntini fuori da `.blocco-orario` (#313).
- Ombre sulle schede: si staccano dal fondo con il bianco e il filo interno di 1 px. Ombre solo per barre, fogli, modali e adesivi.
- Rosso per dire «tra poco»; `--color-inchiostro-3` per il testo; colore delle persone fuori dagli avatar.
- Hamburger (il Nest si apre dal quadrato colorato), righello del tempo in cima a Oggi, selettore Oggi/Domani/Weekend in Oggi.
- Bottoni dentro altri bottoni o link.
- Testi segnaposto («Lorem ipsum», «Titolo qui»), parole tecniche, punti esclamativi, emoji.
- Campi data e ora senza la classe `.campo__input` o formattati fuori dalle funzioni di `src/lib/`.
- Spinner a pagina intera.
