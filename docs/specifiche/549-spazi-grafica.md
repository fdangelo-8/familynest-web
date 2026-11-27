# #549 · A16 Spazi (ex Esplora): tessere e righe, punto novità, Il tuo Nest · specifica grafica

Designer, 26/11/2026. Fonti: `docs/design/telefono/` (D4) e `docs/design/computer/` (D5); token e Componenti 2.0 in `.claude/skills/design-system/riferimento/telefono.md` e `computer.md`; basi F2–F5 (`docs/specifiche/196-*`, `502-*` … `506-*`). Qui solo quello che le PNG non dicono. Spazi su computer non è disegnato (domanda 183: arriva con il Passo 12): fino ad allora vale il telefono adattato con `docs/design/computer/regole.md`, con riferimenti visivi provvisori. Tablet fuori perimetro. Le domande aperte sono nel commento della designer su #549.

## 1. Quali PNG valgono

| Momento                           | PNG che vale                            | Passo | Nota                                                                                                                                   |
| --------------------------------- | --------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pieno, famiglia                   | `scelte-p7/sc1-18`, `app-fase-b/cb1-28` | 7, 6  | Uguali: le prime quattro voci a tessere, le altre righe (risposta 133).                                                                |
| Fondo della pagina, «Il tuo Nest» | `scelte-p7/sc1-19`                      | 7     | Riga staccata dalle altre, in fondo (risposta 123).                                                                                    |
| Coppia                            | `app-fase-b/cb1-30`                     | 6     | Con le tessere: è già del Passo 7. La frase sotto le righe dice che cosa manca e perché.                                               |
| Aggiornamento non riuscito        | `app-fase-b/cb1-33`                     | 6     | Valgono l'avviso e i sottotitoli «salvati»; **la disposizione è quella del Passo 7** (tessere + righe), non le sole righe di `cb1-33`. |
| «Ogni cosa vive in un posto solo» | `app-fase-b/cb1-29`                     | 6     | Pagina di spiegazione: l'ingresso non è disegnato (domanda 3).                                                                         |
| Esplora dentro Spazi              | `gamification/gm4-06`                   | 5     | Tempo insieme e Stare bene sono righe di Spazi (risposta 154), non una pagina «Esplora». Dopo il lancio.                               |
| Punto delle novità                | `sc1-18` (barra)                        | 7     | Risposta 129.                                                                                                                          |
| Disco dell'assistente nella barra | tutte                                   | —     | Nascosto finché B15 non c'è (default 8 del piano).                                                                                     |

## 2. Disposizione e misure (390 px)

Misure dalle PNG (780 px, divise per 2).

| Parte              | Misure e token                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testata            | Testata di F5: `h1` «Spazi» 700 `--text-titolo-pagina-*` a sinistra, Cerca e Notifiche a destra (icone 24 nude, aree 44).                                                                                                                                                                                                                                                                                                                                                                    |
| Frase              | 400 `--text-sottotitolo-*` `--color-inchiostro-2`, `--space-6` sopra, `--space-4` sotto. Assente in `sc1-19` solo perché la tavola è scorsa: c'è sempre.                                                                                                                                                                                                                                                                                                                                     |
| Tessere            | Griglia `repeat(2, minmax(0, 1fr))`, `gap: var(--space-3)`. Tessera: `<a>` con bordo 1 px `--color-filo-2`, raggio `--radius-l`, padding `--space-4`, `min-height` 118, nessuna ombra. Icona nuda 24 in alto; titolo 700 `--text-titolo-barra-*` spinto in basso (`margin-top: auto`, almeno `--space-8` sotto l'icona); sotto, una riga 400 `--text-corpo-*` `--color-inchiostro-2`, che va a capo (`cb1-30`, «La mamma di Laura, sabato»). Le tessere di una fila hanno la stessa altezza. |
| Righe              | Righe B: icona nuda 24, titolo 600, sotto 400 `--color-inchiostro-2`, freccia sottile `chevron-right` `--color-inchiostro-3` a destra; `min-height` `--size-riga-alta`, divisore `--color-filo`. `--space-6` sopra la prima. Tutta la riga è il link.                                                                                                                                                                                                                                        |
| Frase della coppia | 400 `--text-corpo-*` `--color-inchiostro-2`, `--space-4` sopra e sotto, dopo l'ultima riga.                                                                                                                                                                                                                                                                                                                                                                                                  |
| «Il tuo Nest»      | Riga B con icona `house`, staccata: `--space-10` sopra, filo `--color-filo` sopra la riga, nessuno sotto. Titolo dal componente del nome («Il tuo …», F3 #502).                                                                                                                                                                                                                                                                                                                              |
| Fondo della pagina | `padding-bottom` della pagina con la barra (128): «Il tuo Nest» finisce sopra la barra, non sotto.                                                                                                                                                                                                                                                                                                                                                                                           |

**Regola delle tessere.** Le voci seguono un ordine fisso; le prime quattro **disponibili** sono tessere, le altre righe. Ordine: Animali, Ricette, Pasti, Liste da riusare, Compleanni, Liste dei desideri, Documenti, Contatti, Luoghi, poi le voci di Esplora (Tempo insieme, Stare bene), poi «Il tuo Nest» sempre ultima e mai tessera. Una voce non disponibile non lascia un buco: senza animali (`cb1-30`) Compleanni sale a tessera. Al lancio si vedono solo gli spazi già costruiti (default 8); con meno di quattro:

- 3 tessere: due nella prima fila, una a metà larghezza nella seconda (non si allarga);
- 1 o 2 tessere: una sola fila;
- nessuna riga: dopo le tessere viene subito «Il tuo Nest».

**Esplora sta dentro.** Niente pagina né titolo «Esplora». Tempo insieme e Stare bene, quando esistono, sono righe come le altre (icone e sottotitoli li dà la loro issue). L'indirizzo `/esplora` e le sue sottopagine portano a `/spazi` (lo decide l'analista).

**Punto delle novità.** Pallino 8 (`--size-pallino-urgente`) `--color-allerta` con filo bianco 2 px sull'angolo in alto a destra dell'icona «Spazi» della barra, come in `sc1-18`, e nella barra laterale su computer (`computer/oggi/01`). Si spegne aprendo «Novità». La voce scelta della barra non lo nasconde.

### Computer (1280 e 1440), provvisorio fino al Passo 12

- Barra laterale di F5 con «Spazi» scelta e il punto delle novità; barra in alto «Spazi» 700 26/32 con ricerca e Notifiche. Nessun pulsante «Nuovo …» (Spazi non crea niente).
- Contenuto con margini `--space-8`. Frase nella colonna di lettura `--size-lettura-max` (720).
- **Tessere `.dk-tl`:** `grid-template-columns: repeat(auto-fill, minmax(var(--size-tessera-min), 1fr))`, `gap: var(--space-4)`, `min-height` 112, raggio 18 (canvas `D-AC1:221–228`). A 1280 (968 px di contenuto) e a 1440 (1200) le quattro tessere stanno in una fila.
- **Righe `.dk-li`** nella colonna di lettura (720), allineate a sinistra, `min-height` 56, raggio 14, mouse sopra `--color-riga-mouse`. «Il tuo Nest» in fondo come sul telefono.
- Niente pannello a destra: ogni voce apre la sua pagina.
- 900–1279 px (alta almeno 600; tablet in orizzontale): barra a icone, le tessere quante ne stanno (`auto-fill` con 220 di minimo lo fa da solo: quattro a 1194, tre a 1024). Soglie di D8 (risposta 214); il 760–1099 di prima è superato.
- Sotto i 900 px, o con la finestra alta meno di 600: la disposizione del telefono. Sul tablet in verticale (768–834 px) nella colonna di 640 px al centro, tessere a due per fila (506 §1; `docs/design/tablet/altre-pagine/04-spazi-chiaro.png`, `14-spazi-chiaro.png`).
- Tocco: tessere, righe e «Il tuo Nest» hanno l'area di almeno 44 × 44 px su tutti i formati (risposta 217; righe 56 e tessere 112 la superano già).

### Web da telefono

Uguale all'app a 390. Senza rete nella scheda del browser vale la pagina di sistema `web-da-telefono/11`.

## 3. Stati

| Stato                      | Cosa si vede                                                                                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pieno, famiglia            | `sc1-18` → `sc1-19`.                                                                                                                                                                                                                                                                               |
| Pieno, coppia              | `cb1-30`, con la frase della sezione 4.                                                                                                                                                                                                                                                            |
| Persona sola, niente altro | Stessa regola: le voci disponibili, nessuna frase (non manca niente per colpa di nessuno). Spazi non è mai vuoto: c'è sempre «Il tuo Nest».                                                                                                                                                        |
| Sottotitolo senza dati     | Uno spazio senza niente dentro dice come cominciare (sezione 4), sempre in `--color-inchiostro-2`. Niente «0».                                                                                                                                                                                     |
| Caricamento                | Testata e frase subito; quattro tessere `.skeleton` (bordo invariato, dentro un cerchio 24 e due barre 60% e 40%) e tre righe a scheletro (cerchio 24 + due barre); «Il tuo Nest» c'è già (non dipende dai dati). `aria-busy="true"` e «Caricamento in corso». Con dati salvati, niente scheletro. |
| Aggiornamento non riuscito | `cb1-33`: avviso d'errore pieno `--color-allerta-fondo` sotto la frase, icona `wifi-off` `--color-allerta`, «Riprova» `.lk2` in linea; sotto, tessere e righe com'erano, con i sottotitoli «salvati» della sezione 4.                                                                              |
| Senza rete                 | Avviso **bordato** di `rt1-23` (filo `--color-filo-2`, `wifi-off`), fermo sotto la frase, senza «Riprova». Le voci restano toccabili: ogni pagina mostra il suo stato senza rete.                                                                                                                  |
| Errore senza dati          | Sotto la frase, errore di pagina 2.0 (icona `circle-alert` `--color-allerta`, titolo, frase, «Riprova» secondario); sotto, «Il tuo Nest», che resta raggiungibile.                                                                                                                                 |
| Premuto, mouse             | Tessera e riga: fondo `--color-premuto` (telefono), `--color-riga-mouse` (computer, solo `@media (hover: hover)`); niente ombre né spostamenti.                                                                                                                                                    |

## 4. Testi che le PNG non hanno

Tutti in `src/components/spazi/messages/it.ts` (CA-i18n); plurali con `{ zero, one, other }`. Chiavi indicative.

| Chiave          | Testo                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intro`         | «Tutto quello che non è calendario, spesa o cose da fare. Ogni cosa ha una pagina sua.» (dalle PNG)                                                                                   |
| `pets.sub`      | «Biscotto e Miele» (nomi con `formatList`; uno solo: «Biscotto») · zero «Aggiungi il primo»                                                                                           |
| `recipes.sub`   | «{count} vostre» · one «1 vostra» · zero «Le ricette di casa»                                                                                                                         |
| `meals.sub`     | «Stasera: {dish}» · «Stasera: niente, per ora» (dalle PNG)                                                                                                                            |
| `lists.sub`     | «{count} liste» · one «1 lista» · zero «Le liste che rifate sempre»                                                                                                                   |
| `birthdays.sub` | «{name}, {day}» («Nonna Anna, sabato»; oggi «{name}, oggi»; domani «{name}, domani»; oltre la settimana «{name}, {date}» con «12 dicembre») · zero «Aggiungi il primo compleanno»     |
| `wishlists.sub` | «Sofia: 5 idee · Tommaso: 3 idee» (separatore « · ») · one «1 idea» · zero «Nessuna idea, per ora»                                                                                    |
| `documents.sub` | «{count} file» · zero «Tieni qui i documenti di casa»                                                                                                                                 |
| `contacts.sub`  | «{count} numeri utili» · one «1 numero utile» · zero «I numeri utili di casa»                                                                                                         |
| `places.sub`    | «{count} luoghi» · one «1 luogo» · zero «Scuola, piscina, nonni»                                                                                                                      |
| `nest.sub`      | «Persone, piano, impostazioni» (dalle PNG)                                                                                                                                            |
| `couple.note`   | «In coppia non ci sono le liste dei desideri, i turni e la scuola: compaiono se aggiungete un figlio.» (dalle PNG; al lancio solo i nomi degli spazi già costruiti, con `formatList`) |
| `saved.sub`     | «Salvato alle {time}» · ricette «Le vostre ci sono; il catalogo torna con la rete» (dalle PNG)                                                                                        |
| `updateFailed`  | «Non riusciamo ad aggiornare gli Spazi. Vedi quello che era salvato alle {time}.» + «Riprova» (dalle PNG)                                                                             |
| `offline`       | «Senza rete. Vedi quello che era salvato alle {time}.»                                                                                                                                |
| `error`         | titolo «Non riusciamo a caricare gli Spazi» · frase «Controlla la connessione e riprova.» · «Riprova»                                                                                 |
| `aria.nav`      | voce della barra con il punto: «Spazi, ci sono novità»                                                                                                                                |

Niente esempi sanitari nei testi (D1). I sottotitoli mostrano solo nomi già visibili a chi è nel Nest (animali, figli, compleanni); mai date di nascita né età.

## 5. Tema scuro

Fuori dal lancio (risposta 128), non disegnato. La pagina usa solo token semantici della tavolozza comune (`--color-carta`, `--color-inchiostro*`, `--color-filo*`, `--color-premuto`, `--color-allerta*`): il tema scuro cambierà i valori in un punto solo. Niente colori scritti a mano, niente `prefers-color-scheme` nella pagina. Le icone sono `currentColor` e seguono il testo.

## 6. Componenti usati e richieste

Usati: righe B, avvisi (pieno e bordato), errore di pagina, collegamento (F4a #503); testata, barra con il punto, barra laterale (F5 #506); componente del nome (F3 #502).

Da chiedere con `richiesta-condivisa`:

1. **Tessera 2.0** (`.tessera`, con `.tessera__icona`, `__titolo`, `__sotto`), telefono e computer (`.dk-tl`): la definisce il designer nella skill nella stessa PR `shared/*`; la usano anche Documenti e i tipi di contatto (`telefono.md`, «Tessere»).
2. **Sprite delle icone:** `chef-hat` (Ricette), `cake` (Compleanni), `folder` (Documenti), `clipboard-check` (Liste da riusare, da confrontare con l'icona del canvas). Ci sono già: `paw-print`, `utensils`, `gift`, `phone`, `map-pin`, `house`, `chevron-right`, `wifi-off`, `circle-alert`.
3. **F5:** il punto delle novità sulla voce «Spazi» (barra e barra laterale), con il nome accessibile della sezione 4.

## 7. Movimenti

Nessun movimento proprio. Premuto e mouse: cambio di fondo in `--durata-rapida`. Scheletri: pulsazione `--durata-ampia`, fermi con movimento ridotto. Il punto delle novità sparisce in dissolvenza `--durata-rapida` al ritorno da «Novità».

## 8. Accessibilità

- Contrasti: titoli 15,76:1; sottotitoli e frasi `#55686C` 5,86:1; avviso d'errore 5,78:1. Bordo delle tessere `--color-filo-2` decorativo: la tessera si riconosce dal testo, non dal bordo (non è un controllo di modulo). Punto rosso: non è l'unico segno, c'è il nome accessibile.
- Struttura: `h1` «Spazi»; tessere e righe in un solo elenco `ul` (le tessere sono i primi `li`), così il lettore di schermo conta tutte le voci insieme; «Il tuo Nest» in un `nav` o `ul` a parte con `aria-label` «Il tuo Nest». Ogni tessera e riga è un solo `<a>`: nome accessibile = titolo + sottotitolo; icone e freccia `aria-hidden`.
- Ordine del fuoco: Cerca → Notifiche → avviso («Riprova») → tessere da sinistra a destra, fila per fila → righe → «Il tuo Nest» → barra.
- Aree di tocco: tessere e righe ben oltre 44; «Riprova» in linea con l'area allargata.
- Testo al 200%: le tessere restano due per fila fino a 320 px di contenitore e crescono in altezza; sotto, una per fila (query di contenitore in rem, regola #313); titoli e sottotitoli vanno a capo, niente puntini.

## 9. Cosa cambia rispetto alla pagina attuale

- Via Esplora con le schede «In arrivo» e le puntine (`/esplora`, `pinned-spaces`): al suo posto Spazi con tessere e righe, solo spazi veri.
- «Il tuo Nest» si apre da qui, in fondo; il quadrato del Nest sparisce (A1, risposta 123).
- Nuovo il punto delle novità sulla voce «Spazi» della barra.
