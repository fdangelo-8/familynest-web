# #506 · F5 Guscio e navigazione nuova · dettagli del requisito

Requisito e criteri di accettazione (CA) sono nella issue #506. Qui ci sono le tabelle che la issue cita con «§». Se issue e file si contraddicono, vale la issue. Fonti: `docs/design/computer/regole.md`, `.claude/skills/design-system/riferimento/computer.md` e `telefono.md`, `docs/design/telefono/` (`oggi/og1-02`–`og1-04`, `scelte-p7/sc1-18`, `sc1-19`, `calendario/`, `app-fase-b/cb1-10`, `cb1-43`), `docs/design/computer/` (`oggi/01`, `03`, `09`; `casa/01`; `web-da-telefono/01`, `08`). Dove questo file aggiunge qualcosa che il design non dice, lo segna con **(default)** e la domanda è nella issue.

Si danno per uniti F1 (#477), F2 (#196), F3 (#502), F4a–c (#503–#505): token, nome del prodotto da un punto solo, freccia indietro D, righe, pulsanti, interruttore, finestra al centro e conferme.

## §1 Larghezze e disposizioni

| Larghezza finestra | Disposizione                                                                                                       | Navigazione                   | Barra in alto                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------- |
| fino a 759 px      | telefono: una colonna, margini `--grid-margine-mobile`                                                             | barra in basso flottante      | testata del telefono (§4)                            |
| 760–1099 px        | computer stretto: contenuto a una colonna                                                                          | barra laterale a icone, 72 px | barra in alto da computer (§6)                       |
| 1100–1439 px       | computer: contenuto a 12 colonne, canalina 24, margini 32                                                          | barra laterale intera, 248 px | barra in alto da computer                            |
| da 1440 px         | come sopra; l'area del contenuto (margini compresi) si ferma a 1200 px, centrata nello spazio a destra della barra | barra laterale intera         | barra in alto da computer, larga quanto il contenuto |
| pannello aperto    | qualunque larghezza da 760 px                                                                                      | barra laterale a icone        | invariata                                            |

- Le soglie sono **760, 1100, 1440**. Nel CSS si scrivono come `min-width: 760px` / `max-width: 759px` ecc.; in TypeScript vivono in un solo modulo (proposto `src/lib/breakpoints.ts`) con un hook `useShellLayout(): "telefono" | "icone" | "intera"`.
- **Tablet:** fuori perimetro; vale la riga della sua larghezza.
- **Migrazione delle soglie (default):** F5 cambia solo le soglie del guscio. Le regole interne delle pagine (oggi a 768 e 1024 px in `components.css`) e `useIsDesktop()` (1024 px, foglio o finestra) restano: le riallinea ogni pagina A1–A25. Tra 760 e 1023 px una pagina può quindi mostrare la sua disposizione da telefono dentro la barra laterale a icone: è previsto e non è un difetto di F5.
- **Contenuto come contenitore:** l'area del contenuto (il `main`) ha `container-type: inline-size` e `container-name: contenuto`. Le pagine decidono una o due colonne con `@container contenuto (min-width: 900px)`, non con la larghezza della finestra: così vale la regola unica del pannello («conta la larghezza che resta al contenuto», `regole.md` §4).

## §2 Rotte: guscio per rotta e migrazione

`src/lib/app-routes.ts` si riscrive con un **elenco esplicito** (una riga per rotta, niente prefissi generici: LEZIONI). Colonne: voce attiva (barra in basso e laterale), testata del telefono, barra in basso sul telefono, titolo e azione della barra in alto da computer.

| Rotta                                                                                   | Voce attiva                              | Testata telefono                                                                     | Barra in basso | Computer: titolo · pulsante a destra |
| --------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | -------------- | ------------------------------------ |
| `/oggi`, `/aggiungi`                                                                    | Oggi                                     | sezione: lente, Cerca, Notifiche                                                     | sì             | «Oggi» · «Nuovo impegno»             |
| `/calendario`, `/calendario/giorno`, `/calendario/mese`                                 | Calendario                               | sezione: titolo «Calendario», lente **(default, fino ad A4 #537)**, Cerca, Notifiche | sì             | «Calendario» · «Nuovo impegno»       |
| `/impegni/[id]`                                                                         | Calendario                               | dettaglio: Indietro (ripiego `/calendario`), azione della pagina                     | sì             | «Calendario» · nessuno               |
| `/casa` (reindirizza a `/casa/spesa`), `/casa/spesa`, `/casa/da-fare`, `/casa/scadenze` | Casa                                     | sezione: titolo «Casa», Cerca, Notifiche                                             | sì             | «Casa» · nessuno                     |
| `/spazi` (nuova, ex `/esplora`)                                                         | Spazi                                    | sezione: titolo «Spazi», Cerca, Notifiche                                            | sì             | «Spazi» · nessuno                    |
| `/spazi/[spazio]` (ex `/esplora/[spazio]`, solo i 10 del catalogo)                      | Spazi                                    | dettaglio: Indietro (ripiego `/spazi`), azione della pagina                          | sì             | «Spazi» · nessuno                    |
| `/figli/[id]`, `/figli/[id]/lista-desideri`                                             | Spazi **(default)**; oggi Oggi           | dettaglio come oggi (ripieghi `/nest` e `/figli/[id]`)                               | sì             | «Spazi» · nessuno                    |
| `/notifiche`                                                                            | nessuna **(default)**; oggi Oggi         | dettaglio come oggi (titolo h1, ingranaggio)                                         | sì             | «Notifiche» · nessuno                |
| `/ricerca`                                                                              | nessuna                                  | nessuna (il campo è la barra, come oggi)                                             | no             | dialogo sopra la pagina, come oggi   |
| `/nest`                                                                                 | Spazi sul telefono; profilo sul computer | dettaglio: Indietro (ripiego `/spazi`) **(default)**; oggi «Chiudi» verso `/oggi`    | no             | «Il tuo Nest» · nessuno              |
| `/profilo`, `/impostazioni`, `/calendari-collegati`, `/membri`, `/membri/[id]`          | Spazi sul telefono; profilo sul computer | dettaglio come oggi (ripiego `/nest`)                                                | no             | titolo come oggi · nessuno           |
| indirizzo sconosciuto (404 nella cornice)                                               | nessuna                                  | dettaglio, ripiego `/oggi`                                                           | sì             | nessun titolo · nessuno              |

- **`aria-current`** (regola di oggi, `getNavAriaCurrent`): `"page"` solo sull'indirizzo esatto del link della voce (`/oggi`, `/calendario`, `/casa/spesa`, `/spazi`, `/nest` per il profilo), `"true"` sulle altre rotte della stessa voce, niente altrove. Al massimo una voce principale attiva. Le scorciatoie «Di casa» **non** sono mai attive (nel canvas `casa/01` su Spesa è scelta Casa, non la scorciatoia) **(default)**.
- **Un solo h1 visibile** per rotta e per larghezza: il titolo della testata o della barra in alto è `h1` solo dove la pagina non ne scrive uno (come oggi `titleIsHeading`); altrimenti è un `p`. Le pagine non cambiano il loro h1 in F5.
- **Spazi:** la cartella `src/app/(app)/esplora/` diventa `src/app/(app)/spazi/` con lo stesso contenuto (la pagina vera è A16 #549). Reindirizzamenti permanenti (308): `/esplora` → `/spazi`; `/esplora/<spazio>` → `/spazi/<spazio>` per i 10 indirizzi del catalogo (`src/lib/spaces.ts`, campo `href` aggiornato); ogni altro `/esplora/...` resta 404 nella cornice. Nessun link dell'app punta più a `/esplora` (oggi: `oggi/Sections.tsx` 2 volte, `nest/page.tsx`, `esplora/SpaceComingPage.tsx`).
- **«Il tuo Nest» in Spazi:** in fondo alla pagina `/spazi` si aggiunge la riga «Il tuo Nest» («Persone, piano, impostazioni») verso `/nest`, come in `sc1-19`. Serve perché sul telefono il quadrato del Nest (`NestSquare`) esce dalla testata (risposta 123) e `/nest` resterebbe senza ingresso.
- **Titolo della scheda del browser di `/spazi`:** «Spazi» con il nome del prodotto dal punto unico di F3, nella stessa forma delle altre pagine.

### Componenti del vecchio guscio

| Oggi (`src/components/ui/AppFrame/`)                                                                        | Dopo F5                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `TopNav` (`.nav-alto`)                                                                                      | sparisce; al suo posto `SideNav` (barra laterale) e `DesktopBar` (barra in alto da computer) |
| `BottomNav` (`.nav-basso`, `btn-aggiungi`)                                                                  | barra in basso nuova a 4 voci, senza `btn-aggiungi`                                          |
| `AppBar` (`.barra`)                                                                                         | testata del telefono (§4), mostrata solo sotto i 760 px; senza `NestSquare`                  |
| `AddShortcut` (N → `/aggiungi`, da 1024 px)                                                                 | sostituito dal gestore unico delle scorciatoie (§8)                                          |
| `SearchShortcut` (Ctrl/Cmd+K)                                                                               | sparisce **(default)**: la ricerca si apre con «/» e K è di «Chiedi a Nest» (`regole.md` §9) |
| `SkipLink`, `BarAction`, `NestProvider`, `NotificationCount`, `FrameError`, `OverlayRoute`, `ResetOnReveal` | restano                                                                                      |
| `SettingsMenu` (menu laterale delle impostazioni)                                                           | resta dentro le pagine fino ad A17/A18                                                       |
| classi `.nav-alto*`, `.nav-basso*`, `.btn-aggiungi*` in `components.css`                                    | si tolgono; nessun uso resta in `src/`                                                       |

Le pagine non perdono l'ingresso ad Aggiungi: Oggi, Calendario (settimana, giorno, mese) e le tre pagine di Casa hanno già un link a `/aggiungi` nel contenuto.

## §3 Barra in basso (telefono, fino a 759 px)

- Capsula flottante con quattro voci, ciascuna icona sopra ed etichetta sotto: **Oggi** (sole), **Calendario** (calendario), **Casa** (casa), **Spazi** (quattro quadrati). Ordine fisso. Voce scelta: etichetta 700 e icona piena; le altre 400 e icona a filo (`og1-02`, `sc1-18`). Area di tocco di ogni voce almeno 44 × 44.
- Link: `/oggi`, `/calendario`, `/casa/spesa`, `/spazi`. `nav` con nome accessibile «Navigazione principale».
- **Disco dell'assistente** a destra della capsula: non si mostra finché B15 (#386) non è unita (default 8 del piano). Un solo interruttore nel codice (proposto `ASSISTANT_AVAILABLE = false` in `src/lib/`), lo stesso che spegne «Chiedi a Nest» nella barra laterale e il tasto K. Senza disco la capsula si allarga fino ai margini di pagina **(default; misura da confermare dal designer)**.
- **Punto delle novità** su Spazi (risposta 129): pallino `--color-allerta` sull'icona; il nome accessibile diventa «Spazi, ci sono novità». Il guscio riceve un booleano; finché DB-7 (#516) e B5 (#564) non esistono vale sempre `false`. Si spegne aprendo Novità (lo fa B5).
- Posizione: fissa in basso, a `8px + var(--area-sicura-basso)` dal fondo della finestra visibile. Con la barra del browser in basso (molti Android e Safari) la barra dell'app resta sopra con il suo margine (`web-da-telefono/01`): si usa l'altezza visibile (`100dvh` o `position: fixed; bottom`), mai `100vh`.
- Il contenuto ha in fondo 128 px di spazio quando c'è la barra (`telefono.md`): niente resta coperto.
- Misure, ombra e fondo della capsula: il passaggio di Fable non le dà (`telefono.md`, «Valori mancanti»). Le misura il designer sul canvas nella sua specifica grafica; lo sviluppatore non le inventa.

## §4 Testate del telefono

- **Sezione** (Oggi, Calendario, Casa, Spazi): a sinistra la lente (Oggi) o il titolo della sezione 700 · 30/36 (Calendario, Casa, Spazi; sul Calendario anche la lente fino ad A4); a destra, nudi, «Cerca» (lente d'ingrandimento → `/ricerca`) e «Notifiche» (campanella → `/notifiche`, pallino `--color-allerta` se ci sono notifiche nuove, nome «Notifiche, N nuove» come oggi). Su Oggi la scena sotto i comandi arriva con A1/F6: in F5 la testata di Oggi è bianca, come la forma raccolta (`og1-03`).
- **Raccolta quando si scorre** (`og1-03`): quando la testata alta esce dallo schermo resta in cima una barra bianca alta `--size-barra-alta` (56 px) più `var(--area-sicura-alto)`, filo `--color-filo-barra` sotto, con gli stessi comandi nudi. A sinistra: la lente su Oggi, il nome della sezione in stile «titolo della barra» (`--text-titolo-barra-*`) sulle altre **(default: il design mostra solo Oggi)**. Tornando in cima la barra raccolta sparisce. Con movimento ridotto compare e sparisce senza transizione.
- **Dettaglio:** freccia indietro D di F4a a sinistra (nome «Indietro»; torna alla pagina precedente dell'app o al ripiego di §2 se non c'è), a destra l'azione della pagina (`BarAction`, come oggi). Il titolo grande è dentro la pagina.

## §5 Barra laterale (da 760 px)

Intera (248 px, da 1100 px, pannello chiuso), dall'alto:

1. Marchio dal componente unico di F3 (non è un link: sc1-19).
2. Lente «Io · Nest» (`Lens`, stesso stato condiviso di oggi).
3. `nav` «Navigazione principale»: Oggi, Calendario, Casa, Spazi (icona e nome, voce alta 44, scelta: fondo bianco con filo, `casa/01`).
4. Titoletto «Di casa» (non è un heading: `p`; **default**, è un'etichetta di gruppo) e un secondo `nav` «Di casa» con Spesa (`/casa/spesa`), Ricette, Animali. Ricette e Animali compaiono solo quando la loro rotta è nell'elenco di `app-routes.ts` (B13a #566, A25 #460) **(default)**; finché mancano, «Di casa» ha solo Spesa.
5. In fondo «Chiedi a Nest» con `kbd` «K»: nascosto finché B15 non è unita (§3).
6. Profilo: pallino del colore della persona, nome della persona e sotto «Il tuo Nest»; link a `/nest`, nome accessibile «<Nome>, Il tuo Nest».

A icone (72 px, sotto i 1100 px o con il pannello aperto): marchio solo segno, lente come pallino della persona (scelta «Io») o del Nest (scelta «Nest»): un clic passa all'altra, nome «Lente: Io» / «Lente: Nest» **(default)**; poi le stesse voci con la sola icona (48 × 48), «Di casa» senza titoletto, Chiedi (se c'è), pallino del profilo. Ogni icona ha il nome completo come nome accessibile e nel fumetto (§7).

Movimento: da intera a icone in 200 ms (`--durata-rapida`, `--curva`); con movimento ridotto subito.

## §6 Barra in alto da computer (da 760 px)

Alta 72 px, margini orizzontali 32 px, nell'area del contenuto (non sopra la barra laterale). Da sinistra:

- freccia indietro sulle rotte «dettaglio» di §2, poi il titolo di §2 (700 · 26/32);
- a destra: campo «Cerca» (280 px, minimo 120, alto 40, raggio 12, fondo `--color-quieto`, `kbd` «/»); campanella «Notifiche»; pulsante pieno «Nuovo impegno» (+) dove §2 lo prevede, verso `/aggiungi`. Una pagina può sostituirlo con il proprio pulsante (stesso posto: «Nuova ricetta» ecc.) con lo stesso meccanismo di `BarAction`.
- **Campo «Cerca» in F5 (default):** è l'ingresso alla ricerca di oggi. Clic, Invio o «/» aprono `/ricerca` come oggi su computer (dialogo sopra la pagina) con il fuoco nel campo della ricerca. Il campo che si allarga a 400 px con i risultati nel fumetto è di A11 (#544). Nessun testo cercato va nell'indirizzo.
- **Campanella:** porta a `/notifiche` **(default)**; il pannello degli avvisi è di A10 (#543).

## §7 Pannello, fumetto, contenuto

- **Pannello a destra** (`Panel`, nuovo in `src/components/ui/`): 420 px, filo a sinistra, testata alta 64 con titolo (700 · 18/24) e «Chiudi», piede facoltativo con «Elimina» a sinistra e azioni a destra. Aperto: la barra laterale passa a icone; contenuto = finestra − 72 − 420 (a 1280: 788 px; a 1440: 948 px). Entra da destra in 200 ms; con movimento ridotto subito.
  - Sotto i 1100 px il pannello copre il contenuto da destra, con il velo `--color-velo-finestra` **(default: non disegnato)**.
  - Esc lo chiude e il fuoco torna al comando che l'ha aperto. Aprirlo aggiunge una voce alla cronologia: «indietro» del browser (e domani il tasto indietro di Android) lo chiude senza lasciare la pagina.
  - Il fuoco **non** resta intrappolato (non è una finestra): Tab dal contenuto arriva al pannello per ultimo (§9).
  - In F5 nessuna pagina lo usa: si prova con un esempio nella galleria `/design-system`.
- **Fumetto** delle icone: compare al passaggio del mouse e al fuoco da tastiera, accanto all'icona, con il nome della voce; Esc lo nasconde lasciando il fuoco (WCAG 1.4.13); non riceve il fuoco. È solo visivo: il nome accessibile è sul link.
- **Contenuto:** `main#contenuto` con `tabIndex={-1}`, `container-name: contenuto`, padding 4/32/0 da computer; da 1440 px l'area è larga al massimo `--size-contenuto-max` (1200 px) e centrata.

## §8 Scorciatoie da tastiera (da 760 px)

Un solo gestore nel guscio (sostituisce `AddShortcut` e `SearchShortcut`).

| Tasto         | Azione in F5                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| O / C / A / S | vai a `/oggi`, `/calendario`, `/casa/spesa`, `/spazi`                                                     |
| N             | preme il pulsante a destra della barra in alto, se c'è («Nuovo impegno» → `/aggiungi`); altrimenti niente |
| /             | apre la ricerca (§6)                                                                                      |
| K             | apre «Chiedi a Nest»: spento finché B15 non è unita                                                       |
| ?             | apre la finestra «Scorciatoie da tastiera»                                                                |
| Esc           | chiude il fumetto, il pannello, la finestra in cima (gestione esistente in `overlay.ts`)                  |

- Non valgono: con il fuoco in `input`, `textarea`, `select` o `contenteditable`; con un dialogo aperto (`[role=dialog]`, `[role=alertdialog]`), tranne Esc; con Ctrl, Cmd o Alt premuti; con `event.repeat`; se l'evento è già stato gestito (`defaultPrevented`). Sotto i 760 px nessuna (sul telefono non c'è la tastiera fisica, e i tasti non sono disegnati).
- Le scorciatoie delle pagine (1, 2, 3, T, frecce, Spazio, Invio) le aggiungono le pagine: il guscio offre un registro con cui una pagina dichiara le sue, così «?» le elenca **(default)**.
- **Finestra «Scorciatoie da tastiera»** (finestra stretta di F4c): elenco tasto → azione delle sole scorciatoie attive nella pagina (K solo se c'è Chiedi), con i tasti disegnati (`kbd`, 600 · 11,5). In fondo l'interruttore «Scorciatoie a una lettera» (acceso in partenza). Spento: O, C, A, S, N, / e K non fanno più nulla; resta solo «?», per poterle riaccendere **(default, WCAG 2.1.4; domanda nella issue)**. La scelta si salva in `localStorage` del browser (nessun dato personale) e vale dopo il ricaricamento.
- `aria-keyshortcuts` sui comandi che hanno un tasto: «O», «C», «A», «S» sulle voci; «N» sul pulsante della barra; «/» sul campo Cerca; «K» su Chiedi.
- I tasti seguono la lingua (risposta 173): le lettere stanno in `messages/it.ts`, non nel codice.

## §9 Fuoco e ordine di tabulazione

- **Computer:** «Vai al contenuto» → barra laterale (lente, Oggi, Calendario, Casa, Spazi, voci «Di casa», Chiedi se c'è, profilo) → barra in alto (indietro se c'è, Cerca, Notifiche, pulsante) → contenuto → pannello. Il marchio non riceve il fuoco.
- **Telefono:** «Vai al contenuto» → testata → contenuto → barra in basso (Oggi, Calendario, Casa, Spazi). È l'ordine del DOM di oggi.
- «Vai al contenuto» resta il primo elemento: `<a href="#contenuto">` che sposta il fuoco sul `main` (LEZIONI).
- Anello di fuoco su tutti i comandi del guscio: `outline: var(--border-medio) solid var(--color-azione); outline-offset: var(--space-half)` (2 px, `#0F3D44`), `--color-latte` sui fondi scuri; solo con `:focus-visible`; mai tolto. Se F4a lo ha già reso globale, F5 non aggiunge nulla.
- Mouse sopra, solo dentro `@media (hover: hover)`: voce della barra `--color-voce-mouse`, pulsante pieno `--color-azione-mouse` (domanda nella issue), campo Cerca invariato. Niente movimenti né ombre che compaiono.
- Cambiando pagina con la barra, il fuoco va sull'h1 della pagina nuova (comportamento attuale delle pagine con `tabIndex={-1}` sull'h1): F5 non lo cambia.

## §10 Predisposizione per le app negli store (N0 #591, N1)

F5 **non** installa Capacitor e non scrive codice nativo. Prepara solo:

- **Aree sicure:** quattro variabili in `globals.css`: `--area-sicura-alto: env(safe-area-inset-top, 0px)` e così `-basso`, `-sinistra`, `-destra`. Le usano barra in basso, testata e barra raccolta, barra laterale (alto, basso e sinistra), pannello (alto, basso, destra). `viewport-fit=cover` resta in `src/app/layout.tsx`. Nessun `env(safe-area-*)` scritto altrove nel guscio: solo le variabili.
- **Tasto indietro di Android:** il guscio nativo chiamerà `history.back()`. Perciò: ogni passaggio tra pagine fatto dalla navigazione è una voce di cronologia (`router.push`, mai `replace`, tranne i reindirizzamenti); pannello e fogli aperti dal guscio si chiudono con «indietro» (§7); con la cronologia vuota la freccia indietro usa il ripiego di §2. Nessun ascoltatore di `popstate` che impedisce di tornare indietro.
- **Collegamenti:** ogni pagina e ogni stato che si condivide si apre dal suo indirizzo, anche senza cronologia e senza sessione (senza sessione si passa da `/accesso` con il ritorno all'indirizzo, come oggi). `app-routes.ts` esporta `isAppPath(pathname: string): boolean`: vero per le rotte di §2 e per quelle pubbliche (`/accesso/*`, `/onboarding/*`, `/invito/*`, `/desideri/[codice]`, `/privacy`, `/termini`), falso per tutto il resto (`/api/*`, `/fornitore-finto/*`, `/design-system/*`, indirizzi con origine diversa o che cominciano con `//`). Lavora sul `pathname` già normalizzato con `new URL(raw, base)` (LEZIONI). Lo userà il guscio nativo per decidere che cosa aprire dentro l'app («il guscio apre solo il dominio dell'app», ARCHITETTURA).
- **Nessuna API del browser chiamata direttamente dal guscio** per funzioni con equivalente nativo (vibrazione, condivisione): F5 non ne usa.

## §11 Testi (in `src/lib/i18n/messages/it.ts`, gruppo proposto `shell`)

«Navigazione principale», «Oggi», «Calendario», «Casa», «Spazi», «Spazi, ci sono novità», «Di casa», «Spesa», «Ricette», «Animali», «Chiedi a Nest» (nome dal punto unico di F3), «Il tuo Nest», «Cerca», «Notifiche», «Notifiche, {count} nuove» (forme singolare e plurale come oggi), «Nuovo impegno», «Indietro», «Vai al contenuto», «Lente: Io», «Lente: Nest», «Scorciatoie da tastiera», «Scorciatoie a una lettera», le azioni della tabella di §8 come scritte in `regole.md` §9 («Vai a Oggi», «Cerca», «Mostra questo elenco», ecc.), le lettere O, C, A, S, N, K, /, ?, «Persone, piano, impostazioni».

## §12 Test da toccare nella stessa PR

| File                                                                                                                                                                  | Chi                        | Cosa                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tests/e2e/layout.spec.ts` (voce attiva, navigazione in basso, forma della barra, navigazione in alto, CA del vecchio guscio)                                         | tester funzionale          | riscritti sulla tabella di §2: quattro voci, Spazi, niente `btn-aggiungi`, niente `nav-alto`, barra laterale |
| `tests/a11y/layout.spec.ts`                                                                                                                                           | tester visivo              | stesse rotte a 390, 1040, 1280, 1440                                                                         |
| `tests/e2e/esplora*.spec.ts`, `percorso-casa-esplora-impostazioni.spec.ts`, `spaces.spec.ts`                                                                          | tester funzionale          | indirizzi `/spazi`; un test per i reindirizzamenti                                                           |
| i circa 32 file con `nav-basso`, `nav-alto`, `btn-aggiungi`, «Navigazione principale» (`grep -rln "nav-basso\|nav-alto\|btn-aggiungi\|Navigazione principale" tests`) | tester funzionale e visivo | selettori per ruolo e nome; via i clic su «Aggiungi» della barra                                             |
| test che usano Ctrl/Cmd+K o N verso `/aggiungi`                                                                                                                       | tester funzionale          | «/» per la ricerca; N solo dove c'è «Nuovo impegno»                                                          |
| tutti i riferimenti `tests/visual/**`                                                                                                                                 | tester visivo              | rigenerati con `visual-baseline` (cambia il guscio di ogni pagina)                                           |

## §13 Pezzi condivisi nuovi (per la `richiesta-condivisa`, già etichettata)

- Componenti in `src/components/ui/AppFrame/`: barra in basso nuova, testata del telefono con forma raccolta, `SideNav`, `DesktopBar`, gestore delle scorciatoie con registro, finestra «Scorciatoie da tastiera»; in `src/components/ui/`: `Panel`, fumetto delle icone (`Tooltip`). Ognuno con esempio nella galleria e voce in `componenti.md` e `registro.md` (LEZIONI).
- `src/lib/app-routes.ts` riscritto (tabella di §2, `isAppPath`), `src/lib/breakpoints.ts`, interruttore `ASSISTANT_AVAILABLE`.
- Token nuovi di `computer.md` usati dal guscio: `--size-barra-laterale`, `--size-barra-laterale-icone`, `--size-barra-alto`, `--size-pannello`, `--size-fumetto`, `--size-ricerca`, `--size-contenuto-max`, `--shadow-fumetto`, `--color-velo-finestra`, `--color-barra-laterale`, `--color-quieto`, `--color-lente`, `--color-voce-mouse`, `--color-voce`, `--color-chiedi-*` (solo definiti: Chiedi è nascosto); le quattro `--area-sicura-*`.
- Nessuna tabella, colonna o policy nuova: niente `richiesta-db`.
