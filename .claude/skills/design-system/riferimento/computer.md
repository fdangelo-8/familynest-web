# Design system · computer e web da telefono (Fable, approvato il 25/11/2026)

Fonte: `docs/design/computer/` (149 PNG, `LEGGIMI.md`, `regole.md`, `tokens-computer.md`, `splash.md`, `decisioni.md`). Passi 10 e 11 del secondo canvas, approvati da Francesco il 25/11/2026 (decisione D5 in `docs/mockup/DECISIONI.md`). **Le correzioni del Passo 12 arriveranno dopo** (elenco in `docs/design/computer/LEGGIMI.md`, «In attesa del Passo 12»): fino ad allora valgono quelle correzioni scritte, non le tavole che contraddicono.

Questo file aggiunge a `telefono.md` solo ciò che cambia su computer. Tutto il resto (colori, persone, tipografia, raggi, ombre, movimento, Componenti 2.0) vale come sul telefono. Stessi testi, stessi dati di prova, stessi nomi di classe del design system.

**Stato del codice.** Come per il telefono: i valori entrano con un lavoro `shared/*` assegnato dal coordinatore, e nessuna pagina li scrive a mano prima. I nomi delle variabili qui sotto sono quelli da usare in quel lavoro; dove un valore del canvas coincide con un token del telefono si usa quel token, senza crearne uno nuovo.

## Regole di adattamento

Testo completo e scorciatoie in `docs/design/computer/regole.md`. Le regole che non si discutono:

| Larghezza        | Disposizione                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| fino a 759 px    | Disegno per telefono (barra in basso). Il web da telefono usa le pagine dell'app: cambia solo ciò che è in `web-da-telefono/`. |
| da 760 a 1099 px | Barra laterale a icone (72 px), contenuto a una colonna (tavola `oggi/` a 1040 px).                                            |
| da 1100 px       | Barra laterale intera (248 px), contenuto a 12 colonne, canalina 24 px, margini 32 px. Tavole a 1280 px.                       |
| da 1440 px       | Contenuto fermo a 1200 px, terza colonna dove serve (Oggi). Oltre crescono solo i margini.                                     |
| tablet           | Non disegnato: fuori perimetro.                                                                                                |

- **Il testo non si allarga:** colonne di lettura di 720 px al massimo (Impostazioni 600, «Chiedi a …» 680, pagine senza account 680 o 960 su due colonne, pagamento 1000). Lo spazio in più diventa una seconda colonna, non righe più lunghe.
- **Barra laterale** al posto della barra in basso: le stesse quattro voci (Oggi, Calendario, Casa, Spazi), sopra il marchio e la lente «Io · Nest», sotto il gruppo fisso «Di casa» (Spesa, Ricette, Animali), in fondo «Chiedi a Nest» e il profilo. Il + diventa un pulsante scritto in alto a destra, sempre nello stesso posto («Nuovo impegno», «Nuova ricetta»…).
- **Pannello a destra** (420 px) per guardare e modificare senza perdere la pagina. Quando si apre, la barra laterale passa alle icone; se al contenuto restano meno di 900 px la scena di Oggi si nasconde e la seconda colonna scende sotto la prima. La regola dipende dalla larghezza che resta al contenuto, non dalla pagina; come scriverla in CSS lo decide la specifica del lavoro `shared/*`.
- **Finestra al centro** (560 px; 420, 480, 760) per creare e confermare: è il foglio del telefono in un altro contenitore (pattern «Foglio o modale» della skill). Il fuoco resta dentro; Esc chiude e il fuoco torna al comando di partenza.
- **Fumetto** (300 px) per le scelte brevi accanto al comando; è anche l'etichetta delle icone della barra a icone. Frecce, Invio, Esc.
- **Ricerca** sempre in vista nella barra in alto, «/» la apre; con il fuoco si allarga e i risultati scendono in un fumetto largo quanto il campo.
- **Mouse:** solo un cambio di fondo, dentro `@media (hover: hover)`; niente movimenti né ombre che compaiono, niente azioni visibili solo con il mouse sopra, niente trascinamento come unico modo.
- **Tastiera:** lettere sole (N, /, K, O, C, A, S, 1–3, T, frecce, Invio, Spazio, Esc, ?), spente mentre si scrive in un campo; seguono la lingua. Ordine di tabulazione: «Vai al contenuto», barra laterale, barra in alto, contenuto, pannello.

## Token nuovi o diversi

Valori esatti da `docs/design/computer/tokens-computer.md` (riga del canvas `D-AC1`). Le misure del guscio sono nuove; i colori, dove coincidono, riusano i token del telefono.

### Guscio

| Variabile (**nuova**)         | Valore                                                            | Uso                                                                 |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `--size-barra-laterale`       | `248px`                                                           | barra laterale intera                                               |
| `--size-barra-laterale-icone` | `72px`                                                            | barra a icone; voci quadrate di 48 px                               |
| `--size-barra-alto`           | `72px`                                                            | barra in alto, padding orizzontale `--space-8` (32 px)              |
| `--size-pannello`             | `420px`                                                           | pannello a destra, testata alta 64 px                               |
| `--size-finestra`             | `560px` (`-stretta` 420, `-media` 480, `-larga` 760)              | finestra al centro, alta al massimo `100dvh - 80px`                 |
| `--size-fumetto`              | `300px`                                                           | fumetto; righe alte almeno 38 px, raggio 9                          |
| `--size-ricerca`              | `280px` (min 120), con il fuoco `400px`                           | campo di ricerca della barra in alto, alto 40, raggio 12            |
| `--size-contenuto-max`        | `1200px`                                                          | contenuto da 1440 px                                                |
| `--size-lettura-max`          | `720px`                                                           | colonna di lettura massima                                          |
| `--size-tessera-min`          | `220px`                                                           | tessere: larghe almeno 220, alte almeno 112, raggio 18, distanza 16 |
| `--shadow-finestra`           | `0 24px 64px rgba(16, 38, 42, 0.26)`                              | finestra al centro                                                  |
| `--shadow-fumetto`            | `0 0 0 1px var(--color-filo), 0 12px 32px rgba(16, 38, 42, 0.18)` | fumetto                                                             |
| `--color-velo-finestra`       | `rgba(16, 38, 42, 0.36)`                                          | velo dietro la finestra                                             |

Misure dei controlli da computer: pulsante `.dk-bt` alto 40, raggio 12, 700 · 15/20 (piccolo 32, raggio 10, 14 px); campo `.dk-fd` alto 48, raggio 14; riga d'elenco `.dk-li` alta almeno 56, raggio 14; voce della barra alta 44, raggio 12, 600 · 15/20. Nel web da telefono le aree di tocco restano 44 × 44; su computer i comandi fitti scendono a 32–40 px come nel canvas (`regole.md` §2).

### Colori

| Valore del canvas               | Token                                       | Uso                                                                                     |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `#0F3D44`                       | `--color-azione`                            | anello di fuoco (vedi sotto), campo con il fuoco, impegno scelto                        |
| `#10262A`                       | `--color-inchiostro`                        | voce scelta della lente, toast, filo della tessera scelta                               |
| `#E4E8E5`                       | `--color-filo`                              | filo della barra laterale e del pannello, mouse sopra il pulsante quieto                |
| `#EEF1EF`                       | `--color-corsia-vuota`                      | segmenti, righe d'ora, giorni senza scuola nel mese, impegni senza persona              |
| `#B3261E`                       | `--color-allerta`                           | filo degli impegni sovrapposti (1,5 px)                                                 |
| `#F5F7F5`                       | `--color-barra-laterale` **nuovo**          | fondo della barra laterale e dei riquadri pieni                                         |
| `#F1F3F1`                       | `--color-quieto` **nuovo**                  | campo di ricerca, pulsante quieto, riga scelta, riga del fumetto al mouse               |
| `#E6EAE7`                       | `--color-lente` **nuovo**                   | capsula «Io · Nest»                                                                     |
| `#E9EDEA`                       | `--color-voce-mouse` **nuovo**              | voce della barra con il mouse sopra                                                     |
| `#F7F8F7`                       | `--color-riga-mouse` **nuovo**              | riga d'elenco con il mouse sopra                                                        |
| `#0A2E34`                       | `--color-azione-mouse` **da chiarire**      | pulsante pieno con il mouse sopra; sul telefono il premuto è `#0A2D33`                  |
| `#33474B`                       | `--color-voce` **nuovo**                    | testo delle voci della barra e dei segmenti                                             |
| `#FCE7E0`, `#C2452D`, `#E7B9AB` | `--color-chiedi-*` **nuovi**                | «Chiedi a Nest» nella barra: fondo, icona e filo scelto, filo del tasto                 |
| `#0B2A31`, `#C9D8D6`            | `--color-scena-accesso`, `-testo` **nuovi** | scena dell'accesso a due metà (lo stesso fondo dello splash)                            |
| `#FEF8E3`                       | `--color-insieme-giorno` **nuovo**          | giorno «liberi insieme» nel mese                                                        |
| `#E2B93B`                       | **da chiarire**                             | linea di «adesso» e barretta di Liberi insieme; sul telefono `--color-adesso` `#F6C945` |

Altri grigi di `tokens-computer.md` (`#FAFBFA`, `#F8F9F8`, `#F6F8F6`, `#E1E5E2`, `#DCE2DF`, `#CBD3CF`, segnaposto delle ricette, finestra di sistema del browser) entrano con le pagine che li usano: il designer li nomina nella specifica di quella pagina.

**Colori degli impegni nel calendario.** Barretta, fondo e corsia seguono `telefono.md` e il requisito F2 (`docs/specifiche/196-token-e-font.md` §5, tinte `-corsia` con contrasto almeno 3:1). I valori del canvas per computer (Biscotto `#D9972F`, Miele `#B8663A`, barrette sotto 3:1) **non si usano**: il Passo 12 li cambia (correzione 1). Ardesia: `#68778D` (decisione di Francesco del 25/11/2026). Miele ha «Mi» nel pallino ovunque (risposta 178).

### Tipografia nuova (in rem nell'app, regola #313)

| Uso                                   | Valore                            |
| ------------------------------------- | --------------------------------- |
| Titolo della barra in alto            | 700 · 26/32, −0,4 px              |
| Saluto di Oggi                        | 500 · 34/40, −0,6 px (nome 700)   |
| Titolo dell'accesso                   | 700 · 40/46, −0,8 px              |
| Testata del pannello e della finestra | 700 · 18/24                       |
| Impegno nella settimana               | 12/15 (stretto 11/13), titolo 700 |
| Impegno nel mese                      | 11/18                             |
| Tasto disegnato `kbd`                 | 600 · 11,5                        |

Il peso 500 del saluto non è tra i pesi del telefono (400, 600, 700): resta com'è nel canvas, si carica con Figtree variabile.

### Movimento

Barra laterale che si stringe all'apertura del pannello 200 ms (`--durata-rapida`); finestra 180 ms, dissolvenza e scala dal 97 %; passi del primo avvio 200 ms, scena tra sera e giorno 400 ms; spunta con Spazio 150 ms; cucina passo passo 200 ms. **Movimento ridotto:** barra e pannello cambiano subito, la finestra solo in dissolvenza (decisione del 13/11). Splash: `docs/design/computer/splash.md` (il «respiro» del lungo è da chiarire con Fable: nota 100 ms, CSS 50 ms).

## Fuoco e mouse

- **Anello di fuoco su computer:** `outline: var(--border-medio) solid var(--color-azione); outline-offset: var(--space-half)` (2 px, `#0F3D44`, 11,86:1 sul bianco, 11,01:1 sulla barra laterale); `--color-latte` o bianco sui fondi scuri. Sostituisce `--color-info` (domanda 4 di `telefono.md`): lo decide il lavoro `shared/*` per tutta l'app, non una pagina.
- Un solo elemento con il fuoco alla volta; l'errore di un campo non colora l'etichetta (correzione 6 del Passo 12).
- Mouse sopra: `--color-riga-mouse` sulle righe, `--color-voce-mouse` sulle voci della barra, `--color-azione-mouse` sui pulsanti pieni, `--color-filo` sul quieto. Scelta come sul telefono.

## Contrasti da ricordare

| Testo o segno | Fondo     | Rapporto | Nota                                                                                                |
| ------------- | --------- | -------- | --------------------------------------------------------------------------------------------------- |
| `#33474B`     | `#F5F7F5` | 9,10:1   | voci della barra                                                                                    |
| `#FFFFFF`     | `#0A2E34` | 14,45:1  | pulsante pieno al mouse                                                                             |
| `#C9D8D6`     | `#0B2A31` | 10,27:1  | testo sulla scena dell'accesso                                                                      |
| `#C2452D`     | `#FCE7E0` | 4,22:1   | icona di «Chiedi a Nest» (segno, sopra 3:1); il testo della voce è inchiostro, 13,24:1              |
| `#6B7C7F`     | `#F5F7F5` | 4,05:1   | **insufficiente** per il titoletto «Di casa» (12,5 px): proposta `--color-inchiostro-2` (`#55686C`) |
| `#93A0A2`     | `#F8F9F8` | 2,55:1   | **insufficiente** per i numeri dei giorni fuori mese: proposta `--color-inchiostro-2`, come la #52  |
| `#B9C4C0`     | `#FFFFFF` | 1,79:1   | **insufficiente** come unico bordo del campo `.dk-fd`: proposta `--color-filo-campo` (`#7F9092`)    |
| `#E2B93B`     | `#FFFFFF` | 1,87:1   | linea di «adesso»: non è l'unico segno (c'è l'ora), ma va confermata con il Passo 12                |

Le tre proposte vanno nella issue del lavoro `shared/*` come domande a Francesco: non si applicano finché non sono approvate.
