# #506 · F5 Guscio e navigazione nuova · dettagli del requisito

Requisito e criteri di accettazione (CA) sono nella issue #506. Qui ci sono le tabelle che la issue cita con «§». Se issue e file si contraddicono, vale la issue. Fonti: `docs/design/computer/regole.md`, `.claude/skills/design-system/riferimento/computer.md` e `telefono.md`, `docs/design/telefono/` (`oggi/og1-02`–`og1-04`, `scelte-p7/sc1-18`, `sc1-19`, `calendario/`, `app-fase-b/cb1-10`, `cb1-43`), `docs/design/computer/` (`oggi/01`, `03`, `09`; `casa/01`; `web-da-telefono/01`, `08`). Dove questo file aggiunge qualcosa che il design non dice, lo segna con **(default)** e la domanda è nella issue.

Si danno per uniti F1 (#477), F2 (#196), F3 (#502), F4a–c (#503–#505): token, nome del prodotto da un punto solo, freccia indietro D, righe, pulsanti, interruttore, finestra al centro e conferme.

## §1 Larghezze e disposizioni

Soglie uniche di D8 (risposta 214, `docs/design/tablet/decisioni.md`; tavole `docs/design/tablet/regole/01-…` e `docs/design/computer/regole/p17-01-…`). I valori 760, 1100 e 1440 delle versioni precedenti di questo file e di `docs/design/computer/regole.md` sono superati.

| Finestra                                 | Disposizione                                                                                                                                                                                  | Navigazione                   | Barra in alto                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| alta meno di 600 px, qualunque larghezza | telefono (anche il telefono girato in orizzontale, risposta 213)                                                                                                                              | barra in basso flottante      | testata del telefono (§4)                            |
| larga fino a 899 px                      | telefono: una colonna, margini `--grid-margine-mobile`; dove la finestra è più larga del telefono (tablet in verticale, 768–834 px) liste e moduli in una colonna di 640 px al centro (sotto) | barra in basso flottante      | testata del telefono (§4)                            |
| da 900 a 1279 px, alta almeno 600        | computer con la barra a icone; pannello di 380 px (§7)                                                                                                                                        | barra laterale a icone, 72 px | barra in alto da computer (§6)                       |
| da 1280 px, alta almeno 600              | computer: contenuto a 12 colonne, canalina 24, margini 32; l'area del contenuto (margini compresi) è larga al massimo 1200 px, centrata nello spazio a destra della barra (§7)                | barra laterale intera, 248 px | barra in alto da computer, larga quanto il contenuto |
| pannello aperto                          | qualunque finestra con la forma del computer                                                                                                                                                  | barra laterale a icone        | invariata                                            |

- Le soglie sono **900 e 1280 px di larghezza e 600 px di altezza**. Forma del telefono: `(max-width: 899px), (max-height: 599px)`. Barra a icone: `(min-width: 900px) and (max-width: 1279px) and (min-height: 600px)`. Barra intera: `(min-width: 1280px) and (min-height: 600px)`. In TypeScript vivono in un solo modulo (proposto `src/lib/breakpoints.ts`) con un hook `useShellLayout(): "telefono" | "icone" | "intera"` che applica le stesse tre condizioni, altezza compresa.
- 1200 px non è una soglia: è `max-width: var(--size-contenuto-max)` dell'area del contenuto, senza media query. Con la barra intera di 248 px il limite si vede da circa 1448 px (la tavola «computer largo» a 1440 px); oltre crescono solo i margini.
- **Tablet (D8):** non ha pagine sue, conta la finestra. In verticale (768–834 px) vale la riga «fino a 899 px», in orizzontale (1024–1194 px) la riga «da 900 a 1279 px»; con due app affiancate torna la forma del telefono. Tavole in `docs/design/tablet/`.
  - **Colonna di 640 px (risposta 207):** sotto i 900 px, quando la finestra è più larga di 640 px più i margini del telefono, liste e moduli stanno in una colonna larga al massimo 640 px, centrata; testata e barra in basso restano larghe quanto la finestra (`verticale/11`–`14`). La colonna la mette ogni pagina con la classe di disposizione della sua specifica; il guscio non la impone. Valore da portare in token (`--size-colonna-tablet`, 640 px) nella PR di F5 **(default)**.
  - **Rotazione:** la pagina resta la stessa, nello stesso punto (stessa data, stessa riga in cima); la voce scelta resta scelta passando dalla barra in basso alla laterale; quello che è aperto resta aperto (il foglio dal basso diventa pannello o finestra, con quello che si era scritto, e viceversa); il fuoco resta sullo stesso elemento. Dissolvenza di 200 ms (`--durata-rapida`), immediata con il movimento ridotto.
- **Tocco di almeno 44 px su tutti i formati (risposta 217):** nessun comando del guscio ha un'area di tocco sotto i 44 × 44 px, nemmeno da computer (voci a icone 48, campo Cerca alto 40 e pulsanti alti 40 hanno l'area allargata con `::before` o con il padding, senza cambiare il disegno). Si verifica con `elementFromPoint` (LEZIONI).
  - **Ultimo gesto (tablet):** nelle pagine del computer usate col dito i comandi piccoli salgono anche nel disegno a 44 px (tavole `docs/design/tablet/orizzontale-comandi-44-px/`: Cerca, campanella e «Nuovo impegno» da 40 a 44, «Chiudi» e piede del pannello a 44). Il guscio scrive sull'elemento `html` l'attributo `data-gesto="tocco" | "puntatore"` dal `pointerType` dell'ultimo `pointerdown` (`touch` e `pen` → `tocco`); al primo disegno vale `tocco` se `(pointer: coarse)`, altrimenti `puntatore` **(default)**. Le regole a 44 px si scrivono come `[data-gesto="tocco"] .classe { … }`, solo nelle disposizioni del computer. Con mouse o trackpad tornano le misure del computer.
  - **Tastiera esterna:** le lettere delle scorciatoie accanto ai comandi (`kbd`) si vedono solo con `data-gesto="puntatore"` o dopo un tasto premuto: con il dito restano nascoste, le scorciatoie funzionano lo stesso (§8). Il browser non dice se una tastiera è collegata: il primo tasto premuto vale come «tastiera collegata» **(default)**.
- **Migrazione delle soglie (default):** F5 cambia le soglie del guscio. `useIsDesktop()` di F4c usa già le stesse condizioni (specifica 505 §2: finestra da 900 px e alta almeno 600); F5 lo fa leggere da `src/lib/breakpoints.ts`, così le soglie restano in un punto solo. Le regole interne delle pagine già sviluppate (oggi a 768 e 1024 px in `components.css`) le riallinea ogni pagina A1–A25 nella sua PR. Finché una pagina non lo fa, tra 900 e 1023 px può mostrare la sua disposizione da telefono dentro la barra laterale a icone: è previsto e non è un difetto di F5.
- **Contenuto come contenitore:** l'area del contenuto (il `main`) ha `container-type: inline-size` e `container-name: contenuto`. Le pagine decidono una o due colonne con `@container contenuto (min-width: 900px)`, non con la larghezza della finestra: così vale la regola unica del pannello («conta la larghezza che resta al contenuto», `regole.md` §4).

## §2 Rotte: guscio per rotta e migrazione

`src/lib/app-routes.ts` si riscrive con un **elenco esplicito** (una riga per rotta, niente prefissi generici: LEZIONI). Colonne: voce attiva (barra in basso e laterale), testata del telefono, barra in basso sul telefono, titolo e azione della barra in alto da computer.

**`hasAppRoute(pathname: string): boolean`** (aggiunta del 27/11, analisi di #623, CA-1–CA-4): esportata da `app-routes.ts`, dice se un indirizzo è una rotta dell'app che esiste. **Legge lo stesso elenco esplicito di questa tabella**: non esiste una seconda lista di rotte, né in quel file né altrove (lo verifica un test). È vera per le righe dell'elenco, con i segmenti dinamici (`[id]`, `[spazio]`) che accettano un solo segmento; accetta `/` finale, query e frammento; è falsa per indirizzi senza `/` iniziale, con origine o `//`, con maiuscole diverse, per segmenti in più (`/impegni/a/b`), per le rotte che sono solo reindirizzamenti (`/esplora`) e per le righe non ancora nell'elenco (`/impostazioni/aspetto` finché A18 non le aggiunge). Lavora sul `pathname` normalizzato con `new URL(raw, base)` come `isAppPath` (§10). La usano la regola di «Di casa» (§5: Ricette e Animali compaiono quando la loro rotta è nell'elenco) e le righe «se esiste» delle pagine A16–A18. Le righe nuove di `/impostazioni/*` e l'indirizzo nuovo dell'ingranaggio di `/notifiche` entrano nella PR di A18, non in F5 (decisione 2 di #623).

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
| `AppBar` (`.barra`)                                                                                         | testata del telefono (§4), mostrata solo con la forma del telefono (§1); senza `NestSquare`  |
| `AddShortcut` (N → `/aggiungi`, da 1024 px)                                                                 | sostituito dal gestore unico delle scorciatoie (§8)                                          |
| `SearchShortcut` (Ctrl/Cmd+K)                                                                               | sparisce **(default)**: la ricerca si apre con «/» e K è di «Chiedi a Nest» (`regole.md` §9) |
| `SkipLink`, `BarAction`, `NestProvider`, `NotificationCount`, `FrameError`, `OverlayRoute`, `ResetOnReveal` | restano                                                                                      |
| `SettingsMenu` (menu laterale delle impostazioni)                                                           | resta dentro le pagine fino ad A17/A18                                                       |
| classi `.nav-alto*`, `.nav-basso*`, `.btn-aggiungi*` in `components.css`                                    | si tolgono; nessun uso resta in `src/`                                                       |

Ingresso ad Aggiungi (corretto nella PR di F5, #656): sul telefono la barra in basso non ha più il +, e non tutte le pagine hanno già un link a `/aggiungi` nel contenuto. Calendario (settimana) lo ha. Oggi non lo aveva sul telefono (il campo rapido c'era solo nella disposizione da computer): F5 aggiunge un +, un quadrato pieno da 44 (`.btn-icona--pieno`, nome accessibile «Nuovo impegno») a destra dell'inizio del blocco degli impegni di oggi, sotto i 1024 px; il titolo «La giornata», il «restano n impegni» e il giorno nell'indirizzo restano di A1 (#534). Le tre pagine di Casa aggiungono sul posto con il campo rapido e non aprono il foglio: nessun ingresso nuovo. Da computer c'è «Nuovo impegno» nella barra in alto, dove §2 lo prevede.

## §3 Barra in basso (forma del telefono: fino a 899 px, o alta meno di 600)

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

## §5 Barra laterale (da 900 px, alta almeno 600)

Intera (248 px, da 1280 px, pannello chiuso), dall'alto:

1. Marchio dal componente unico di F3 (non è un link: sc1-19).
2. Lente «Io · Nest» (`Lens`, stesso stato condiviso di oggi).
3. `nav` «Navigazione principale»: Oggi, Calendario, Casa, Spazi (icona e nome, voce alta 44, scelta: fondo bianco con filo, `casa/01`).
4. Titoletto «Di casa» (non è un heading: `p`; **default**, è un'etichetta di gruppo) e un secondo `nav` «Di casa» con Spesa (`/casa/spesa`), Ricette, Animali. Ricette e Animali compaiono solo quando la loro rotta è nell'elenco di `app-routes.ts`, cioè quando `hasAppRoute` (§2) dà `true` (B13a #566, A25 #460) **(default)**; finché mancano, «Di casa» ha solo Spesa.
5. In fondo «Chiedi a Nest» con `kbd` «K»: nascosto finché B15 non è unita (§3).
6. Profilo: pallino del colore della persona, nome della persona e sotto «Il tuo Nest»; link a `/nest`, nome accessibile «<Nome>, Il tuo Nest».

A icone (72 px, da 900 a 1279 px o con il pannello aperto): marchio solo segno, lente come pallino della persona (scelta «Io») o del Nest (scelta «Nest»): un clic passa all'altra, nome «Lente: Io» / «Lente: Nest» **(default)**; poi le stesse voci con la sola icona (48 × 48), «Di casa» senza titoletto, Chiedi (se c'è), pallino del profilo. Ogni icona ha il nome completo come nome accessibile e nel fumetto (§7).

Movimento: da intera a icone in 200 ms (`--durata-rapida`, `--curva`); con movimento ridotto subito.

## §6 Barra in alto da computer (da 900 px, alta almeno 600)

Alta 72 px, margini orizzontali 32 px, nell'area del contenuto (non sopra la barra laterale). Da sinistra:

- freccia indietro sulle rotte «dettaglio» di §2, poi il titolo di §2 (700 · 26/32);
- a destra: campo «Cerca» (280 px, minimo 120, alto 40, raggio 12, fondo `--color-carta-2` (ruolo `basso`, #634), `kbd` «/»); campanella «Notifiche»; pulsante pieno «Nuovo impegno» (+) dove §2 lo prevede, verso `/aggiungi`. Una pagina può sostituirlo con il proprio pulsante (stesso posto: «Nuova ricetta» ecc.) con lo stesso meccanismo di `BarAction`.
- **Campo «Cerca» in F5 (default):** è l'ingresso alla ricerca di oggi. Clic, Invio o «/» aprono `/ricerca` come oggi su computer (dialogo sopra la pagina) con il fuoco nel campo della ricerca. Il campo che si allarga a 400 px con i risultati nel fumetto è di A11 (#544). Nessun testo cercato va nell'indirizzo.
- **Campanella:** porta a `/notifiche` **(default)**; il pannello degli avvisi è di A10 (#543).

## §7 Pannello, fumetto, contenuto

- **Pannello a destra** (`Panel`, nuovo in `src/components/ui/`): 420 px da 1280 px, **380 px da 900 a 1279 px** (D8, tavole `docs/design/tablet/orizzontale-comandi-44-px/06` e `orizzontale/01`), filo a sinistra, testata alta 64 con titolo (700 · 18/24) e «Chiudi», piede facoltativo con «Elimina» a sinistra e azioni a destra. Aperto: la barra laterale passa a icone; contenuto = finestra − 72 − pannello (a 1280: 788 px; a 1440: 948 px; a 1194: 742 px; a 1024: 572 px). Entra da destra in 200 ms; con movimento ridotto subito. La larghezza di 380 px va in token (`--size-pannello-stretto`) nella PR di F5 **(default)**.
  - Anche da 900 a 1279 px il pannello sta accanto al contenuto, che si stringe, senza velo (come nella tavola `06` a 1194 px). La regola di prima («sotto i 1100 px copre il contenuto con il velo») è superata.
  - Col dito (`data-gesto="tocco"`, §1) «Chiudi» e i pulsanti del piede sono alti 44 px (tavola `06`).
  - Esc lo chiude e il fuoco torna al comando che l'ha aperto. Aprirlo aggiunge una voce alla cronologia: «indietro» del browser (e domani il tasto indietro di Android) lo chiude senza lasciare la pagina.
  - Il fuoco **non** resta intrappolato (non è una finestra): Tab dal contenuto arriva al pannello per ultimo (§9).
  - In F5 nessuna pagina lo usa: si prova con un esempio nella galleria `/design-system`.
- **Fumetto** delle icone: compare al passaggio del mouse e al fuoco da tastiera, accanto all'icona, con il nome della voce; Esc lo nasconde lasciando il fuoco (WCAG 1.4.13); non riceve il fuoco. È solo visivo: il nome accessibile è sul link.
- **Contenuto:** `main#contenuto` con `tabIndex={-1}`, `container-name: contenuto`, padding 4/32/0 da computer; l'area è larga al massimo `--size-contenuto-max` (1200 px) e centrata, con `max-width` e senza media query (§1).

## §8 Scorciatoie da tastiera (con la forma del computer: da 900 px, alta almeno 600)

Un solo gestore nel guscio (sostituisce `AddShortcut` e `SearchShortcut`).

| Tasto         | Azione in F5                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| O / C / A / S | vai a `/oggi`, `/calendario`, `/casa/spesa`, `/spazi`                                                     |
| N             | preme il pulsante a destra della barra in alto, se c'è («Nuovo impegno» → `/aggiungi`); altrimenti niente |
| /             | apre la ricerca (§6)                                                                                      |
| K             | apre «Chiedi a Nest»: spento finché B15 non è unita                                                       |
| ?             | apre la finestra «Scorciatoie da tastiera»                                                                |
| Esc           | chiude il fumetto, il pannello, la finestra in cima (gestione esistente in `overlay.ts`)                  |

- Non valgono: con il fuoco in `input`, `textarea`, `select` o `contenteditable`; con un dialogo aperto (`[role=dialog]`, `[role=alertdialog]`), tranne Esc; con Ctrl, Cmd o Alt premuti; con `event.repeat`; se l'evento è già stato gestito (`defaultPrevented`). Con la forma del telefono (§1) nessuna (sul telefono non c'è la tastiera fisica, e i tasti non sono disegnati). Sul tablet in orizzontale valgono, anche col dito: le lettere accanto ai comandi si vedono solo con la tastiera (§1, «Tastiera esterna»).
- Le scorciatoie delle pagine (1, 2, 3, T, frecce, Spazio, Invio) le aggiungono le pagine: il guscio offre un registro con cui una pagina dichiara le sue, così «?» le elenca **(default)**.
- **Finestra «Scorciatoie da tastiera»** (finestra stretta di F4c): elenco tasto → azione delle sole scorciatoie attive nella pagina (K solo se c'è Chiedi), con i tasti disegnati (`kbd`, 600 · 11,5). In fondo l'interruttore «Scorciatoie a una lettera» (acceso in partenza). Spento: O, C, A, S, N, / e K non fanno più nulla; resta solo «?», per poterle riaccendere **(default, WCAG 2.1.4; domanda nella issue)**. La scelta si salva in `localStorage` del browser (nessun dato personale) e vale dopo il ricaricamento.
- `aria-keyshortcuts` sui comandi che hanno un tasto: «O», «C», «A», «S» sulle voci; «N» sul pulsante della barra; «/» sul campo Cerca; «K» su Chiedi.
- I tasti seguono la lingua (risposta 173): le lettere stanno in `messages/it.ts`, non nel codice.

## §9 Fuoco e ordine di tabulazione

- **Computer:** «Vai al contenuto» → barra laterale (lente, Oggi, Calendario, Casa, Spazi, voci «Di casa», Chiedi se c'è, profilo) → barra in alto (indietro se c'è, Cerca, Notifiche, pulsante) → contenuto → pannello. Il marchio non riceve il fuoco.
- **Telefono:** «Vai al contenuto» → testata → contenuto → barra in basso (Oggi, Calendario, Casa, Spazi). È l'ordine del DOM di oggi.
- «Vai al contenuto» resta il primo elemento: `<a href="#contenuto">` che sposta il fuoco sul `main` (LEZIONI).
- Anello di fuoco su tutti i comandi del guscio: `outline: var(--border-medio) solid var(--color-fuoco); outline-offset: var(--space-half)` (2 px; `#0F3D44` in chiaro, `#F2F7F5` al buio), `--color-latte` sul fondo di marca (`--color-notte`) e sul fumetto; solo con `:focus-visible`; mai tolto. Lo rende globale #634 (634 §3 E): F5 non aggiunge nulla.
- Mouse sopra, solo dentro `@media (hover: hover)`: voce della barra `--color-premuto`, pulsante pieno `--color-azione` (634 §3 C: in chiaro #10262A → #0F3D44, al buio non cambia; `--color-azione-mouse` non nasce), campo Cerca invariato. Niente movimenti né ombre che compaiono.
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
| `tests/a11y/layout.spec.ts`                                                                                                                                           | tester visivo              | stesse rotte ai formati di D8 (sotto la tabella)                                                             |
| `tests/e2e/esplora*.spec.ts`, `percorso-casa-esplora-impostazioni.spec.ts`, `spaces.spec.ts`                                                                          | tester funzionale          | indirizzi `/spazi`; un test per i reindirizzamenti                                                           |
| i circa 32 file con `nav-basso`, `nav-alto`, `btn-aggiungi`, «Navigazione principale» (`grep -rln "nav-basso\|nav-alto\|btn-aggiungi\|Navigazione principale" tests`) | tester funzionale e visivo | selettori per ruolo e nome; via i clic su «Aggiungi» della barra                                             |
| test che usano Ctrl/Cmd+K o N verso `/aggiungi`                                                                                                                       | tester funzionale          | «/» per la ricerca; N solo dove c'è «Nuovo impegno»                                                          |
| tutti i riferimenti `tests/visual/**`                                                                                                                                 | tester visivo              | rigenerati con `visual-baseline` (cambia il guscio di ogni pagina)                                           |

Formati di D8 per `layout.spec.ts` (a11y e e2e): 390 × 844, 768 × 1024 (tablet in verticale), 899 × 844, 900 × 768, 1024 × 768 e 1194 × 834 (tablet in orizzontale), 1280 × 800, 1280 × 560 (forma del telefono per l'altezza), 1440 × 900. Su ognuno le aree di tocco dei comandi del guscio sono di almeno 44 × 44 px, verificate con `elementFromPoint` (risposta 217); a 1024 × 768 anche con `data-gesto="tocco"`.

## §13 Pezzi condivisi nuovi (per la `richiesta-condivisa`, già etichettata)

- Componenti in `src/components/ui/AppFrame/`: barra in basso nuova, testata del telefono con forma raccolta, `SideNav`, `DesktopBar`, gestore delle scorciatoie con registro, finestra «Scorciatoie da tastiera»; in `src/components/ui/`: `Panel`, fumetto delle icone (`Tooltip`). Ognuno con esempio nella galleria e voce in `componenti.md` e `registro.md` (LEZIONI).
- `src/lib/app-routes.ts` riscritto (tabella di §2, `isAppPath`), `src/lib/breakpoints.ts`, interruttore `ASSISTANT_AVAILABLE`.
- Token nuovi di `computer.md` usati dal guscio: `--size-barra-laterale`, `--size-barra-laterale-icone`, `--size-barra-alto`, `--size-pannello`, `--size-fumetto`, `--size-ricerca`, `--size-contenuto-max`, `--size-pannello-stretto` (380 px) e `--size-colonna-tablet` (640 px) di D8, `--shadow-fumetto`; le quattro `--area-sicura-*`.
- **Colori: nessun token nuovo (#634, 27/11).** I 10 colori di `computer.md` (Passo 11) sono diventati ruoli della tavolozza nel Passo 14, con il valore scuro: F5 usa i token di `docs/specifiche/634-tema-scuro.md` §1, già nel codice con #634.

  | Colore di `computer.md`             | Valore del Passo 11  | Token da usare             | Chiaro · scuro                                |
  | ----------------------------------- | -------------------- | -------------------------- | --------------------------------------------- |
  | `--color-velo-finestra`             | `rgba(16,38,42,.36)` | `--color-velo`             | `rgba(16,38,42,.36)` · `rgba(0,0,0,.62)`      |
  | `--color-barra-laterale`            | `#F5F7F5`            | `--color-carta-2`          | `#F4F6F4` · `#172224`                         |
  | `--color-quieto` (campo Cerca)      | `#F1F3F1`            | `--color-carta-2`          | `#F4F6F4` · `#172224`                         |
  | `--color-lente` (capsula Io · Nest) | `#E6EAE7`            | `--color-premuto`          | `#ECEFEC` · `#263639`                         |
  | `--color-voce-mouse`                | `#E9EDEA`            | `--color-premuto`          | `#ECEFEC` · `#263639`                         |
  | `--color-voce`                      | `#33474B`            | `--color-inchiostro-medio` | `#33474B` · `#C9D5D2`                         |
  | `--color-azione-mouse`              | `#0A2E34`            | `--color-azione`           | `#0F3D44` · `#1F7D8A` (634 §3 C)              |
  | Chiedi: fondo                       | `#FCE7E0`            | `--color-assistente`       | `#FCE7E0` · `#3B2621`                         |
  | Chiedi: icona e filo scelto         | `#C2452D`            | `--color-allerta`          | `#B3261E` · `#FF9D90` (5,49 · 7,05 sul fondo) |
  | Chiedi: filo del tasto              | `#E7B9AB`            | `--color-allerta-bordo`    | `#E7B9AB` · `#7A3A32`                         |

  La barra laterale e il campo Cerca hanno lo stesso fondo (`basso`), ma non si toccano: il campo sta nella barra in alto, bianca. In chiaro nessun campo con il filo `--color-filo-campo` va sopra la barra laterale (2,93 : 1, 634 §7). Chiedi resta nascosto: i suoi token esistono già, non si definisce nulla.

- Nessuna tabella, colonna o policy nuova: niente `richiesta-db`.
