---
name: design-system
description: Design system di FamilyNest Web - token di colore, tipografia, spaziature, componenti e tono di voce. Usala prima di scrivere o rivedere qualsiasi interfaccia, CSS o testo visibile all'utente.
---

# Design system di FamilyNest

> **Stato: v1.0, compilata il 22/10/2026 dal mockup approvato** (`docs/mockup/tokens.css`, `components.css`, `design-system.md`, `design-system.html`) e dalle decisioni di Francesco (`docs/mockup/DECISIONI.md` e decisioni D-1 … D-10 nella issue #8).

## Fonti e precedenza

1. Decisioni di Francesco in `docs/mockup/DECISIONI.md` (vincono sul mockup).
2. Valori: `docs/mockup/tokens.css` (202 variabili), più 2 colori approvati da Francesco dopo il mockup (`--color-filo-campo`, `--color-allerta-scuro`, #43 punti 2 e 4, issue #52) e i 5 colori dei membri aggiunti con la #74. Il blocco pronto da copiare in `src/app/globals.css` è `docs/agenti/design/token.css` (uguale a `tokens.css` tranne l'aggancio dei font a `next/font` e i 2 colori aggiunti con la #52).
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

## Parti di consultazione (leggile quando servono)

Questa skill contiene le regole da avere sempre presenti. I dettagli stanno in tre file accanto, da aprire con Read **quando il lavoro li tocca**:

| File                                                     | Cosa contiene                                                                                                                                             | Quando leggerlo                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/design-system/riferimento/token.md`      | colori, font, scala tipografica, spaziature, griglia, raggi, bordi, ombre, misure, movimento, livelli, breakpoint                                         | quando scrivi o rivedi CSS, o confronti valori con il mockup                                                         |
| `.claude/skills/design-system/riferimento/componenti.md` | componenti React di base, classi del mockup, varianti, stati, accessibilità, correzioni approvate (#11, #43, #52, #63, #67, #74), classi senza componente | quando usi, scrivi o rivedi un componente o una classe condivisa (leggi solo le righe dei componenti che ti servono) |
| `.claude/skills/design-system/riferimento/registro.md`   | storia delle modifiche alla skill                                                                                                                         | solo il designer, quando aggiorna la skill                                                                           |

Il designer aggiorna la parte giusta e aggiunge una riga al registro.

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

| Testo o segno          | Fondo                     | Rapporto | Uso                                                                             |
| ---------------------- | ------------------------- | -------- | ------------------------------------------------------------------------------- |
| `--color-inchiostro`   | `--color-carta`           | 15,78:1  | testo principale                                                                |
| `--color-inchiostro-2` | `--color-carta`           | 5,86:1   | testo secondario sulle pagine; numeri dei giorni fuori dal mese (#52)           |
| `--color-inchiostro-2` | `--color-superficie`      | 6,59:1   | testo secondario nelle schede                                                   |
| `--color-latte`        | `--color-inchiostro`      | 15,85:1  | bottoni principali, voci scelte                                                 |
| `--color-latte`        | `--color-notte`           | 15,55:1  | toast, schede scure, schermate notte                                            |
| `--color-allerta`      | `--color-carta`           | 4,72:1   | errori sulle pagine (minimo raggiunto)                                          |
| `--color-bianco`       | `--color-allerta`         | 5,31:1   | bottone pericoloso pieno                                                        |
| `--color-bianco`       | `--color-allerta-scuro`   | 6,94:1   | bottone pericoloso pieno, passaggio e premuto (#52)                             |
| `--color-filo-campo`   | `--color-superficie`      | 3,70:1   | bordo del campo contro il suo fondo bianco (#52, minimo non testuale 3:1)       |
| `--color-filo-campo`   | `--color-carta`           | 3,29:1   | bordo del campo contro la pagina (#52)                                          |
| `--color-inchiostro`   | `--color-membro-lampone`  | 4,75:1   | iniziale dell'avatar (#74)                                                      |
| `--color-inchiostro`   | `--color-membro-ceruleo`  | 5,27:1   | iniziale dell'avatar (#74)                                                      |
| `--color-inchiostro`   | `--color-membro-peonia`   | 9,45:1   | iniziale dell'avatar (#74)                                                      |
| `--color-inchiostro`   | `--color-membro-basilico` | 4,72:1   | iniziale dell'avatar (#74)                                                      |
| `--color-inchiostro`   | `--color-membro-cannella` | 5,29:1   | iniziale dell'avatar (#74)                                                      |
| `--color-info`         | `--color-carta`           | 5,64:1   | anello di focus su fondo chiaro                                                 |
| `--color-info`         | `--color-notte`           | 2,74:1   | **insufficiente**: su fondo scuro l'anello di focus è `--color-latte` (15,55:1) |

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

Aree di tocco: ogni controllo ha almeno 44 × 44 px (`--size-tocco`). Dove il disegno è più piccolo (`.btn-icona--piccolo` 32 px, `.casella` e `.tondo-spunta` 22 px, `.toggle` 26 px di altezza, `.chip` 36 px, `.selettore__voce` 32 px di altezza; dalla #67 anche `.btn-icona` 40 px, `a.quadrato-nest` 40 px, `.btn--piccolo` e `.btn-tenue` alti 40 px, `.btn-aggiungi--desktop`, `.btn-link` e `.btn-pericolo` per la larghezza, i link di `.stato-vuoto__testo`, `.puntina` e `.scelta-colore__colore`) l'area si allarga con un `::before` trasparente centrato o con il padding della riga, senza cambiare il disegno. **Attenzione:** un elemento con `overflow: hidden` taglia il proprio `::before`, e le parti tagliate non ricevono i tocchi. È il caso di `.selettore__voce`: lì il taglio passa a una `clip-path` (vedi «Componenti condivisi di Casa» in `riferimento/componenti.md`). Restano fuori solo i link dentro una frase (`.legale__link`, eccezione «in linea»), il quadrato decorativo `.quadrato-nest--notte` e `.nav-alto__voce` (esiste solo da 1024 px). Le aree di due controlli vicini non si sovrappongono. Il «Torna a Oggi» degli stati «In arrivo» non è «in linea»: ha l'area di 44 px, che copre in parte la riga sopra.

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
- Ombre sulle schede: si staccano dal fondo con il bianco e il filo interno di 1 px. Ombre solo per barre, fogli, modali e adesivi.
- Rosso per dire «tra poco»; `--color-inchiostro-3` per il testo; colore delle persone fuori dagli avatar.
- Hamburger (il Nest si apre dal quadrato colorato), righello del tempo in cima a Oggi, selettore Oggi/Domani/Weekend in Oggi.
- Bottoni dentro altri bottoni o link.
- Testi segnaposto («Lorem ipsum», «Titolo qui»), parole tecniche, punti esclamativi, emoji.
- Campi data e ora senza la classe `.campo__input` o formattati fuori dalle funzioni di `src/lib/`.
- Spinner a pagina intera.
